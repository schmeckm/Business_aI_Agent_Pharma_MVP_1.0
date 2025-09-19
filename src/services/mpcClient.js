// src/services/mpcClient.js
import logger from "./logger.js";

export async function callMpcServer(baseUrl, payload, timeoutMs = 15000) {
  const url = `${baseUrl.replace(/\/$/, "")}/optimize`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    logger.debug({ url, payload }, "callMpcServer");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(t);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`MPC server returned ${res.status} ${txt}`);
    }
    const j = await res.json();
    logger.debug({ meta: j.meta }, "callMpcServer result");
    return j;
  } catch (e) {
    clearTimeout(t);
    logger.warn({ err: String(e) }, "callMpcServer failed");
    throw e;
  }
}
