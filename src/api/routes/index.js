/**
 * ========================================================================
 * API ROUTES - MAIN ROUTER
 * ========================================================================
 * 
 * Centralized routing system for all API endpoints
 * Modular route organization for better maintainability
 * Enhanced with A2A Workflow endpoints
 * 
 * Developer: Markus Schmeckenbecher
 * Version: 2.0.2 - A2A Workflow Integration
 * ========================================================================
 */

import express from "express";
import { readFileSync } from "fs";

// Read package.json for dynamic versioning
let packageJson;
try {
  packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
} catch (error) {
  packageJson = { version: "2.0.2" }; // Fallback version
}

// ========================================================================
// MAIN ROUTER FACTORY
// ========================================================================

export function createRoutes(agentManager, dataManager, eventBusManager, auditLogger) {
  const router = express.Router();

  // Register all route modules
  router.use("/chat", createChatRoutes(agentManager, auditLogger, eventBusManager));
  router.use("/agents", createAgentRoutes(agentManager));
  router.use("/data", createDataRoutes(dataManager));
  router.use("/events", createEventRoutes(eventBusManager));
  router.use("/audit", createAuditRoutes(auditLogger));
  router.use("/system", createSystemRoutes(agentManager, dataManager, eventBusManager));
  router.use("/workflows", createWorkflowRoutes(agentManager)); // NEW: A2A Workflow Routes
  router.use("/a2a", createA2ARoutes(agentManager)); // NEW: Enhanced A2A Routes

  return router;
}

export default createRoutes;

// ========================================================================
// CHAT ROUTES
// ========================================================================

function createChatRoutes(agentManager, auditLogger, eventBusManager) {
  const router = express.Router();

  /**
   * Main Chat Interface
   * Handles user interactions and triggers agents
   */
  router.post("/", async (req, res) => {
    const { message, user } = req.body;
    let agentUsed = null;
    let responseText = "";

    try {
      const agent = agentManager.findAgent(message);

      if (agent) {
        agentUsed = agent.id;
        responseText = await agentManager.processAgent(agent, message);
      } else {
        responseText = "No agent matched your request.";
      }

      // Log interaction
      auditLogger.logChatInteraction(user, agentUsed, message, responseText);

      res.json({ 
        response: responseText, 
        agentUsed, 
        eventChainTriggered: agent?.events?.publishes || [],
        timestamp: new Date().toISOString() 
      });
    } catch (e) {
      res.status(500).json({ 
        error: e.message, 
        timestamp: new Date().toISOString() 
      });
    }
  });

  return router;
}

// ========================================================================
// AGENT ROUTES
// ========================================================================

function createAgentRoutes(agentManager) {
  const router = express.Router();

  /**
   * Get All Agents
   */
  router.get("/", (req, res) => {
    res.json({ 
      agents: agentManager.getAllAgents(), 
      stats: agentManager.getStats(), 
      timestamp: new Date().toISOString() 
    });
  });

  /**
   * Get Agent Templates
   */
  router.get("/templates", (req, res) => {
    const templates = agentManager.getTemplates();
    res.json({ 
      templates, 
      count: templates.length, 
      timestamp: new Date().toISOString() 
    });
  });

  /**
   * Reload Agents
   */
  router.post("/reload", (req, res) => {
    try {
      const success = agentManager.reloadAgents();
      res.json({ 
        status: success ? "success" : "failed", 
        stats: agentManager.getStats(),
        timestamp: new Date().toISOString() 
      });
    } catch (error) {
      res.status(500).json({ 
        status: "error", 
        message: error.message,
        timestamp: new Date().toISOString() 
      });
    }
  });

  return router;
}

// ========================================================================
// DATA ROUTES
// ========================================================================

function createDataRoutes(dataManager) {
  const router = express.Router();

  /**
   * Get Data Overview
   */
  router.get("/", (req, res) => {
    const includeFullData = req.query.full === 'true';
    res.json(dataManager.getDataOverview(includeFullData));
  });

  /**
   * Get Data Statistics
   */
  router.get("/stats", (req, res) => {
    res.json({
      stats: dataManager.getDataStats(),
      loaded: dataManager.getLoadedDataKeys(),
      timestamp: new Date().toISOString()
    });
  });

  /**
   * Validate Data Integrity
   */
  router.get("/validate", (req, res) => {
    const requiredFiles = req.query.required ? req.query.required.split(',') : undefined;
    res.json(dataManager.validateDataIntegrity(requiredFiles));
  });

  /**
   * Reload Data
   */
  router.post("/reload", (req, res) => {
    try {
      const success = dataManager.reloadData();
      res.json({ 
        status: success ? "success" : "failed", 
        loaded: dataManager.getLoadedDataKeys(),
        timestamp: new Date().toISOString() 
      });
    } catch (error) {
      res.status(500).json({ 
        status: "error", 
        message: error.message,
        timestamp: new Date().toISOString() 
      });
    }
  });

  return router;
}

