// app.js - Complete Phase 2 Manufacturing Agent System
import express from "express";
import { WebSocketServer } from 'ws';
import 'dotenv/config';

// Phase 2 imports
import { EventBus } from './src/services/EventBus.js';
import { WorkflowOrchestrator } from './src/services/WorkflowOrchestrator.js';

const app = express();
const port = process.env.PORT || 4000;

// Simple in-memory data store
let appData = {
  orders: [],
  inventory: [],
  bom: {},
  rules: [],
  masterdata: {}
};

// Load data from JSON files
try {
  const fs = await import('fs');
  const path = await import('path');
  
  const dataFiles = [
    './data.json',
    './src/services/data/orders.json',
    './src/services/data/masterdata.json'
  ];
  
  for (const file of dataFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(data)) {
        appData.orders = data;
      } else {
        Object.assign(appData, data);
      }
      console.log(`Loaded data from ${file}`);
    } catch (e) {
      // Continue to next file
    }
  }
} catch (e) {
  console.log('Using default empty data');
}

// Initialize services for Phase 1 & 2 (with graceful fallbacks)
let services = {};

try {
  // Phase 1 services
  try {
    const { UnifiedLLMClient } = await import('./src/services/llm/UnifiedLLMClient.js');
    services.llm = new UnifiedLLMClient({
      defaultProvider: 'claude',
      fallbackChain: ['claude', 'openai'],
      timeout: 30000,
      retries: 2
    });
    console.log('LLM service initialized');
  } catch (e) {
    console.log('LLM service not available:', e.message);
  }

  try {
    const { RouterService } = await import('./src/services/RouterService.js');
    const { AgentRegistry } = await import('./src/services/AgentRegistry.js');
    const { AgentRuntime } = await import('./src/services/AgentRuntime.js');
    
    services.registry = new AgentRegistry('./agents.json');
    services.runtime = new AgentRuntime({
      registry: services.registry,
      rootDir: process.cwd()
    });
    services.router = new RouterService({
      registry: services.registry,
      runtime: services.runtime,
      data: appData,
      llm: services.llm
    });
    console.log('Phase 1 agent services initialized');
  } catch (e) {
    console.log('Phase 1 agent services not available:', e.message);
  }

  // Phase 2 services
  try {
    services.eventBus = new EventBus();
    console.log('Phase 2 Event Bus initialized');

    if (services.router) {
      services.workflow = new WorkflowOrchestrator({
        router: services.router,
        eventBus: services.eventBus
      });
      console.log('Phase 2 Workflow Orchestrator initialized');
    }
  } catch (e) {
    console.log('Phase 2 services not available:', e.message);
  }
  
} catch (error) {
  console.log('Services initialization failed, using fallback mode');
}

// Basic middleware
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

