export async function marPlanController(req, res) {
  const { line, date, material, qty } = req.body || {};
  if (!line || !date || !material || qty == null) {
    return res.status(422).json({ error: "line, date, material, qty sind Pflichtfelder" });
  }
  const result = {
    scheduled: true,
    line,
    date,
    material,
    qty: Number(qty),
    workorderId: `${material}-${date}-${line}`,
  };
  return res.json({ ok: true, result });
}

export async function marStatusController(req, res) {
  const { orderId } = req.query || {};
  if (!orderId) return res.status(422).json({ error: "orderId ist Pflicht" });
  return res.json({ ok: true, result: { orderId, status: "planned" } });
}
