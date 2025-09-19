export async function rpcController(req, res, next) {
  try {
    const { jsonrpc, method, params, id } = req.body || {};
    if (jsonrpc !== "2.0") return res.json({ jsonrpc:"2.0", error:{ message:"invalid jsonrpc" }, id });
    const result = await req.locals.orchestrator.handleRpc(method, params);
    res.json({ jsonrpc:"2.0", result, id });
  } catch (e) { next(e); }
}
