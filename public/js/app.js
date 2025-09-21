// ===============================
// Frontend App.js - Enhanced with Version Display
// ===============================

// Load templates dynamically on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadTemplates();
  updateSystemStatus();
  updateHealthIndicator(); // NEW: Initialize health indicator
  startEventMonitor(); // NEW: start event monitor on page load
  loadVersionInfo(); // NEW: load version information
  
  // Update health indicator every 30 seconds
  setInterval(updateHealthIndicator, 30000);
});

// ===============================
// NEW: Load version information
// ===============================
async function loadVersionInfo() {
  try {
    const response = await fetch('/api/system/health');
    const health = await response.json();
    
    // Create version display if it doesn't exist
    let versionElement = document.getElementById('version-display');
    if (!versionElement) {
      versionElement = document.createElement('div');
      versionElement.id = 'version-display';
      versionElement.style.cssText = `
        position: fixed; 
        bottom: 10px; 
        right: 10px; 
        font-size: 11px; 
        color: #666; 
        background: rgba(255,255,255,0.9); 
        padding: 5px 10px; 
        border-radius: 4px;
        border: 1px solid #ddd;
        cursor: pointer;
        z-index: 1000;
      `;
      document.body.appendChild(versionElement);
    }
    
    // Display version
    const version = health.version || '2.0.1';
    const developer = health.developer || 'Markus Schmeckenbecher';
    
    versionElement.textContent = `v${version}`;
    versionElement.title = `
System Version: ${version}
Developer: ${developer}
Environment: ${health.components?.agentManager?.status || 'unknown'}
Agents Loaded: ${health.components?.agentManager?.stats?.loaded || 0}
Data Sources: ${health.components?.dataManager?.loaded || 0}
Event Subscriptions: ${health.components?.eventBus?.subscriptions || 0}

Click for detailed system info
    `.trim();
    
    // Click handler for detailed info
    versionElement.addEventListener('click', showSystemInfo);
    
  } catch (error) {
    console.warn('Could not load version info:', error);
    // Fallback version display
    const versionElement = document.getElementById('version-display') || createVersionElement();
    versionElement.textContent = 'v2.0.1';
    versionElement.title = 'Version info unavailable';
  }
}

// ===============================
// NEW: Show detailed system information
// ===============================
async function showSystemInfo() {
  try {
    const response = await fetch('/api/system/status');
    const status = await response.json();
    
    const info = `
=== SYSTEM INFORMATION ===

Version: ${status.version || '2.0.1'}
Uptime: ${Math.round(status.uptime || 0)}s
Memory: ${Math.round((status.memory?.heapUsed || 0) / 1024 / 1024)}MB

=== AGENTS ===
Loaded: ${status.agents?.loaded || 0}
Failed: ${status.agents?.failed || 0}
Last Reload: ${status.agents?.lastReload || 'Never'}

=== DATA SOURCES ===
${Object.entries(status.data || {}).map(([key, info]) => 
  `${key}: ${info.entries} entries (${info.source || 'unknown'})`
).join('\n')}

=== EVENTS ===
Subscriptions: ${status.events?.totalEvents || 0}
Publishers: ${status.events?.publishers?.length || 0}

=== ENVIRONMENT ===
Node.js: ${process.version || 'Unknown'}
Platform: ${navigator.platform}
User Agent: ${navigator.userAgent.substring(0, 50)}...
    `;
    
    alert(info);
    
  } catch (error) {
    alert('Could not load detailed system information');
  }
}

// ===============================
// NEW: Create version element helper
// ===============================
function createVersionElement() {
  const versionElement = document.createElement('div');
  versionElement.id = 'version-display';
  versionElement.style.cssText = `
    position: fixed; 
    bottom: 10px; 
    right: 10px; 
    font-size: 11px; 
    color: #666; 
    background: rgba(255,255,255,0.9); 
    padding: 5px 10px; 
    border-radius: 4px;
    border: 1px solid #ddd;
    cursor: pointer;
    z-index: 1000;
  `;
  document.body.appendChild(versionElement);
  return versionElement;
}

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
// NEW: Update Health Indicator (Ampel)
// ===============================
async function updateHealthIndicator() {
  const healthDot = document.getElementById('health-dot');
  const healthText = document.getElementById('health-text');
  
  try {
    // Try new API first, fallback to old API
    let response;
    try {
      response = await fetch('/api/system/health');
    } catch (error) {
      response = await fetch('/health');
    }
    
    const health = await response.json();
    
    // Update health indicator based on status
    if (health.status === 'ok') {
      healthDot.className = 'health-dot health-green';
      healthText.textContent = 'System OK';
    } else {
      healthDot.className = 'health-dot health-yellow';
      healthText.textContent = 'Warning';
    }
    
    // Enhanced tooltip with system info
    const indicator = document.getElementById('health-indicator');
    indicator.title = `
System Status: ${health.status || 'unknown'}
Version: ${health.version || '2.0.1'}
Agents: ${health.components?.agentManager?.stats?.loaded || 0}
Data Sources: ${health.components?.dataManager?.loaded || 0}
Last Check: ${new Date().toLocaleTimeString()}
    `.trim();
    
  } catch (error) {
    healthDot.className = 'health-dot health-red';
    healthText.textContent = 'Error';
    console.error('Health check failed:', error);
  }
}

