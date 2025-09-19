// src/services/mpcClientCaller.js
import { v4 as uuidv4 } from "uuid";
import logger from "./logger.js";

export async function optimizeAndExecute(optimizeUrl, payload, executeUrl, operator = {}, opts = {}) {
  const optimizeEndpoint = `${optimizeUrl.replace(/\/$/, "")}/optimize`;
  const executeEndpoint = `${executeUrl.replace(/\/$/, "")}/execute`;
  logger.debug({ optimizeEndpoint, payload }, "calling optimize");
  const res = await fetch(optimizeEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!json.ok) throw new Error("optimize failed: " + JSON.stringify(json));
  const { planId, plan, approval_required } = json;
  if (approval_required && !opts.operatorConfirmed) {
    logger.info({ planId }, "approval required - returning plan for operator confirmation");
    return { ok: true, planId, plan, approval_required };
  }
  const idempotencyKey = uuidv4();
  logger.info({ planId, idempotencyKey }, "calling execute");
  const execRes = await fetch(executeEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey
    },
    body: JSON.stringify({ planId, mode: opts.mode || "execute", operator })
  });
  const execJson = await execRes.json();
  if (!execJson.ok) throw new Error("execute failed: " + JSON.stringify(execJson));
  return execJson;
}