// ========================================================================
// EVENT ROUTES
// ========================================================================

function createEventRoutes(eventBusManager) {
  const router = express.Router();

  /**
   * Get Event Subscriptions
   */
  router.get("/subscriptions", (req, res) => {
    res.json(eventBusManager.getEventSubscriptions());
  });

  /**
   * Trigger Manual Event
   */
  router.post("/trigger", async (req, res) => {
    const { eventType, data, sourceAgent } = req.body;
    
    try {
      const subscribers = eventBusManager.getSubscribers(eventType);
      
      // Note: Manual triggering without agent processor
      // This is for testing event routing only
      
      res.json({ 
        status: "triggered", 
        eventType, 
        subscribers,
        timestamp: new Date().toISOString() 
      });
    } catch (error) {
      res.status(500).json({ 
        status: "error", 
        message: error.message,
        timestamp: new Date().toISOString() 
      });
    }
  });

  return router;
}

// ========================================================================
// AUDIT ROUTES
// ========================================================================

function createAuditRoutes(auditLogger) {
  const router = express.Router();

  /**
   * Get Audit Log
   */
  router.get("/", (req, res) => {
    const filter = {};
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    
    if (req.query.type) filter.type = req.query.type;
    if (req.query.agent) filter.agent = req.query.agent;
    if (req.query.startDate) filter.startDate = req.query.startDate;
    if (req.query.endDate) filter.endDate = req.query.endDate;

    const auditLog = auditLogger.getAuditLog(
      Object.keys(filter).length > 0 ? filter : null, 
      limit
    );
    res.json(auditLog);
  });

  /**
   * Get Audit Statistics
   */
  router.get("/stats", (req, res) => {
    res.json(auditLogger.getAuditStats());
  });

  /**
   * Archive Audit Log
   */
  router.post("/archive", (req, res) => {
    try {
      const archivePath = auditLogger.archiveAuditLog();
      res.json({ 
        status: archivePath ? "success" : "no_log_to_archive", 
        archivePath,
        timestamp: new Date().toISOString() 
      });
    } catch (error) {
      res.status(500).json({ 
        status: "error", 
        message: error.message,
        timestamp: new Date().toISOString() 
      });
    }
  });

  return router;
}

// ========================================================================
// NEW: WORKFLOW ROUTES (Option B - A2A Workflows)
// ========================================================================

