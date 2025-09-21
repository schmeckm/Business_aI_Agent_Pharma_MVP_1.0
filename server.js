/**
 * ========================================================================
 * PHARMACEUTICAL MANUFACTURING AGENT SYSTEM - SERVER.JS (REFACTORED)
 * ========================================================================
 * 
 * Enterprise AI Operations Platform for Pharmaceutical Production
 * MVP Version: 1.2.1 - Modular Architecture Implementation
 * 
 * Developer: Markus Schmeckenbecher
 * Contact: markus.schmeckenbecher@company.com
 * Repository: Business_AI_Agent_Pharma_MVP_1.2
 * 
 * ========================================================================
 * CHANGE LOG
 * ========================================================================
 * 
 * v1.2.1 - 2025-09-21 - Markus Schmeckenbecher
 * ✅ MAJOR REFACTORING: Modular Architecture Implementation
 * ✅ Extracted EventBusManager → src/eventBus/EventBusManager.js
 * ✅ Extracted AgentManager → src/agents/AgentManager.js
 * ✅ Extracted DataManager → src/data/DataManager.js
 * ✅ Extracted AuditLogger → src/audit/AuditLogger.js
 * ✅ Extracted API Routes → src/api/routes/
 * ✅ Reduced server.js from 800+ lines to ~150 lines
 * ✅ Improved maintainability and testability
 * ✅ Production-ready modular architecture
 * 
 * v1.2.0 - 2025-09-21 - Markus Schmeckenbecher
 * ✅ Implemented Event-driven Agent System
 * ✅ Added Mock Data Pre-loading at Startup  
 * ✅ Created Agent Event Bus with Pub/Sub Pattern
 * ✅ Added Auto-triggering of Subscribing Agents
 * ✅ Enhanced API with Event Management Endpoints
 * 
 * v1.1.0 - 2025-09-20 - Markus Schmeckenbecher  
 * ✅ Added YAML-based Agent Configuration
 * ✅ Implemented Multiple Data Sources Support
 * ✅ Created Agent Prompt Template System
 * ✅ Added Basic Event Bus Foundation
 * 
 * v1.0.0 - 2025-09-19 - Markus Schmeckenbecher
 * ✅ Initial Express Server Setup
 * ✅ Claude AI Integration (Anthropic)
 * ✅ Basic Agent Framework
 * ✅ Audit Logging System
 * ✅ SSE Event Streaming
 * 
 * ========================================================================
 * MODULAR ARCHITECTURE
 * ========================================================================
 * 
 * The system now implements a clean modular architecture:
 * 
 * CORE MODULES:
 * - EventBusManager: Event-driven communication hub
 * - AgentManager: Agent lifecycle and execution
 * - DataManager: Mock data loading and management
 * - AuditLogger: GMP-compliant audit trail
 * - API Routes: Modular endpoint organization
 * 
 * BENEFITS:
 * - Single Responsibility Principle
 * - Improved testability and maintainability
 * - Easier deployment and scaling
 * - Clear separation of concerns
 * - Production-ready architecture
 * 
 * ========================================================================
 * ENVIRONMENT CONFIGURATION
 * ========================================================================
 * 
 * Required Environment Variables:
 * - CLAUDE_API_KEY: Anthropic Claude AI API key
 * - CLAUDE_MODEL: Claude model version (optional)
 * - PORT: Server port (default: 4000)
 * - NODE_ENV: Environment (development/production)
 * 
 * Optional Configuration:
 * - USE_LANGCHAIN: Enable LangChain wrapper (default: false)
 * - USE_ACTIONS: Enable tool actions (default: false)
 * - AGENT_MODE: Agent processing mode (default: simple)
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
import { createRoutes } from "./src/api/routes/index.js";
import packageJson from './package.json' assert { type: 'json' };


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

console.log(`🔧 System Configuration:`);
console.log(`   Developer: Markus Schmeckenbecher`);
console.log(`   USE_LANGCHAIN: ${USE_LANGCHAIN}`);
console.log(`   USE_ACTIONS: ${USE_ACTIONS}`);
console.log(`   AGENT_MODE: ${AGENT_MODE}`);

// ========================================================================
// COMPONENT INITIALIZATION
// ========================================================================

/**
 * Initialize Core System Components
 * Creates instances of all modular components with proper dependency injection
 */
console.log("🚀 Initializing system components...");

