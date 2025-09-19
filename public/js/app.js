/**
 * Pharmaceutical Manufacturing Agent System - Phase 2
 * Client-side JavaScript for McKinsey Professional Interface
 */

let isProcessing = false;
let systemPhase = 'Unknown';

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    setTimeout(checkHealth, 500);
});

function initializeEventListeners() {
    // Main send button
    document.getElementById('send').addEventListener('click', async () => {
        if (isProcessing) return;
        
        const promptId = document.getElementById('prompt').value;
        let message = document.getElementById('message').value;
        
        if (!message && !promptId) { 
            showError('Please enter a manufacturing command or select a template'); 
            return; 
        }
        
        await sendMessage({ message, promptId });
    });

    // Auto-clear message when template is selected
    document.getElementById('prompt').addEventListener('change', function() {
        if (this.value) {
            document.getElementById('message').value = '';
        }
    });
}

async function sendMessage(payload) {
    isProcessing = true;
    const button = document.getElementById('send');
    const statusDiv = document.getElementById('status');
    
    button.disabled = true;
    button.textContent = 'Processing Manufacturing Operation...';
    statusDiv.textContent = 'Processing manufacturing command through AI agents...';
    statusDiv.className = 'status';
    
    const startTime = Date.now();
    
    try {
        const resp = await fetch('/api/chat', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'x-api-key': 'user-123' 
            },
            body: JSON.stringify(payload)
        });
        
        const json = await resp.json();
        const responseTime = Date.now() - startTime;
        
        if (resp.ok) {
            displayResponse(json, responseTime);
            updateGMPStatus(json);
            statusDiv.textContent = `Operation completed successfully (${responseTime}ms) - Phase: ${json.phase || 'Unknown'}`;
            statusDiv.className = 'status';
            systemPhase = json.phase || 'Phase 1';
        } else {
            showError(`HTTP ${resp.status}: ${json.error || 'Unknown manufacturing system error'}`);
        }
        
    } catch (error) {
        showError(`Network Communication Error: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = 'Execute Manufacturing Command';
        isProcessing = false;
    }
}

async function executeWorkflow(workflowId) {
    if (isProcessing) return;
    
    try {
        const resp = await fetch(`/api/workflow/${workflowId}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'x-api-key': 'user-123' 
            },
            body: JSON.stringify({ context: { triggeredBy: 'ui_workflow_button' } })
        });
        
        const json = await resp.json();
        displayResponse(json, 0);
        
        if (json.ok) {
            document.getElementById('status').textContent = 
                `Workflow "${workflowId}" executed successfully - Steps: ${json.execution.steps}`;
            document.getElementById('status').className = 'status';
        }
        
    } catch (error) {
        showError(`Workflow Execution Error: ${error.message}`);
    }
}

