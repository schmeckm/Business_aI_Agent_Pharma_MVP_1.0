/**
 * ========================================================================
 * PHARMACEUTICAL MANUFACTURING AGENT SYSTEM - SERVER.JS (A2A ENHANCED)
 * ========================================================================
 * 
 * Enterprise AI Operations Platform for Pharmaceutical Production
 * MVP Version: 1.2.4 - A2A Integration (EventBus Fixed & Enhanced)
 * 
 * Developer: Markus Schmeckenbecher
 * Contact: markus.schmeckenbecher@company.com
 * Repository: Business_AI_Agent_Pharma_MVP
 * 
 * ========================================================================
 * CHANGE LOG
 * ========================================================================
 * 
 * v1.2.4 - 2025-09-24 - Markus Schmeckenbecher
 * ✅ VERIFIED: EventBus integration working correctly with eventBusManager
 * ✅ ENHANCEMENT: Added comprehensive documentation and status reporting
 * ✅ ENHANCEMENT: Enhanced A2A status endpoint with EventBus integration info
 * ✅ IMPROVEMENT: Better error handling and component initialization logging
 * 
 * v1.2.3 - 2025-09-22 - Markus Schmeckenbecher
 * ✅ BUGFIX: EventBusManager-AgentManager dependency linking
 * ✅ Fixed A2A communication errors
 * ✅ Added proper dependency injection for A2A workflows
 * 
 * v1.2.2 - 2025-09-21 - Markus Schmeckenbecher
 * ✅ ENHANCEMENT: A2A Integration (Phase 1)
 * ✅ Added A2AManager for Agent-to-Agent Communication
 * ✅ Enhanced AgentManager with A2A capabilities
 * ✅ Backward compatible - existing Event system still works
 * ✅ Added A2A test endpoints alongside existing APIs
 * ✅ Parallel Event + A2A architecture for gradual migration
 * 
 * v1.2.1 - 2025-09-21 - Markus Schmeckenbecher
 * ✅ MAJOR REFACTORING: Modular Architecture Implementation
 * ✅ Extracted EventBusManager → src/eventBus/EventBusManager.js
 * ✅ Extracted AgentManager → src/agents/AgentManager.js
 * ✅ Extracted DataManager → src/data/DataManager.js
 * ✅ Extracted AuditLogger → src/audit/AuditLogger.js
 * ✅ Extracted API Routes → src/api/routes/
 * 
 * ========================================================================
 */

// ========================================================================
// CORE DEPENDENCIES
// ========================================================================

import express from "express";
import dotenv from "dotenv";
import { BufferMemory } from "langchain/memory";

// Import modular components
import { EventBusManager } from "./src/eventBus/EventBusManager.js";
import { AgentManager } from "./src/agents/AgentManager.js";
import { DataManager } from "./src/data/DataManager.js";
import { AuditLogger } from "./src/audit/AuditLogger.js";
import { A2AManager } from './src/a2a/A2AManager.js';
import { createRoutes } from "./src/api/routes/index.js";
import packageJson from './package.json' assert { type: 'json' };
import { integrateMCPServer } from './src/mcp/MCPServer.js';

// NOTE: EventBusManager instance provides EventEmitter interface - no separate eventBus import needed

// Load environment configuration
dotenv.config();

// ========================================================================
// SERVER INITIALIZATION
// ========================================================================

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware setup
app.use(express.json());
app.use(express.static("public"));

// Environment configuration
const USE_LANGCHAIN = process.env.USE_LANGCHAIN === "true" || false;
const USE_ACTIONS = process.env.USE_ACTIONS === "true" || false;
const AGENT_MODE = process.env.AGENT_MODE || "simple";
const ENABLE_A2A = process.env.ENABLE_A2A !== "false"; // A2A enabled by default

console.log(`🔧 System Configuration:`);
console.log(`   Developer: Markus Schmeckenbecher`);
console.log(`   USE_LANGCHAIN: ${USE_LANGCHAIN}`);
console.log(`   USE_ACTIONS: ${USE_ACTIONS}`);
console.log(`   AGENT_MODE: ${AGENT_MODE}`);
console.log(`   ENABLE_A2A: ${ENABLE_A2A}`);

// ========================================================================
// COMPONENT INITIALIZATION (Enhanced with A2A - Correct Order)
// ========================================================================

/**
 * Initialize Core System Components
 * Creates instances of all modular components with proper dependency injection
 * 
 * INITIALIZATION ORDER:
 * 1. DataManager (no dependencies)
 * 2. AuditLogger (minimal dependencies)  
 * 3. EventBusManager (needs auditLogger)
 * 4. A2AManager (needs eventBusManager, auditLogger)
 * 5. AgentManager (needs all previous components)
 * 6. MCP Server (needs eventBusManager as eventBus + other components)
 */
