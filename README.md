# 💊 Pharmaceutical Manufacturing Agent System – MVP 1.0

An AI-driven **Pharmaceutical Manufacturing Agent System** prototype for GMP-compliant decision support, daily briefings, and manufacturing operations.  
This system integrates **Claude AI**, audit logging (21 CFR Part 11 & ALCOA+), and mock manufacturing data into an enterprise-ready agent framework.

---

## 🚀 Features

- **Claude AI integration** for manufacturing command interpretation
- **Predefined operation templates** (Orders, Morning Briefing, QA, Supply Chain, Batch Release)
- **Audit Log** compliant with **21 CFR Part 11** and **ALCOA+ principles**
- **Mock Data Integration** (orders, issues, briefings)
- **Web Frontend** with McKinsey-style UI
- **Loading Spinner** for async operations
- **Health Check API** and JSON Audit Viewer

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    U[👨‍💻 User] -->|Web UI| F[Frontend (HTML/CSS/JS)]
    F -->|/chat POST| B[Backend (Express/Node.js)]
    B -->|Mock Data| M[📂 mock-data/*.json]
    B -->|Claude API| C[🤖 Claude AI (Anthropic SDK)]
    B -->|Audit Trail| A[📝 audit_log.json]

    subgraph GMP Compliance
        A --> V[Audit Viewer]
        B --> L[Audit Middleware]
    end

agent-framework/
│
├── public/               # Static frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── audit.html
│   ├── css/styles.css
│   └── js/app.js
│
├── mock-data/            # Mock manufacturing data
│   ├── orders.json
│   ├── issues.json
│   └── morning_briefing.json
│
├── config/
│   └── agents.json       # Agent definitions
│
├── audit_log.json        # AI Audit Trail
├── app.js                # Express backend & API routes
├── package.json
└── README.md

⚙️ Installation & Setup

1. Clone Repository

git clone https://github.com/YOUR_USERNAME/pharma-agent-mvp.git
cd pharma-agent-mvp/agent-framework

2. Install Dependencies

npm install

3. Configure Environment

Create a .env file:

PORT=4000
CLAUDE_API_KEY=your_api_key_here
CLAUDE_MODEL=claude-3-7-sonnet-20250219

4. Run the App

npm start

5. Open in Browser

http://localhost:4000


🔎 Key Endpoints

GET /health → Health check
POST /chat → Send manufacturing command
GET /audit_log.json → Raw JSON audit log
GET /audit.html → Web Audit Log Viewer

🧪 Example Commands

ask-today-orders → Show today’s open orders
general-assessment → Production release assessment (next 24h)
morning-briefing → Morning operations overview
schedule-line → Line scheduling
Free text: Which orders are free for release?

✅ Compliance

This prototype demonstrates 21 CFR Part 11 and ALCOA+ compliance principles:
Audit Trail: Every AI interaction is logged with timestamp, user ID, action, and response
Data Integrity: Logs are append-only and JSON-based
Transparency: Full audit viewer included

📜 License

MIT License © 2025 – Pharma AI Agent MVP Project