// app.js
import express from "express";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// === Claude Config ===
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || null;
const CLAUDE_MODEL =
  process.env.CLAUDE_MODEL || "claude-3-7-sonnet-20250219";

let anthropic = null;
if (CLAUDE_API_KEY) {
  anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });
  console.log(`🤖 Claude model in use: ${CLAUDE_MODEL}`);
} else {
  console.log("⚠️ No Claude API key found. Claude integration disabled.");
}

// === Middleware ===
app.use(express.json());
app.use(express.static("public"));

// === Audit Log ===
const auditLogPath = path.join("audit_log.json");

function appendAudit(entry) {
  let log = [];
  if (fs.existsSync(auditLogPath)) {
    try {
      log = JSON.parse(fs.readFileSync(auditLogPath, "utf8"));
    } catch {
      log = [];
    }
  }
  log.push(entry);
  fs.writeFileSync(auditLogPath, JSON.stringify(log, null, 2));
}

// === Agents laden mit BOM-Fix ===
function loadAgents() {
  try {
    let raw = fs.readFileSync(path.join("config", "agents.json"), "utf8");

    if (raw.charCodeAt(0) === 0xfeff) {
      raw = raw.slice(1);
    }

    const agents = JSON.parse(raw);
    console.log("✅ Loaded agents:", agents.map((a) => a.id));
    return agents;
  } catch (err) {
    console.error("❌ Failed to read agents.json:", err.message);
    return [];
  }
}
const agents = loadAgents();

// === Claude Helper ===
async function runClaude(systemPrompt, userPrompt, retries = 3) {
  if (!anthropic) return "Claude not configured.";
  try {
    const resp = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 700,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    return resp.content[0].text;
  } catch (err) {
    if (err?.error?.type === "overloaded_error" && retries > 0) {
      console.warn(`⚠️ Claude overloaded, retrying... (${retries})`);
      await new Promise((r) => setTimeout(r, 3000));
      return runClaude(systemPrompt, userPrompt, retries - 1);
    }
    console.error("❌ Claude error:", err);
    return `Claude error: ${err.message}`;
  }
}

// === Helper: JSON-Daten laden ===
function safeReadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (err) {
    console.warn(`⚠️ Could not read ${filePath}:`, err.message);
    return [];
  }
}

// === Routes ===
app.get("/health", (req, res) => {
  res.json({ status: "ok", agents: agents.map((a) => a.id) });
});

app.get("/audit_log.json", (req, res) => {
  if (!fs.existsSync(auditLogPath)) return res.json([]);
  res.sendFile(path.resolve(auditLogPath));
});

// === Hauptchat ===
app.post("/chat", async (req, res) => {
  const { message, user } = req.body;
  let responseText = "";
  let status = "success";

  try {
    // === Daten vorbereiten ===
    const orders = safeReadJSON("mock-data/orders.json");
    const issues = safeReadJSON("mock-data/issues.json");

    const systemPrompt = `
Du bist ein Assistent in der pharmazeutischen Produktion.
Hier sind die relevanten Produktionsdaten:

📦 Orders:
${JSON.stringify(orders, null, 2)}

⚠️ Issues:
${JSON.stringify(issues, null, 2)}

👉 Regeln:
- Antworte ausschließlich basierend auf diesen Daten.
- Erfinde keine zusätzlichen Orders, Materialien oder Länder.
- Verwende die Felder: orderId, material, qty, market, status, startDate, endDate falls vorhanden.
- Status darf nur "created", "released", "closed" oder "planned" sein.
- Wenn keine Daten passen, antworte: "Keine passenden Daten gefunden."
- Nutze klares, strukturiertes Deutsch.
    `;

    // === Claude call ===
    responseText = await runClaude(systemPrompt, message);

    // === Audit trail ===
    appendAudit({
      type: "chat",
      timestamp: new Date().toISOString(),
      userId: user?.id || "guest",
      userName: user?.name || "Anonymous",
      action: message,
      claudeResponse: responseText,
      status,
    });

    res.json({ response: responseText });
  } catch (err) {
    console.error("❌ Error in /chat:", err);
    status = "error";
    appendAudit({
      type: "chat",
      timestamp: new Date().toISOString(),
      userId: user?.id || "guest",
      userName: user?.name || "Anonymous",
      action: message,
      claudeResponse: err.message,
      status,
    });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// === Start Server ===
app.listen(PORT, () => {
  console.log(
    `🚀 MVP 1.0 Agentic Pharma running on http://localhost:${PORT}`
  );
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📂 Audit log:   http://localhost:${PORT}/audit_log.json`);
});