function createWorkflowRoutes(agentManager) {
  const router = express.Router();

  /**
   * Execute Production Workflow
   */
  router.post("/production", async (req, res) => {
    try {
      const { orderId, orderData } = req.body;
      
      if (!agentManager.productionWorkflow) {
        return res.status(503).json({ 
          error: 'A2A workflows not available',
          message: 'ProductionWorkflow not initialized'
        });
      }

      const workflow = await agentManager.productionWorkflow.executeOrderAnalysisWorkflow(
        orderId || 'ORD-AUTO-' + Date.now(), 
        orderData || {}
      );

      res.json({
        success: true,
        workflow,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * Get Workflow Status and Statistics
   */
  router.get("/status", async (req, res) => {
    try {
      if (!agentManager.productionWorkflow) {
        return res.json({
          available: false,
          message: 'ProductionWorkflow not initialized'
        });
      }

      const stats = agentManager.productionWorkflow.getWorkflowStats();
      const activeWorkflows = agentManager.productionWorkflow.getActiveWorkflows();

      res.json({
        available: true,
        stats,
        activeWorkflows,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * Get Active Workflows
   */
  router.get("/active", async (req, res) => {
    try {
      if (!agentManager.productionWorkflow) {
        return res.json({ activeWorkflows: [] });
      }

      const activeWorkflows = agentManager.productionWorkflow.getActiveWorkflows();
      
      res.json({
        activeWorkflows,
        count: activeWorkflows.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * Cancel Workflow
   */
  router.delete("/:workflowId", async (req, res) => {
    try {
      const { workflowId } = req.params;
      const { reason = 'User requested cancellation' } = req.body;

      if (!agentManager.productionWorkflow) {
        return res.status(503).json({ 
          error: 'ProductionWorkflow not available'
        });
      }

      const cancelled = agentManager.productionWorkflow.cancelWorkflow(workflowId, reason);
      
      if (cancelled) {
        res.json({
          success: true,
          message: `Workflow ${workflowId} cancelled`,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(404).json({
          success: false,
          error: `Workflow ${workflowId} not found`,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}

// ========================================================================
// NEW: ENHANCED A2A ROUTES
// ========================================================================

function createA2ARoutes(agentManager) {
  const router = express.Router();

  /**
   * A2A System Status with Workflow Information
   */
  router.get("/status", async (req, res) => {
    try {
      const a2aStatus = {
        available: !!agentManager.a2aManager,
        workflowsEnabled: !!agentManager.productionWorkflow,
        registeredAgents: agentManager.getA2AEnabledAgents().length,
        serviceRegistry: agentManager.getA2AServiceRegistry()
      };

      if (agentManager.productionWorkflow) {
        a2aStatus.workflowStats = agentManager.productionWorkflow.getWorkflowStats();
      }

      res.json({
        ...a2aStatus,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * Test A2A Communication
   */
  router.post("/test", async (req, res) => {
    try {
      if (!agentManager.a2aManager) {
        return res.status(503).json({
          error: 'A2A Manager not available'
        });
      }

      const { targetAgent, action, data } = req.body;
      
      // Test A2A communication
      const result = await agentManager.a2aManager.requestService(
        targetAgent || 'complianceAgent',
        action || 'validateOrder',
        data || { orderId: 'TEST-001', test: true }
      );

      res.json({
        success: true,
        targetAgent,
        action,
        result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}

// ========================================================================
// SYSTEM ROUTES
// ========================================================================

function createSystemRoutes(agentManager, dataManager, eventBusManager) {
  const router = express.Router();

  // System Health Check (Enhanced with A2A info)
  router.get("/health", (req, res) => {
    const agentStats = agentManager.getStats();
    
    res.json({
      status: "ok",
      version: packageJson.version,
      developer: "Markus Schmeckenbecher",
      components: {
        agentManager: {
          status: "ok",
          stats: agentStats
        },
        dataManager: {
          status: "ok",
          loaded: dataManager.getLoadedDataKeys().length
        },
        eventBus: {
          status: "ok",
          subscriptions: eventBusManager.getEventSubscriptions().totalEvents
        },
        a2aWorkflows: {
          status: agentManager.productionWorkflow ? "ok" : "not_available",
          enabled: !!agentManager.productionWorkflow,
          workflowStats: agentManager.productionWorkflow ? 
            agentManager.productionWorkflow.getWorkflowStats() : null
        }
      },
      timestamp: new Date().toISOString(),
    });
  });

  // System Status
  router.get("/status", (req, res) => {
    res.json({
      version: packageJson.version,
      agents: agentManager.getStats(),
      data: dataManager.getDataStats(),
      events: eventBusManager.getEventSubscriptions(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
  });

  // Version Route
  router.get('/version', (req, res) => {
    res.json({
      version: packageJson.version,
      buildDate: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      developer: "Markus Schmeckenbecher",
      components: {
        eventBus: "1.3.0",
        agentManager: "1.2.3", 
        dataManager: "1.3.0",
        a2aWorkflows: "1.0.0"
      }
    });
  });

  // Rate Limiting Status
  router.get('/rate-limit', (req, res) => {
    if (agentManager.rateLimiter) {
      const status = agentManager.rateLimiter.getStatus();
      res.json({
        ...status,
        totalApiCalls: agentManager.totalApiCalls || 0,
        activeEventChains: agentManager.eventChainsActive?.size || 0,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        error: "Rate limiter not initialized",
        timestamp: new Date().toISOString()
      });
    }
  });

  // Reset Rate Limiter
  router.post('/rate-limit/reset', (req, res) => {
    if (agentManager.rateLimiter) {
      agentManager.rateLimiter.reset();
      res.json({ 
        message: 'Rate limiter reset', 
        timestamp: new Date().toISOString() 
      });
    } else {
      res.status(500).json({
        error: "Rate limiter not initialized",
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}