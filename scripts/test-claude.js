// scripts/test-claude.js
import dotenv from 'dotenv';
import { createClaudeClient } from "../src/services/llm/claudeClient.js";

// .env Datei laden
dotenv.config();

(async function main() {
  console.log("[test-claude] loaded .env (if present)");
  console.log("[test-claude] Environment check:", {
    claudeKey: process.env.CLAUDE_API_KEY ? 'Present' : 'Missing',
    keyLength: process.env.CLAUDE_API_KEY?.length || 0,
    model: process.env.CLAUDE_MODEL || 'Not set'
  });
  console.log("[test-claude] starting");

  const client = createClaudeClient({});
  console.log("[test-claude] client endpoint:", client.endpoint);

  // 1) list models (connectivity check)
  try {
    console.log("[test-claude] attempting listModels...");
    const lm = await client.listModels();
    console.log("[test-claude] listModels success -> endpoint:", lm.endpoint);
    console.log(JSON.stringify(lm.raw, null, 2));
  } catch (e) {
    console.error("[test-claude] listModels failed:", e.message);
    if (e.response) console.error("response:", JSON.stringify(e.response, null, 2));
  }

  // 2) Simple chat test
  try {
    console.log("[test-claude] Doing a simple chat test...");
    const msg = [{ role: "user", content: "Sag kurz Hallo auf Deutsch." }];
    const r = await client.chat(msg);
    console.log("[test-claude] chat success, endpoint:", r.endpoint);
    console.log("content:", r.content);
    console.log("raw:", JSON.stringify(r.raw, null, 2));
  } catch (e) {
    console.error("[test-claude] simple chat failed:", e.message);
    if (e.response) console.error("response:", JSON.stringify(e.response, null, 2));
  }

  // 3) NLU extraction test (example)
  try {
    console.log("[test-claude] Doing NLU extraction test...");
    const ask = [{ role: "user", content: "Extrahiere Intent und Material aus: Plane Linie PCK-01 morgen für FG-999, 100 Stk in EU" }];
    const r2 = await client.chat(ask);
    console.log("[test-claude] NLU extraction success, endpoint:", r2.endpoint);
    console.log("content:", r2.content);
    console.log("raw:", JSON.stringify(r2.raw, null, 2));
  } catch (e) {
    console.error("[test-claude] NLU extraction failed:", e.message);
    if (e.response) console.error("response:", JSON.stringify(e.response, null, 2));
  }

  console.log("[test-claude] finished");
})();