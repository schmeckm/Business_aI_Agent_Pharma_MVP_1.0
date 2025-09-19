// mpc-server.js
import express from "express";
import bodyParser from "body-parser";
import { v4 as uuidv4 } from "uuid";
import { WebSocketServer } from "ws";
import logger, { signAuditEntry } from "./src/services/logger.js";
import { OpcExecutor } from "./src/services/opcExecutor.js";

const PORT = Number(process.env.MPC_PORT || 5200);
const app = express();
app.use(bodyParser.json({ limit: "1mb" }));

const PLANS = new Map();
const EXECUTIONS = new Map();

const server = app.listen(PORT, () => logger.info({ port: PORT }, `MPC mock server listening on ${PORT}`));

// WebSocket server (correct import and constructor for ESM)
const wss = new WebSocketServer({ server, path: "/events" });

function broadcast(evt) {
  const msg = JSON.stringify(evt);
  for (const client of wss.clients) {
    try {
      if (client.readyState === 1) client.send(msg);
    } catch (e) {
      logger.warn({ err: String(e) }, "broadcast: failed to send to client");
    }
  }
}

/* OPC executor instance (optional, used during real execute) */
const opc = new OpcExecutor({
  endpointUrl: process.env.OPC_ENDPOINT,
  user: process.env.OPC_USER,
  password: process.env.OPC_PASS
});

/** simple optimizer: produces plan + embedded OPC actions */
function simpleOptimize(reqBody) {
  const planId = `PLAN-${Date.now()}`;
  const lines = (reqBody.lines && reqBody.lines.length) ? reqBody.lines : [{ id: "PCK-01" }];
  const lineId = lines[0].id;
  let now = 0;
  const plan = [];

  for (const o of reqBody.orders || []) {
    const ptime = (reqBody.processing_time && reqBody.processing_time[o.id] && reqBody.processing_time[o.id][lineId]) || Math.max(1, (o.qty || 0) / 1000);
    const start = now;
    const end = +(start + ptime).toFixed(3);
    const actions = [
      { type: "write", nodeId: `ns=2;s=Lines/${lineId}/StartRecipe`, value: `${o.material}-R1` },
      { type: "write", nodeId: `ns=2;s=Lines/${lineId}/TargetQty`, value: o.qty },
      { type: "write", nodeId: `ns=2;s=Lines/${lineId}/Command`, value: "START" }
    ];
    plan.push({ orderId: o.id, line: lineId, start, end, actions });
    now = end;
  }

  return { planId, plan, meta: { feasible: true, objective_value: 0 } };
}

/** POST /optimize */
app.post("/optimize", (req, res) => {
  try {
    const { planId, plan, meta } = simpleOptimize(req.body);
    PLANS.set(planId, { plan, request: req.body, createdAt: new Date().toISOString() });

    try {
      const auditEntry = signAuditEntry({ type: "optimize", planId, request: req.body, createdAt: new Date().toISOString() });
      logger.info({ audit: auditEntry }, "optimize result signed");
    } catch (e) {
      logger.warn({ err: String(e) }, "audit signing failed");
    }

    const approval_required = (req.body.orders || []).some(o => (o.qty || 0) > (Number(process.env.MPC_APPROVAL_QTY_THRESHOLD || 1000)));

    res.json({ ok: true, planId, plan, approval_required, meta });
  } catch (e) {
    logger.error({ err: String(e) }, "optimize failed");
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/** POST /execute */
app.post("/execute", async (req, res) => {
  try {
    const idempotencyKey = req.headers["idempotency-key"] || req.body.idempotencyKey || uuidv4();

    // idempotency: return existing if idempotency key seen
    for (const v of EXECUTIONS.values()) {
      if (v.idempotencyKey === idempotencyKey) {
        return res.json({ ok: true, executionId: v.executionId, status: v.status });
      }
    }

    const { planId, mode = "dry", operator } = req.body;
    if (!planId || !PLANS.has(planId)) return res.status(400).json({ ok: false, error: "planId missing or unknown" });

    const executionId = `EXEC-${Date.now()}-${Math.floor(Math.random()*10000)}`;
    const record = { executionId, planId, mode, operator, startTs: new Date().toISOString(), status: "queued", idempotencyKey };
    EXECUTIONS.set(executionId, record);

    // async execution
    (async () => {
      record.status = "running";
      broadcast({ type: "execution.started", executionId, planId, mode });
      logger.info({ executionId, planId }, "execution started");

      const planObj = PLANS.get(planId);
      if (!planObj) {
        record.status = "failed";
        broadcast({ type: "execution.failed", executionId, reason: "plan not found" });
        return;
      }

      try {
        if (mode === "dry") {
          await new Promise(r => setTimeout(r, 300));
          record.status = "finished";
          record.finishedAt = new Date().toISOString();
          broadcast({ type: "execution.finished", executionId, planId, summary: "dry-run complete" });
          logger.info({ executionId }, "dry-run finished");
          return;
        }

        await opc.connect();

        for (const step of planObj.plan) {
          for (const action of step.actions || []) {
            try {
              const writeRes = await opc.writeNode(action.nodeId, action.value);
              broadcast({ type: "node.write.success", executionId, nodeId: action.nodeId, status: writeRes });
              logger.info({ executionId, nodeId: action.nodeId, writeRes }, "node write success");
              await new Promise(r => setTimeout(r, Number(process.env.MPC_NODE_WRITE_DELAY_MS || 200)));
            } catch (err) {
              broadcast({ type: "node.write.fail", executionId, nodeId: action.nodeId, err: String(err) });
              logger.error({ executionId, nodeId: action.nodeId, err: String(err) }, "node write failed");
              record.status = "aborted";
              record.error = String(err);
              try { await opc.writeNode(`ns=2;s=Lines/${step.line}/Command`, "STOP"); } catch (eStop) { logger.warn("failed to write STOP during abort", eStop?.message || eStop); }
              return;
            }
          }
        }

        record.status = "finished";
        record.finishedAt = new Date().toISOString();
        broadcast({ type: "execution.finished", executionId, planId });
        logger.info({ executionId }, "execution finished");
      } catch (e) {
        record.status = "failed";
        record.error = String(e);
        broadcast({ type: "execution.failed", executionId, planId, err: String(e) });
        logger.error({ executionId, err: String(e) }, "execution failed");
      } finally {
        try { await opc.disconnect(); } catch (_) {}
      }
    })();

    res.json({ ok: true, executionId, status: "queued" });
  } catch (e) {
    logger.error({ err: String(e) }, "execute endpoint error");
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/** GET /status/:executionId */
app.get("/status/:executionId", (req, res) => {
  const ex = EXECUTIONS.get(req.params.executionId);
  if (!ex) return res.status(404).json({ ok: false, error: "unknown executionId" });
  res.json({ ok: true, execution: ex });
});