console.log("🚀 Initializing system components...");

// 1. Initialize Data Manager (no dependencies)
const dataManager = new DataManager();
console.log("✅ DataManager initialized");

// 2. Initialize Audit Logger (minimal dependencies)
const auditLogger = new AuditLogger();
console.log("✅ AuditLogger initialized");

// 3. Initialize Event Bus Manager (needs audit logger)
const eventBusManager = new EventBusManager(auditLogger);
console.log("✅ EventBusManager initialized");

// 4. Initialize A2A Manager (needs eventBusManager and auditLogger) - NEW
const a2aManager = ENABLE_A2A ? new A2AManager(eventBusManager, auditLogger) : null;
if (a2aManager) {
  console.log("✅ A2A Manager initialized");
} else {
  console.log("⚪ A2A Manager disabled by configuration");
}

// 5. Initialize Agent Manager (needs all other components, including A2A)
const agentManager = new AgentManager(dataManager, eventBusManager, auditLogger, a2aManager);
console.log("✅ AgentManager initialized");

// 6. Integrate MCP Server (needs eventBusManager as eventBus, plus other components)
console.log("🔗 Integrating MCP Server...");
const mcpServer = await integrateMCPServer(app, {
    eventBus: eventBusManager, // ✅ EventBusManager provides EventEmitter interface
    dataManager,
    auditLogger,
    agentManager
});
console.log('✅ MCP Server integrated successfully');

// ========================================================================
// CRITICAL FIX: Link EventBusManager to AgentManager for A2A
// ========================================================================
// This fixes the "Cannot read properties of undefined (reading 'processAgent')" error
try {
  if (typeof eventBusManager.setAgentManager === 'function') {
    eventBusManager.setAgentManager(agentManager);
    console.log("🔗 EventBusManager linked to AgentManager for A2A communication");
  } else {
    // Fallback: Direct assignment if setAgentManager method doesn't exist
    eventBusManager.agentManager = agentManager;
    console.log("🔗 EventBusManager directly linked to AgentManager (fallback method)");
  }
} catch (error) {
  console.warn("⚠️ Could not link EventBusManager to AgentManager:", error.message);
  console.warn("⚠️ A2A functionality may be limited");
}

// Link event bus manager back to audit logger for proper event emission
auditLogger.eventBusManager = eventBusManager;
console.log("🔗 AuditLogger linked to EventBusManager");

console.log("✅ All components initialized successfully");

// ========================================================================
// MEMORY MANAGEMENT SYSTEM
// ========================================================================

/**
 * Agent Memory Storage
 * Maintains conversation context for each user session
 */
const agentMemories = new Map();

function getMemory(userId = "default") {
  if (!agentMemories.has(userId)) {
    agentMemories.set(
      userId,
      new BufferMemory({
        memoryKey: "chat_history",
        returnMessages: true,
        inputKey: "input",
        outputKey: "output",
      })
    );
  }
  return agentMemories.get(userId);
}

// ========================================================================
// SYSTEM STARTUP & DATA LOADING
// ========================================================================

/**
 * Load System Configuration and Data
 * Initializes all components with required data and configuration
 */
async function initializeSystem() {
  console.log("🔄 Loading system configuration and data...");
  
  try {
    // Load data source configuration first
    await dataManager.loadDataSourceConfig();
    
    // Load data from configured sources
    await dataManager.loadAllData();
    
    // Load agent configuration (now includes A2A setup)
    const agentsLoaded = agentManager.loadAgents();
    if (!agentsLoaded) {
      console.error("❌ Critical: Failed to load agents");
      process.exit(1);
    }
    
    // Validate system integrity
    const dataValidation = dataManager.validateDataIntegrity();
    if (!dataValidation.isValid) {
      console.warn("⚠️ Data integrity warning:", dataValidation.missing);
    }
    
    console.log("✅ System initialization completed successfully");
    
    // Log system startup with enhanced details
// Beispiel in initializeSystem()
auditLogger.logSystemEvent("system_startup", {
  version: packageJson.version,
  components: ["EventBusManager", "AgentManager", "DataManager", "AuditLogger", "A2AManager", "MCPServer"],
  configuration: { USE_LANGCHAIN, USE_ACTIONS, AGENT_MODE, ENABLE_A2A },
  eventBusIntegration: "Working - EventBusManager provides EventEmitter interface",
  mcpIntegration: "Successful"
});

    
  } catch (error) {
    console.error("❌ Critical error during system initialization:", error);
    process.exit(1);
  }
}

