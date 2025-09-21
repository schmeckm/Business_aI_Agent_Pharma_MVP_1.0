// ===============================
// Frontend App.js
// ===============================

// Load templates dynamically on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadTemplates();
  updateSystemStatus();
  startEventMonitor(); // NEW: start event monitor on page load
});

// ===============================
// Load templates from backend YAML
// ===============================
async function loadTemplates() {
  try {
    const response = await fetch('/templates');
    const data = await response.json();
    
    const selectElement = document.getElementById('prompt');
    
    // Keep first option "-- Free Text Input --", remove others
    while (selectElement.children.length > 1) {
      selectElement.removeChild(selectElement.lastChild);
    }
    
    // Add templates from agents.yaml
    data.templates.forEach(template => {
      const option = document.createElement('option');
      option.value = template.value;
      option.textContent = template.text;
      if (template.description) {
        option.title = template.description; // Tooltip
      }
      selectElement.appendChild(option);
    });
    
    console.log(`✅ Loaded ${data.count} templates from agents.yaml`);
    
  } catch (error) {
    console.error('❌ Failed to load templates:', error);
  }
}

// ===============================
// Update system status display
// ===============================
async function updateSystemStatus() {
  try {
    const response = await fetch('/health');
    const health = await response.json();
    
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = `System Status: Ready - Mode: ${health.agentMode} | Actions: ${health.useActions ? 'enabled' : 'disabled'}`;
    }
    
    // Update GMP indicators
    document.getElementById('gmp-status').textContent = health.status === 'ok' ? 'Active' : 'Warning';
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
  }
}

// ===============================
// Clear output function
// ===============================
function clearOutput() {
  document.getElementById('out').textContent = 
    'Pharmaceutical Manufacturing Agent System Ready...\n' +
    'MVP 1.0 Architecture\n' +
    'AI Decision Logging: ENABLED\n' +
    'GMP Compliance Monitoring: ACTIVE';
  document.getElementById('claude-response').style.display = 'none';
}

// ===============================
// Main chat handler
// ===============================
document.getElementById("send").addEventListener("click", async () => {
  const btn = document.getElementById("send");
  const promptSelect = document.getElementById("prompt").value;
  const messageInput = document.getElementById("message").value;

  // Validation
  if (!promptSelect && !messageInput.trim()) {
    alert("Please select a template or enter a message");
    return;
  }

  // Button → Spinner anzeigen
  btn.innerHTML = `Processing <span class="spinner"></span>`;
  btn.disabled = true;

  const startTime = Date.now();

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: promptSelect || messageInput,
        user: { 
          id: "frontend-user", 
          name: "Manufacturing Operator",
          interface: "web"
        }
      })
    });

    const data = await res.json();
    const processingTime = Date.now() - startTime;

    // Claude Antwort anzeigen
    document.getElementById("claude-text").innerText = data.response;
    document.getElementById("claude-response").style.display = "block";

    // Enhanced system log with agent info
    const out = document.getElementById("out");
    const agentInfo = data.agentUsed ? `Agent: ${data.agentUsed} | ` : '';
    const modeInfo = data.agentMode ? `Mode: ${data.agentMode} | ` : '';
    const timeInfo = `Time: ${processingTime}ms`;
    const actionsInfo = data.actionsPerformed?.length ? ` | Actions: ${data.actionsPerformed.length}` : '';
    
    out.textContent += `\n\n[${new Date().toLocaleTimeString()}] ${agentInfo}${modeInfo}${timeInfo}${actionsInfo}\n${data.response}`;
    out.scrollTop = out.scrollHeight;

    // Update metrics if element exists
    const metrics = document.getElementById("metrics");
    if (metrics) {
      metrics.textContent = `Last operation: ${agentInfo}${modeInfo}${timeInfo}${actionsInfo}`;
    }

  } catch (err) {
    console.error("Chat error:", err);
    
    // Show error in Claude response box
    document.getElementById("claude-text").innerText = `System Error: ${err.message}`;
    document.getElementById("claude-response").style.display = "block";
    
    alert("❌ Fehler beim Senden an Agent-System");
  } finally {
    // Button wiederherstellen
    btn.innerHTML = "Execute Manufacturing Command";
    btn.disabled = false;
  }
});

// ===============================
// Auto-refresh templates
// ===============================
setInterval(async () => {
  try {
    const response = await fetch('/agents');
    const data = await response.json();
    
    if (data.stats && data.stats.lastReload) {
      const lastReload = new Date(data.stats.lastReload);
      const now = new Date();
      
      // If agents were reloaded in last 10 seconds, refresh templates
      if (now - lastReload < 10000) {
        console.log('🔄 Agents reloaded, refreshing templates...');
        await loadTemplates();
      }
    }
  } catch (error) {
    // Silent fail for background refresh
  }
}, 10000); // Check every 10 seconds

// ===============================
// Event Monitor (SSE)
// ===============================
let allEvents = [];

function startEventMonitor() {
  const evtSource = new EventSource("/events");

  evtSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    allEvents.push(data);
    renderEvents();
  };

  evtSource.onerror = () => {
    allEvents.push({
      type: "error",
      timestamp: new Date().toISOString(),
      payload: { message: "⚠️ Event stream disconnected" }
    });
    renderEvents();
  };
}

function renderEvents() {
  const monitor = document.getElementById("event-monitor");
  if (!monitor) return;

  monitor.innerHTML = "";

  allEvents.forEach(data => {
    const wrapper = document.createElement("div");
    wrapper.classList.add("event-line");

    if (data.type === "received") wrapper.classList.add("event-received");
    else if (data.type === "published") wrapper.classList.add("event-published");
    else if (data.type === "agent-action") wrapper.classList.add("event-agent-action");
    else if (data.type === "audit") wrapper.classList.add("event-audit");
    else wrapper.classList.add("event-error");

    const icon = {
      received: "📥",
      published: "📤",
      "agent-action": "🤖",
      audit: "📝",
      chat: "💬",
      tool: "🔧",
      error: "⚠️",
      connection: "🔌"
    }[data.type] || "ℹ️";

    const ts = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    wrapper.textContent = `[${ts}] ${icon} ${data.type.toUpperCase()} | ${data.topic || data.agent || ""} | ${JSON.stringify(data.payload || data.action || data.details || data.message || {})}`;

    monitor.appendChild(wrapper);
  });

  monitor.scrollTop = monitor.scrollHeight;
}

function clearEvents() {
  allEvents = [];
  renderEvents();
}