// ===============================
// ENHANCED: Update system status display with better error handling
// ===============================
async function updateSystemStatus() {
  try {
    // Try both API endpoints for compatibility
    let response;
    let health;
    
    try {
      response = await fetch('/api/system/health');
      health = await response.json();
    } catch (error) {
      // Fallback to legacy endpoint
      response = await fetch('/health');
      health = await response.json();
    }
    
    const statusElement = document.getElementById('status');
    if (statusElement) {
      const mode = health.agentMode || 'simple';
      const actions = health.useActions !== undefined ? health.useActions : false;
      const version = health.version || '2.0.1';
      
      statusElement.textContent = `System Status: Ready - Mode: ${mode} | Actions: ${actions ? 'enabled' : 'disabled'} | v${version}`;
    }
    
    // Update GMP indicators
    const gmpStatus = document.getElementById('gmp-status');
    if (gmpStatus) {
      gmpStatus.textContent = health.status === 'ok' ? 'Active' : 'Warning';
    }
    
    // Update manual version display
    const manualVersion = document.getElementById('manual-version');
    if (manualVersion && health.version) {
      manualVersion.textContent = `v${health.version}`;
    }
    
    // Update health indicator
    updateHealthIndicator();
    
  } catch (error) {
    console.error('Status update failed:', error);
    
    // Fallback values when API fails
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = 'System Status: Ready - Mode: simple | Actions: disabled | v2.0.1';
    }
    
    // Update health indicator to show error
    const healthDot = document.getElementById('health-dot');
    const healthText = document.getElementById('health-text');
    if (healthDot && healthText) {
      healthDot.className = 'health-dot health-red';
      healthText.textContent = 'API Error';
    }
  }
}

// ===============================
// Clear output function
// ===============================
function clearOutput() {
  document.getElementById('out').textContent = 
    'Pharmaceutical Manufacturing Agent System Ready...\n' +
    'MVP 1.2 Modular Architecture\n' +
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
    const res = await fetch("/api/chat", {  // UPDATED: new modular API endpoint
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
    const eventsInfo = data.eventChainTriggered?.length ? `Events: ${data.eventChainTriggered.join(', ')} | ` : '';
    const timeInfo = `Time: ${processingTime}ms`;
    
    out.textContent += `\n\n[${new Date().toLocaleTimeString()}] ${agentInfo}${eventsInfo}${timeInfo}\n${data.response}`;
    out.scrollTop = out.scrollHeight;

    // Update metrics if element exists
    const metrics = document.getElementById("metrics");
    if (metrics) {
      metrics.textContent = `Last operation: ${agentInfo}${eventsInfo}${timeInfo}`;
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
// ENHANCED: Auto-refresh templates and version
// ===============================
setInterval(async () => {
  try {
    const response = await fetch('/api/agents');  // UPDATED: new API endpoint
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
    
    // Also refresh version info periodically
    loadVersionInfo();
    
  } catch (error) {
    // Silent fail for background refresh
  }
}, 30000); // Check every 30 seconds

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
    else if (data.type === "agent_event") wrapper.classList.add("event-agent");  // NEW: agent events
    else if (data.type === "auto_triggered_agent") wrapper.classList.add("event-auto");  // NEW: auto-triggered
    else wrapper.classList.add("event-error");

    const icon = {
      received: "📥",
      published: "📤",
      "agent-action": "🤖",
      "agent_event": "🔄",  // NEW
      "auto_triggered_agent": "⚡",  // NEW
      audit: "📝",
      chat: "💬",
      tool: "🔧",
      error: "⚠️",
      connection: "🔌"
    }[data.type] || "ℹ️";

    const ts = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    wrapper.textContent = `[${ts}] ${icon} ${data.type.toUpperCase()} | ${data.topic || data.agent || data.sourceAgent || data.triggeredAgent || ""} | ${JSON.stringify(data.payload || data.action || data.details || data.message || data.eventType || {})}`;

    monitor.appendChild(wrapper);
  });

  monitor.scrollTop = monitor.scrollHeight;
}

function clearEvents() {
  allEvents = [];
  renderEvents();
}

// ===============================
// NEW: Response action functions
// ===============================
function copyResponse() {
  const responseText = document.getElementById("claude-text").innerText;
  navigator.clipboard.writeText(responseText).then(() => {
    console.log('Response copied to clipboard');
  });
}

function exportResponse() {
  const responseText = document.getElementById("claude-text").innerText;
  const blob = new Blob([responseText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agent-response-${new Date().toISOString().slice(0,19)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function clearResponse() {
  document.getElementById("claude-response").style.display = 'none';
}