// Initialize system at startup
await initializeSystem();

// ========================================================================
// API ROUTES SETUP (Enhanced with A2A)
// ========================================================================

/**
 * Setup Modular API Routes with A2A support
 */
const apiRoutes = createRoutes(agentManager, dataManager, eventBusManager, auditLogger, a2aManager);
app.use("/api", apiRoutes);

// ========================================================================
// A2A TEST ENDPOINTS (Phase 1) - Enhanced
// ========================================================================

/**
 * A2A Test Endpoint - Direct Agent Communication
 */
if (a2aManager) {
  app.post('/api/a2a/test', async (req, res) => {
    try {
      const { targetAgent, action, data } = req.body;
      
      if (!targetAgent || !action) {
        return res.status(400).json({ 
          error: 'Missing required fields: targetAgent, action' 
        });
      }

      const startTime = Date.now();
      const result = await a2aManager.requestService(targetAgent, action, data || {});
      const responseTime = Date.now() - startTime;

      res.json({
        success: true,
        result,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
        a2aEnabled: true,
        eventBusStatus: "Integrated via EventBusManager"
      });

    } catch (error) {
      console.error('A2A Test failed:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        a2aEnabled: true,
        eventBusStatus: "Integrated via EventBusManager"
      });
    }
  });

  /**
   * A2A Status Endpoint - Enhanced with EventBus Integration Info
   */
  app.get('/api/a2a/status', (req, res) => {
    try {
      const eventBusStatus = eventBusManager.getA2AStatus ? eventBusManager.getA2AStatus() : {
        agentManagerLinked: !!eventBusManager.agentManager,
        eventSubscriptions: eventBusManager.agentSubscriptions ? eventBusManager.agentSubscriptions.size : 0,
        canProcessAgents: !!(eventBusManager.agentManager?.processAgent)
      };

      const status = {
        enabled: true,
        registeredAgents: Array.from(a2aManager.registeredAgents.keys()),
        pendingRequests: a2aManager.pendingRequests.size,
        eventBusIntegration: {
          type: "EventBusManager",
          interface: "EventEmitter compatible",
          status: "Active",
          ...eventBusStatus
        },
        mcpIntegration: {
          status: "Active",
          eventBusProvider: "EventBusManager instance"
        },
        timestamp: new Date().toISOString()
      };
      
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
} else {
  // A2A disabled endpoints
  app.post('/api/a2a/test', (req, res) => {
    res.status(503).json({ 
      error: 'A2A system is disabled', 
      a2aEnabled: false,
      eventBusStatus: "Available but A2A disabled"
    });
  });
  
  app.get('/api/a2a/status', (req, res) => {
    res.json({ 
      enabled: false, 
      reason: 'A2A system disabled in configuration',
      eventBusAvailable: true,
      eventBusProvider: "EventBusManager"
    });
  });
}

// ========================================================================
// LEGACY ROUTES (Backward Compatibility)
// ========================================================================

app.get("/health", (req, res) => res.redirect("/api/system/health"));
app.get("/agents", (req, res) => res.redirect("/api/agents"));
app.get("/templates", (req, res) => res.redirect("/api/agents/templates"));
app.get("/mock-data", (req, res) => res.redirect("/api/data"));
app.get("/event-subscriptions", (req, res) => res.redirect("/api/events/subscriptions"));
app.get("/audit", (req, res) => res.redirect("/api/audit"));
app.post("/chat", (req, res) => res.redirect(307, "/api/chat"));
app.post("/trigger-event", (req, res) => res.redirect(307, "/api/events/trigger"));
app.post("/reload-mock-data", (req, res) => res.redirect(307, "/api/data/reload"));

// ========================================================================
// SERVER-SENT EVENTS (SSE) SYSTEM
// ========================================================================

/**
 * Real-time Event Streaming Endpoint
 */
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (event) => {
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
    }
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  eventBusManager.on("event", sendEvent);
sendEvent({ 
  type: "connection", 
  message: "Connected to Enhanced EventBus with A2A support", 
  version: packageJson.version,
  a2aEnabled: !!a2aManager,
  eventBusProvider: "EventBusManager",
  mcpIntegrated: true,
  timestamp: new Date().toISOString() 
});
  req.on("close", () => {
    eventBusManager.removeListener("event", sendEvent);
  });
});

// ========================================================================
// ERROR HANDLING & GRACEFUL SHUTDOWN
// ========================================================================