// 1. Initialize Data Manager (no dependencies)
const dataManager = new DataManager();

// 2. Initialize Audit Logger (minimal dependencies)
const auditLogger = new AuditLogger();

// 3. Initialize Event Bus Manager (needs audit logger)
const eventBusManager = new EventBusManager(auditLogger);

// 4. Initialize Agent Manager (needs all other components)
const agentManager = new AgentManager(dataManager, eventBusManager, auditLogger);

// Link event bus manager back to audit logger for proper event emission
auditLogger.eventBusManager = eventBusManager;

console.log("✅ All components initialized successfully");

// ========================================================================
// MEMORY MANAGEMENT SYSTEM
// ========================================================================

/**
 * Agent Memory Storage
 * Maintains conversation context for each user session
 * Note: In modular architecture, this could be moved to a separate MemoryManager
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
    
    // Load agent configuration
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
    
    // Log system startup
    auditLogger.logSystemEvent("system_startup", {
      version: "1.2.1",
      components: ["EventBusManager", "AgentManager", "DataManager", "AuditLogger"],
      configuration: { USE_LANGCHAIN, USE_ACTIONS, AGENT_MODE }
    });
    
  } catch (error) {
    console.error("❌ Critical error during system initialization:", error);
    process.exit(1);
  }
}

// Initialize system at startup
await initializeSystem();

// ========================================================================
// API ROUTES SETUP
// ========================================================================

/**
 * Setup Modular API Routes
 * Uses the centralized routing system with dependency injection
 */
const apiRoutes = createRoutes(agentManager, dataManager, eventBusManager, auditLogger);
app.use("/api", apiRoutes);

// Legacy routes for backward compatibility
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
 * Provides live updates of system events to frontend
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
    message: "Connected to Modular EventBus", 
    version: "1.2.1",
    timestamp: new Date().toISOString() 
  });

  req.on("close", () => {
    eventBusManager.removeListener("event", sendEvent);
  });
});

// ========================================================================
// ERROR HANDLING & GRACEFUL SHUTDOWN
// ========================================================================

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
  auditLogger.logSystemEvent("system_shutdown", { reason: "SIGTERM" });
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📋 SIGINT received, performing graceful shutdown...');
  auditLogger.logSystemEvent("system_shutdown", { reason: "SIGINT" });
  process.exit(0);
});

// ========================================================================
// SERVER STARTUP
// ========================================================================

/**
 * Start Express Server
 * Launch the Pharmaceutical Manufacturing Agent System
 */
app.listen(PORT, () => {
  console.log(`🚀 Pharmaceutical Manufacturing Agent System running at http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/system/health`);
  console.log(`📡 Events stream: http://localhost:${PORT}/events`);
  console.log(`📋 API Documentation: http://localhost:${PORT}/api`);
  console.log(`👨‍💻 Developer: Markus Schmeckenbecher`);
  console.log(`📋 Version: MVP 1.2.1 - Modular Architecture`);
  console.log(`🎯 Architecture: Event-Driven Microservices Pattern`);
  
  // Log successful startup
  auditLogger.logSystemEvent("server_started", {
    port: PORT,
    version: "1.2.1",
    architecture: "modular",
    endpoints: [
      "/api/chat", "/api/agents", "/api/data", "/api/events", "/api/audit", "/api/system"
    ]
  });
});
console.log(`Version: ${packageJson.version}`);


/**
 * ========================================================================
 * END OF REFACTORED SERVER.JS
 * ========================================================================
 * 
 * ARCHITECTURE ACHIEVEMENTS:
 * ✅ Reduced from 800+ lines to ~300 lines
 * ✅ Clear separation of concerns
 * ✅ Improved testability and maintainability
 * ✅ Production-ready modular architecture
 * ✅ Dependency injection pattern
 * ✅ Proper error handling and graceful shutdown
 * 
 * NEXT PHASE - PRODUCTION ENHANCEMENTS:
 * - Replace EventEmitter with Redis/RabbitMQ
 * - Add authentication and authorization middleware
 * - Implement rate limiting and API versioning  
 * - Add comprehensive monitoring and metrics
 * - Docker containerization
 * - Kubernetes deployment configuration
 * 
 * CONTACT:
 * Developer: Markus Schmeckenbecher
 * Email: markus.schmeckenbecher@company.com
 * 
 * ========================================================================
 */