async function publishEvent(eventType, payload) {
    try {
        const resp = await fetch(`/api/events/${eventType}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'x-api-key': 'user-123' 
            },
            body: JSON.stringify(payload)
        });
        
        const json = await resp.json();
        displayResponse(json, 0);
        
        if (json.ok) {
            document.getElementById('status').textContent = 
                `Event "${eventType}" published - Agents notified: ${json.notifiedAgents}`;
            document.getElementById('status').className = 'status';
        }
        
    } catch (error) {
        showError(`Event Publishing Error: ${error.message}`);
    }
}

async function getEventHistory() {
    try {
        const resp = await fetch('/api/events?limit=20', {
            headers: { 'x-api-key': 'user-123' }
        });
        const json = await resp.json();
        displayResponse(json, 0);
        
    } catch (error) {
        showError(`Event History Error: ${error.message}`);
    }
}

async function testAgent(intent) {
    await sendAgentMessage({ intent, context: { test: true, gmp_audit: true } });
}

async function sendAgentMessage(payload) {
    isProcessing = true;
    
    try {
        const resp = await fetch('/api/agent', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'x-api-key': 'user-123' 
            },
            body: JSON.stringify(payload)
        });
        
        const json = await resp.json();
        displayResponse(json, 0);
        updateGMPStatus(json);
        
    } catch (error) {
        showError(`Agent Communication Error: ${error.message}`);
    } finally {
        isProcessing = false;
    }
}

async function checkHealth() {
    try {
        const resp = await fetch('/health');
        const json = await resp.json();
        displayResponse(json, 0);
        
        const services = json.services || {};
        const activeServices = Object.entries(services).filter(([k,v]) => v).map(([k,v]) => k);
        systemPhase = json.phase || 'Phase 1';
        
        document.getElementById('status').textContent = 
            `System Status: ${json.phase} - Active Services: ${activeServices.join(', ') || 'Fallback Mode Only'}`;
        document.getElementById('status').className = 'status';
            
        updateGMPIndicators(json);
            
    } catch (error) {
        showError(`Health Check Error: ${error.message}`);
    }
}

async function getMetrics() {
    try {
        const resp = await fetch('/admin/metrics', {
            headers: { 'x-api-key': 'admin-123' }
        });
        const json = await resp.json();
        displayResponse(json, 0);
        updateGMPMetrics(json);
    } catch (error) {
        showError('GMP Metrics require admin access');
    }
}

function displayResponse(json, responseTime) {
    const output = document.getElementById('out');
    const metrics = document.getElementById('metrics');
    
    const timestamp = new Date().toISOString();
    const auditHeader = `
=== GMP AUDIT LOG ENTRY ===
Timestamp: ${timestamp}
System Phase: ${systemPhase}
Response Time: ${responseTime}ms
Operation ID: ${json.result?.batchId || json.execution?.id || 'N/A'}
==========================
`;
    
    output.textContent = auditHeader + JSON.stringify(json, null, 2);
    
    let metricsText = `Response: ${responseTime}ms`;
    
    if (json.result?._routing) {
        const routing = json.result._routing;
        metricsText += ` | Route: ${routing.via} | Agent: ${routing.agent || 'fallback'}`;
        if (routing.responseTime) {
            metricsText += ` | Agent: ${routing.responseTime}ms`;
        }
    }
    
    if (json._routing) {
        const routing = json._routing;
        metricsText += ` | Route: ${routing.via} | Agent: ${routing.agent || 'fallback'}`;
    }
    
    if (json.result?.phase2Features) {
        metricsText += ` | Event-Driven: ${json.result.phase2Features.eventDriven ? 'YES' : 'NO'}`;
    }
    
    if (json.phase) {
        metricsText += ` | System: ${json.phase}`;
    }
    
    metrics.textContent = metricsText;
}

function updateGMPStatus(json) {
    if (json.result?.batchId) {
        document.getElementById('audit-trail').textContent = 'Logged';
    }
    
    if (json.result?._routing?.via === 'in-process') {
        document.getElementById('data-integrity').textContent = 'Verified';
    }
}

function updateGMPIndicators(healthData) {
    const gmpStatus = document.getElementById('gmp-status');
    const dataIntegrity = document.getElementById('data-integrity');
    const auditTrail = document.getElementById('audit-trail');
    
    if (healthData.services?.eventBus) {
        gmpStatus.textContent = 'Active (Phase 2)';
        auditTrail.textContent = 'Event-Driven';
    } else {
        gmpStatus.textContent = 'Basic (Phase 1)';
    }
    
    if (healthData.services?.router) {
        dataIntegrity.textContent = 'Agent-Validated';
    }
}

function updateGMPMetrics(metricsData) {
    const metrics = document.getElementById('metrics');
    let gmpMetrics = 'GMP Compliance Metrics: ';
    
    if (metricsData.eventBus) {
        gmpMetrics += `Events: ${metricsData.eventBus.eventsPublished} | `;
        gmpMetrics += `Success Rate: ${(metricsData.eventBus.successRate * 100).toFixed(1)}% | `;
    }
    
    if (metricsData.routing) {
        gmpMetrics += `Agent Calls: ${metricsData.routing.totalCalls} | `;
        gmpMetrics += `Agent Success: ${(metricsData.routing.successRate * 100).toFixed(1)}% | `;
    }
    
    if (metricsData.workflows) {
        gmpMetrics += `Workflows: ${metricsData.workflows.totalExecutions} | `;
        gmpMetrics += `Workflow Success: ${(metricsData.workflows.successRate * 100).toFixed(1)}%`;
    }
    
    metrics.textContent = gmpMetrics;
}

function showError(message) {
    const statusDiv = document.getElementById('status');
    const output = document.getElementById('out');
    
    statusDiv.textContent = `Error: ${message}`;
    statusDiv.className = 'status error';
    
    const errorLog = `
=== GMP ERROR LOG ===
Timestamp: ${new Date().toISOString()}
Error: ${message}
System Phase: ${systemPhase}
==================
`;
    
    output.textContent = errorLog + `Error: ${message}`;
}

function clearOutput() {
    document.getElementById('out').textContent = 'Output cleared...';
    document.getElementById('metrics').textContent = 'Waiting for operation metrics...';
}

// Global functions for button onclick handlers
window.executeWorkflow = executeWorkflow;
window.publishEvent = publishEvent;
window.getEventHistory = getEventHistory;
window.testAgent = testAgent;
window.checkHealth = checkHealth;
window.getMetrics = getMetrics;
window.clearOutput = clearOutput;