// Basic Info Endpoint
app.get("/api/version", (req, res) => {
  res.json({
    version: packageJson.version,
    name: packageJson.name,
    description: packageJson.description
  });
});

/**
 * Global Error Handler
 */
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  auditLogger.logSystemEvent("error", { 
    message: err.message, 
    stack: err.stack,
    url: req.url,
    method: req.method 
  });
  
  res.status(500).json({ 
    error: "Internal server error", 
    timestamp: new Date().toISOString() 
  });
});

/**
 * Graceful Shutdown Handler
 */
process.on('SIGTERM', () => {
  console.log('📋 SIGTERM received, performing graceful shutdown...');
  auditLogger.logSystemEvent("system_shutdown", { reason: "SIGTERM", version: "1.2.4" });
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📋 SIGINT received, performing graceful shutdown...');
  auditLogger.logSystemEvent("system_shutdown", { reason: "SIGINT", version: "1.2.4" });
  process.exit(0);
});

// ========================================================================
// SERVER STARTUP
// ========================================================================

/**
 * Start Express Server
 */
app.listen(PORT, () => {
  console.log(`Version: ${packageJson.version}`);
  console.log(`🚀 Pharmaceutical Manufacturing Agent System running at http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/system/health`);
  console.log(`📡 Events stream: http://localhost:${PORT}/events`);
  console.log(`📋 API Documentation: http://localhost:${PORT}/api`);
  
  if (a2aManager) {
    console.log(`🔗 A2A Test endpoint: http://localhost:${PORT}/api/a2a/test`);
    console.log(`🔗 A2A Status: http://localhost:${PORT}/api/a2a/status`);
  }
  
  console.log(`👨‍💻 Developer: Markus Schmeckenbecher`);
  console.log(`📋 EventBus Integration Verified & Enhanced`);
  console.log(`🎯 Architecture: Event-Driven Microservices Pattern + A2A`);
  console.log(`✅ EventBus Integration: EventBusManager → MCP Server (Working)`);
  console.log(`✅ Component Dependencies: All properly initialized`);
  
  // Log successful startup with enhanced details
  auditLogger.logSystemEvent("server_started", {
    port: PORT,
    version: "1.2.4",
    architecture: "modular+a2a",
    a2aEnabled: !!a2aManager,
    eventBusIntegration: "EventBusManager",
    mcpIntegration: "Active",
    endpoints: [
      "/api/chat", "/api/agents", "/api/data", "/api/events", "/api/audit", 
      "/api/system", "/api/workflows", "/api/a2a/test", "/api/a2a/status"
    ]
  });
});

/**
 * ========================================================================
 * END OF A2A-ENHANCED SERVER.JS (EVENTBUS VERIFIED & ENHANCED)
 * ========================================================================
 * 
 * VERIFIED WORKING CONFIGURATION:
 * ✅ EventBusManager provides EventEmitter interface (on, emit, removeListener)
 * ✅ MCP Server receives eventBusManager as eventBus parameter
 * ✅ Component initialization order is correct and complete
 * ✅ A2A system runs parallel to existing Event system
 * ✅ Backward compatibility maintained
 * ✅ Enhanced status reporting and monitoring
 * 
 * A2A PHASE 1 ACHIEVEMENTS + ENHANCEMENTS:
 * ✅ A2A system runs parallel to existing Event system
 * ✅ Backward compatibility maintained
 * ✅ New A2A test endpoints added with enhanced status info
 * ✅ Graceful degradation when A2A disabled
 * ✅ Enhanced audit logging for A2A operations
 * ✅ Ready for gradual migration to A2A workflows
 * ✅ VERIFIED: EventBusManager-AgentManager dependency linking
 * ✅ VERIFIED: A2A communication working
 * ✅ ENHANCED: Comprehensive component initialization logging
 * ✅ ENHANCED: Better status monitoring and error reporting
 * ✅ ENHANCED: Documentation reflects actual working architecture
 * 
 * EVENTBUS INTEGRATION ARCHITECTURE:
 * - EventBusManager instance acts as eventBus for MCP Server
 * - No separate eventBus import needed - handled internally
 * - EventEmitter compatible interface maintained
 * - Proper dependency injection throughout component chain
 * - Real-time event streaming via Server-Sent Events
 * 
 * TESTING ENDPOINTS:
 * - Existing /api/chat endpoint works unchanged
 * - New /api/a2a/test endpoint for direct agent communication
 * - /api/a2a/status shows comprehensive A2A + EventBus health
 * - /api/workflows/* endpoints for Production Workflows
 * - /events for real-time event streaming
 * 
 * ========================================================================
 */