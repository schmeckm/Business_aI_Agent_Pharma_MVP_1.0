import { audit, getAudit } from "../services/auditLog.js";

export async function listAgents(req, res) {
  res.json({ agents: req.locals.registry.all() });
}

export async function upsertAgent(req, res) {
  const agent = req.body || {};
  if (!agent.id || !agent.namespace) return res.status(400).json({ error:"id and namespace required" });
  const saved = req.locals.registry.upsert(agent);
  audit({ type:"agent_upsert", agent: saved.id });
  res.json({ ok:true, agent: saved });
}

export async function deleteAgent(req, res) {
  const { id } = req.params;
  req.locals.registry.remove(id);
  audit({ type:"agent_delete", agent: id });
  res.json({ ok:true, id });
}

export async function reloadAgents(req, res) {
  const data = req.locals.registry.reload();
  audit({ type:"agents_reload" });
  res.json({ ok:true, agents: data });
}

export async function testRoute(req, res) {
  const { intent, context = {}, text = "" } = req.body || {};
  if (!intent) return res.status(400).json({ error:"intent required" });
  const routing = await req.locals.router.route({ intent, context, text });
  audit({ type:"route_test", intent, via:routing.via, agent:routing.agent });
  res.json({ routing });
}

export async function listAudit(_req, res) {
  res.json({ entries: getAudit() });
}