// Simple auth middleware
const auth = (req, res, next) => {
  const key = req.headers['x-api-key'];
  const validKeys = [process.env.USER_API_KEY, process.env.ADMIN_API_KEY, 'user-123', 'admin-123'];
  
  if (!validKeys.includes(key)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  req.locals = { 
    data: appData,
    services,
    isAdmin: key === process.env.ADMIN_API_KEY || key === 'admin-123'
  };
  next();
};

// ===== ROUTES =====

// Health check with Phase 2 status
app.get('/health', (req, res) => {
  const healthInfo = {
    ok: true,
    timestamp: new Date().toISOString(),
    orders: appData.orders.length,
    services: {
      llm: services.llm?.isAvailable?.() || false,
      router: !!services.router,
      registry: !!services.registry,
      runtime: !!services.runtime,
      eventBus: !!services.eventBus,
      workflow: !!services.workflow
    },
    phase: services.eventBus ? 'Phase 2 - Event-Driven' : 'Phase 1 - A2A Communication'
  };
  
  // Add service metrics if available
  if (services.router?.getMetrics) {
    try {
      healthInfo.metrics = { routing: services.router.getMetrics() };
    } catch (e) {
      // Ignore metrics errors
    }
  }
  
  if (services.eventBus?.getMetrics) {
    try {
      healthInfo.metrics = {
        ...healthInfo.metrics,
        events: services.eventBus.getMetrics()
      };
    } catch (e) {
      // Ignore
    }
  }
  
  if (services.workflow?.getMetrics) {
    try {
      healthInfo.metrics = {
        ...healthInfo.metrics,
        workflows: services.workflow.getMetrics()
      };
    } catch (e) {
      // Ignore
    }
  }
  
  res.json(healthInfo);
});

// Enhanced chat endpoint with Phase 2 integration
app.post('/api/chat', auth, async (req, res) => {
  try {
    const { message, promptId } = req.body;
    
    // Handle prompt templates
    let text = message;
    if (!text && promptId) {
      const templates = {
        'ask-today-orders': 'Morgen-Briefing: welche Aufträge freigabebereit?',
        'general-assessment': 'Bewerte Produktionsfreigabe (nächste 24h)',
        'batch-release': 'Batch-Freigabe durchführen',
        'schedule-line': 'Schedule FG-123 2000 Stk auf PCK-01',
        'qa-prioritize': 'QA-Priorisierung für FG-123 1000 Stk',
        'supply-check': 'Supply Chain Status prüfen',
        'morning-briefing': 'Vollständiges Morgen-Briefing',
        'workflow-batch-release': 'Vollständiger Batch-Release Workflow',
        'workflow-morning-planning': 'Tägliche Produktionsplanung Workflow',
        'test-event-publish': 'Test Event Publishing'
      };
      text = templates[promptId] || promptId;
    }
    
    if (!text?.trim()) {
      return res.status(400).json({ error: 'Message or promptId required' });
    }

    // Handle Phase 2 workflow requests
    if (promptId && promptId.startsWith('workflow-')) {
      if (services.workflow) {
        try {
          let workflowId;
          if (promptId === 'workflow-batch-release') {
            workflowId = 'batch_release_complete';
          } else if (promptId === 'workflow-morning-planning') {
            workflowId = 'morning_production_planning';
          }
          
          if (workflowId) {
            const execution = await services.workflow.executeWorkflow(workflowId, {
              data: appData,
              triggeredBy: 'chat_template'
            });
            
            return res.json({
              ok: true,
              mode: 'workflow',
              workflowId,
              execution: {
                id: execution.id,
                status: execution.status,
                steps: execution.steps.length,
                duration: execution.endTime - execution.startTime
              },
              result: execution.context.lastStepResult,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Workflow execution failed:', error);
          // Fall through to normal processing
        }
      }
    }

    // Handle test event publishing
    if (promptId === 'test-event-publish' && services.eventBus) {
      try {
        const result = await services.eventBus.publish('test.event', {
          message: 'Test event from chat interface',
          timestamp: new Date().toISOString()
        }, 'chat');
        
        return res.json({
          ok: true,
          mode: 'event',
          event: result.event,
          notified: result.results.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Event publishing failed:', error);
      }
    }

    let parsed = {};
    let result = {};

    // Try enhanced LLM parsing first if available
    if (services.llm?.isAvailable?.()) {
      try {
        parsed = await services.llm.parseManufacturingCommand(text);
        console.log('LLM parsing successful', parsed);
      } catch (error) {
        console.warn('LLM parsing failed, falling back to regex:', error.message);
        parsed = parseMessageRegex(text);
      }
    } else {
      parsed = parseMessageRegex(text);
    }

    // Determine intent
    const intent = determineIntent(text, parsed);
    
    // Route through enhanced router if available
    if (services.router) {
      try {
        const routingResult = await services.router.route({
          intent,
          context: { 
            ...parsed, 
            data: appData,
            eventBus: services.eventBus  // Pass EventBus to agents
          },
          text
        });
        
        result = routingResult.result;
        
        // Add routing metadata
        result._routing = {
          via: routingResult.via,
          agent: routingResult.agent,
          responseTime: routingResult._meta?.responseTime
        };
        
      } catch (error) {
        console.error('Router failed, falling back to direct execution:', error.message);
        result = await handleBusinessRequestDirect(intent, parsed, appData);
      }
    } else {
      // Fallback to direct execution
      result = await handleBusinessRequestDirect(intent, parsed, appData);
    }
    
    res.json({ 
      ok: true, 
      intent,
      parsed, 
      result,
      phase: services.eventBus ? 'Phase 2' : 'Phase 1',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Enhanced agent invoke endpoint with Phase 2 support
app.post('/api/agent', auth, async (req, res) => {
  try {
    const { intent, context = {} } = req.body;
    
    if (!intent) {
      return res.status(400).json({ error: 'Intent required' });
    }

    let result;
    
    // Use enhanced router if available
    if (services.router) {
      try {
        const routingResult = await services.router.route({
          intent,
          context: { 
            ...context, 
            data: appData,
            eventBus: services.eventBus  // Pass EventBus to agents
          }
        });
        
        result = {
          ...routingResult.result,
          _routing: {
            via: routingResult.via,
            agent: routingResult.agent,
            responseTime: routingResult._meta?.responseTime
          }
        };
      } catch (error) {
        console.error('Router failed:', error.message);
        result = await routeIntentDirect(intent, context, appData);
      }
    } else {
      // Fallback to namespace routing
      result = await routeIntentDirect(intent, context, appData);
    }
    
    res.json({ 
      intent, 
      result,
      phase: services.eventBus ? 'Phase 2' : 'Phase 1'
    });
    
  } catch (error) {
    console.error('Agent endpoint error:', error);
    res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Phase 2 Workflow endpoints
app.post('/api/workflow/:workflowId', auth, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const context = req.body.context || {};
    
    if (!services.workflow) {
      return res.status(503).json({ 
        error: 'Workflow service not available',
        fallback: 'Try using individual agent endpoints instead'
      });
    }
    
    const execution = await services.workflow.executeWorkflow(workflowId, {
      ...context,
      data: appData,
      triggeredBy: 'api',
      userId: req.user?.email || 'anonymous'
    });
    
    res.json({
      ok: true,
      execution: {
        id: execution.id,
        workflowId: execution.workflowId,
        name: execution.name,
        status: execution.status,
        steps: execution.steps.length,
        totalSteps: execution.totalSteps,
        duration: execution.endTime ? execution.endTime - execution.startTime : null,
        startTime: new Date(execution.startTime).toISOString(),
        endTime: execution.endTime ? new Date(execution.endTime).toISOString() : null
      }
    });
    
  } catch (error) {
    console.error('Workflow execution failed:', error);
    res.status(500).json({ 
      error: error.message,
      workflowId: req.params.workflowId
    });
  }
});

// Get workflow execution status
app.get('/api/workflow/:workflowId/:executionId', auth, (req, res) => {
  try {
    if (!services.workflow) {
      return res.status(503).json({ error: 'Workflow service not available' });
    }
    
    const execution = services.workflow.getExecution(req.params.executionId);
    
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }
    
    res.json({
      ok: true,
      execution: {
        id: execution.id,
        workflowId: execution.workflowId,
        name: execution.name,
        status: execution.status,
        currentStep: execution.currentStepIndex + 1,
        totalSteps: execution.totalSteps,
        steps: execution.steps,
        error: execution.error,
        startTime: new Date(execution.startTime).toISOString(),
        endTime: execution.endTime ? new Date(execution.endTime).toISOString() : null
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List available workflows
app.get('/api/workflows', auth, (req, res) => {
  if (!services.workflow) {
    return res.json({ workflows: [], message: 'Workflow service not available' });
  }
  
  res.json({
    ok: true,
    workflows: services.workflow.getWorkflows()
  });
});

// Phase 2 Event endpoints
app.post('/api/events/:eventType', auth, async (req, res) => {
  try {
    const { eventType } = req.params;
    const payload = req.body;
    
    if (!services.eventBus) {
      return res.status(503).json({ error: 'Event Bus service not available' });
    }
    
    const result = await services.eventBus.publish(eventType, payload, 'api');
    
    res.json({
      ok: true,
      event: {
        id: result.event.id,
        type: result.event.type,
        timestamp: result.event.timestamp
      },
      notifiedAgents: result.results.length,
      successful: result.results.filter(r => r.success).length,
      failed: result.results.filter(r => !r.success).length
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Event history endpoint
app.get('/api/events', auth, (req, res) => {
  if (!services.eventBus) {
    return res.json({ events: [], message: 'Event Bus service not available' });
  }
  
  const filters = {
    eventType: req.query.type,
    source: req.query.source,
    since: req.query.since,
    limit: req.query.limit ? parseInt(req.query.limit) : 50
  };
  
  const events = services.eventBus.getEventHistory(filters);
  
  res.json({
    ok: true,
    events,
    total: events.length,
    filters
  });
});

// Event subscriptions info (admin only)
app.get('/api/events/subscriptions', auth, (req, res) => {
  if (!req.locals.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  if (!services.eventBus) {
    return res.json({ subscriptions: {}, message: 'Event Bus service not available' });
  }
  
  res.json({
    ok: true,
    subscriptions: services.eventBus.getSubscriptions(),
    metrics: services.eventBus.getMetrics()
  });
});

// Manufacturing-specific workflow shortcuts
app.post('/api/manufacturing/batch-release-workflow', auth, async (req, res) => {
  try {
    if (!services.workflow) {
      // Fallback to simple batch release
      const result = await handleMAR('mar.batch_release', req.body, appData);
      return res.json({ ok: true, result, mode: 'fallback' });
    }
    
    const execution = await services.workflow.executeWorkflow('batch_release_complete', {
      ...req.body,
      data: appData
    });
    
    res.json({
      ok: true,
      mode: 'workflow',
      execution: {
        id: execution.id,
        status: execution.status,
        steps: execution.steps.length
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Service metrics endpoint with Phase 2 metrics
app.get('/admin/metrics', auth, (req, res) => {
  if (!req.locals.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const metrics = {
    orders: appData.orders.length,
    pending: appData.orders.filter(o => !o.status || o.status === 'pending').length,
    inventory: appData.inventory.length,
    rules: appData.rules.length,
    uptime: process.uptime(),
    phase: services.eventBus ? 'Phase 2 - Event-Driven' : 'Phase 1 - A2A Communication'
  };
  
  // Add service metrics if available
  if (services.router?.getMetrics) {
    try {
      metrics.routing = services.router.getMetrics();
    } catch (e) {
      // Ignore
    }
  }
  
  if (services.llm?.getMetrics) {
    try {
      metrics.llm = services.llm.getMetrics();
    } catch (e) {
      // Ignore
    }
  }
  
  // Phase 2 metrics
  if (services.eventBus?.getMetrics) {
    try {
      metrics.eventBus = services.eventBus.getMetrics();
    } catch (e) {
      // Ignore
    }
  }
  
  if (services.workflow?.getMetrics) {
    try {
      metrics.workflows = services.workflow.getMetrics();
    } catch (e) {
      // Ignore
    }
  }
  
  res.json(metrics);
});

// ===== HELPER FUNCTIONS =====

// Regex-based message parsing (fallback)
function parseMessageRegex(message) {
  const material = message.match(/FG-\d+/i)?.[0]?.toUpperCase() || null;
  const qtyMatch = message.match(/(\d+)\s*stk/i);
  const qty = qtyMatch ? parseInt(qtyMatch[1]) : null;
  const line = message.match(/PCK-\d+/i)?.[0]?.toUpperCase() || null;
  const country = message.match(/\b(EU|US|CH|DE|FR|ROW)\b/i)?.[1]?.toUpperCase() || null;
  const dateMatch = message.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : null;
  
  return { material, qty, line, country, date, priority: null };
}

// Intent determination logic
function determineIntent(message, parsed) {
  if (/freigabe|release|batch/i.test(message)) {
    return 'mar.batch_release';
  }
  if (/briefing|status|übersicht/i.test(message)) {
    return 'mar.assess_orders';
  }
  if (/schedule|plane|linie/i.test(message)) {
    return 'mar.schedule_line';
  }
  if (/qa|quality|prüf/i.test(message)) {
    return 'qa.prioritize';
  }
  if (/transport|ship/i.test(message)) {
    return 'cmo.book_transport';
  }
  
  return 'mar.assess_orders'; // Default
}

// Direct business request handling (fallback)
async function handleBusinessRequestDirect(intent, parsed, data) {
  switch (intent) {
    case 'mar.assess_orders':
      return await assessOrders(data);
    case 'mar.batch_release':
      return await batchRelease(data, parsed.confirm);
    case 'mar.schedule_line':
      return await scheduleLine(parsed, data);
    default:
      return { ok: false, error: 'Unknown intent', intent };
  }
}

// Direct intent routing (fallback)
async function routeIntentDirect(intent, context, data) {
  const [namespace] = intent.split('.');
  
  switch (namespace) {
    case 'mar':
      return handleMAR(intent, context, data);
    case 'cmo':
      return handleCMO(intent, context, data);
    case 'qa':
      return handleQA(intent, context, data);
    default:
      return { ok: false, error: `Unknown namespace: ${namespace}` };
  }
}

function handleMAR(intent, context, data) {
  switch (intent) {
    case 'mar.assess_orders':
      return assessOrders(data);
    case 'mar.batch_release':
      return batchRelease(data, context.confirm);
    case 'mar.schedule_line':
      return scheduleLine(context, data);
    case 'mar.qa_prioritize':
      return { ok: true, prioritized: context.materials || [] };
    default:
      return { ok: false, error: `Unknown MAR intent: ${intent}` };
  }
}

function handleCMO(intent, context, data) {
  switch (intent) {
    case 'cmo.create_pr':
      return { 
        ok: true, 
        pr: `PR-${Date.now()}`, 
        materials: context.materials || [],
        status: 'created'
      };
    case 'cmo.create_po':
      return { 
        ok: true, 
        po: `PO-${Date.now()}`, 
        pr: context.pr,
        status: 'created'
      };
    case 'cmo.book_transport':
      return {
        ok: true,
        booking: `TRP-${Date.now()}`,
        route: context.route || 'Standard',
        pickup: context.pickup || 'Warehouse A'
      };
    default:
      return { ok: false, error: `Unknown CMO intent: ${intent}` };
  }
}

function handleQA(intent, context, data) {
  switch (intent) {
    case 'qa.prioritize':
      return {
        ok: true,
        prioritized: context.materials || [],
        inspectionPlan: `QA-${Date.now()}`,
        estimatedTime: '2-4 hours'
      };
    case 'qa.inspect_batch':
      return {
        ok: true,
        batchId: context.batchId,
        status: 'inspection_scheduled',
        inspector: 'QA-Agent-001'
      };
    default:
      return { ok: false, error: `Unknown QA intent: ${intent}` };
  }
}

// Enhanced order assessment
async function assessOrders(data) {
  const orders = data.orders.filter(o => !o.status || o.status === 'pending');
  const results = [];
  
  for (const order of orders) {
    const assessment = assessSingleOrder(order, data);
    results.push({
      orderId: order.id,
      material: order.material,
      qty: order.qty,
      assessment
    });
  }
  
  const releasable = results.filter(r => r.assessment.ok);
  const blocked = results.filter(r => !r.assessment.ok);
  
  return {
    ok: true,
    summary: `${releasable.length}/${results.length} orders ready for release`,
    total: results.length,
    releasable: releasable.map(r => ({
      orderId: r.orderId,
      material: r.material,
      qty: r.qty
    })),
    blocked: blocked.map(r => ({
      orderId: r.orderId,
      material: r.material,
      missing: r.assessment.missing
    })),
    actions: releasable.length > 0 ? [
      { 
        id: 'batch_release', 
        label: `Release ${releasable.length} orders`,
        payload: { intent: 'mar.batch_release', confirm: true }
      }
    ] : []
  };
}

async function batchRelease(data, confirm = false) {
  const orders = data.orders.filter(o => 
    (!o.status || o.status === 'pending') && 
    assessSingleOrder(o, data).ok
  );
  
  if (!confirm) {
    return {
      ok: true,
      summary: `${orders.length} orders ready for batch release`,
      orders: orders.map(o => ({ id: o.id, material: o.material, qty: o.qty })),
      requiresConfirmation: true
    };
  }
  
  // Execute release
  const released = orders.map(order => {
    order.status = 'released';
    order.releasedAt = new Date().toISOString();
    order.batch = `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    return {
      orderId: order.id,
      material: order.material,
      batch: order.batch
    };
  });
  
  return {
    ok: true,
    summary: `Batch release completed: ${released.length} orders released`,
    released
  };
}

async function scheduleLine(context, data) {
  const { material, qty, line, date } = context;
  
  return {
    ok: true,
    schedule: {
      material: material || 'FG-123',
      qty: qty || 1000,
      line: line || 'PCK-01',
      scheduledDate: date || new Date().toISOString().split('T')[0],
      estimatedDuration: Math.ceil((qty || 1000) / 100), // hours
      scheduleId: `SCH-${Date.now()}`
    }
  };
}

function assessSingleOrder(order, data) {
  const material = order.material;
  const qty = order.qty || 0;
  
  // BOM check
  const bom = data.bom[material] || [];
  const needs = bom.map(b => ({
    component: b.component,
    need: qty * (b.perFG || 0)
  }));
  
  // Inventory check
  const missing = needs.filter(n => {
    const stock = data.inventory.find(i => i.material === n.component)?.qty || 0;
    return stock < n.need;
  });
  
  // TRIC rules check
  const rules = data.rules.filter(r => 
    r.material === material && 
    r.country === (order.country || 'EU')
  );
  const tricOk = rules.every(r => r.status !== 'notallowed');
  
  // RMSL check (simplified)
  const rmslRule = rules.find(r => r.type === 'RMSL');
  const bulkId = `BULK-${material.split('-')[1] || ''}`;
  const bulk = data.inventory.find(i => i.material === bulkId);
  const rmslOk = !rmslRule || (bulk?.rmslPct || 100) >= (rmslRule.minPct || 0);
  
  // Master data check
  const md = data.masterdata[material];
  const mdOk = md?.status === 'Active';
  
  const ok = tricOk && rmslOk && mdOk && missing.length === 0;
  
  return { 
    ok, 
    tricOk, 
    rmslOk, 
    mdOk, 
    missing, 
    needs,
    bomCount: bom.length
  };
}

// WebSocket for real-time updates
const server = app.listen(port, () => {
  console.log(`Phase 2 Manufacturing Agent System running on http://localhost:${port}`);
});

const wss = new WebSocketServer({ server, path: '/events' });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  ws.send(JSON.stringify({ 
    type: 'connected', 
    timestamp: new Date().toISOString(),
    phase: services.eventBus ? 'Phase 2' : 'Phase 1'
  }));
});

// Broadcast function for real-time updates
global.broadcast = (event) => {
  const message = JSON.stringify(event);
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
};