import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();


const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 4000;
const AUDIT_LOG_FILE = "./audit_log.json";


if (!process.env.CLAUDE_API_KEY) {
  console.error("❌ Missing CLAUDE_API_KEY in .env");
  process.exit(1);
}

// Claude Client
const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// --------- Audit Logger ----------
function logAudit(entry) {
  try {
    let current = [];
    if (fs.existsSync(AUDIT_LOG_FILE)) {
      const data = fs.readFileSync(AUDIT_LOG_FILE, "utf8");
      if (data) current = JSON.parse(data);
    }
    if (!Array.isArray(current)) current = [];
    current.push(entry);
    fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(current, null, 2));
  } catch (err) {
    console.error("Audit logging failed:", err);
  }
}

// --------- Routes ----------
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "Agentic Pharma MVP 1.0" });
});

app.get("/audit_log.json", (req, res) => {
  if (fs.existsSync(AUDIT_LOG_FILE)) {
    res.sendFile(AUDIT_LOG_FILE, { root: process.cwd() });
  } else {
    res.json([]);
  }
});

app.post("/chat", async (req, res) => {
  const { message } = req.body;

  try {
    const completion = await client.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: message,
        },
      ],
      system:
        "You are an AI agent specialized in pharmaceutical manufacturing. Always provide structured, compliant responses suitable for GMP / Part 11 contexts.",
    });

    const response = completion.content[0].text;

    const entry = {
      userMessage: message,
      aiResponse: response,
      timestamp: new Date().toISOString(),
    };

    logAudit(entry);

    res.json({
      response: response, // for System Log (right side)
      claudeResponse: response, // for AI Response Box (below button)
      timestamp: entry.timestamp,
    });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 MVP 1.0 Agentic Pharma running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📂 Audit log: http://localhost:${PORT}/audit_log.json`);
});
