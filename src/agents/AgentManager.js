/**
 * ========================================================================
 * AGENT MANAGER (A2A ENHANCED) - OPTION B INTEGRATION
 * ========================================================================
 * 
 * Manages agent lifecycle, configuration, and execution
 * Handles YAML configuration loading and agent registry
 * Enhanced with Agent-to-Agent communication capabilities
 * OPTION B: Events replaced with controlled A2A workflows
 * 
 * Developer: Markus Schmeckenbecher
 * Version: 1.2.3 - Option B: A2A Workflows instead of Events
 * 
 * Features:
 * - YAML-based agent configuration loading
 * - Agent registry and validation  
 * - Agent execution with prompt template processing
 * - NEW: Controlled A2A workflows replace chaotic events
 * - NEW: ProductionWorkflow integration for pharmaceutical processes
 * - Enhanced A2A service registration and discovery
 * - Budget-safe rate limiting
 * ========================================================================
 */

import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import Anthropic from "@anthropic-ai/sdk";
import { RateLimiter } from '../utils/RateLimiter.js';


export class AgentManager {
 constructor(dataManager, eventBusManager, auditLogger, a2aManager = null) {
    this.dataManager = dataManager;
    this.eventBusManager = eventBusManager;
    this.auditLogger = auditLogger || { log: () => {} }; // Safe fallback
    this.a2aManager = a2aManager;
    this.agents = [];
    this.agentStats = { loaded: 0, failed: 0, lastReload: null };
    
    // Rate Limiting Setup
    const maxCallsPerMinute = parseInt(process.env.MAX_API_CALLS_PER_MINUTE) || 5;
    this.rateLimiter = new RateLimiter(maxCallsPerMinute, 60000);
    this.totalApiCalls = 0;
    this.eventChainsActive = new Set();
    
    // Claude AI Configuration
    this.claudeApiKey = process.env.CLAUDE_API_KEY || null;
    this.claudeModel = process.env.CLAUDE_MODEL || "claude-3-7-sonnet-20250219";
    this.anthropic = null;
    
    this.initializeClaudeAI();
    console.log(`🤖 AgentManager initialized with rate limit: ${maxCallsPerMinute} calls/minute`);
    
    // OPTION B: A2A Workflow Setup (replaces chaotic events)
    if (this.a2aManager) {
      this.setupA2AWorkflows();
      console.log('✅ A2A Workflows initialized - Events replaced with controlled workflows');
    }
  }

  /**
   * Initialize Claude AI Client
   */
  initializeClaudeAI() {
    if (this.claudeApiKey) {
      this.anthropic = new Anthropic({ apiKey: this.claudeApiKey });
      console.log(`🤖 Claude AI configured: ${this.claudeModel}`);
    } else {
      console.log("⚠️ No Claude API key found. Agent processing disabled.");
    }
  }

  /**
   * Load Agent Configuration from YAML (Enhanced with A2A)
   * Parses agents.yaml and builds agent registry + A2A capabilities
   */
  loadAgents(configPath = "config/agents.yaml") {
    try {
      const raw = fs.readFileSync(path.join(configPath), "utf8");
      const config = yaml.load(raw);
      this.agents = config.agents || [];

      // Validate agent configuration (existing validation)
      this.agents.forEach((agent, i) => {
        if (!agent.id) throw new Error(`Agent ${i} missing id`);
        if (!agent.trigger) throw new Error(`Agent ${agent.id} missing trigger`);
        if (!agent.type) agent.type = "data-driven";
      });

      this.agentStats = {
        loaded: this.agents.length,
        failed: 0,
        lastReload: new Date().toISOString(),
      };

      console.log(
        "✅ Loaded agents:",
        this.agents.map((a) => `${a.id} (${a.trigger})`)
      );
      
      // Build existing event subscriptions (kept for backward compatibility)
      this.eventBusManager.buildEventSubscriptions(this.agents);
      
      // Setup A2A handlers if A2A is enabled
      if (this.a2aManager) {
        this.setupA2AHandlers();
      }
      
      return true;
    } catch (err) {
      console.error("❌ Failed to load agents.yaml:", err.message);
      this.agentStats.failed++;
      return false;
    }
  }

  // ========================================================================
  // OPTION B: A2A WORKFLOW FUNCTIONALITY
  // ========================================================================

  /**
   * Setup A2A Workflows (replaces Event-System)
   * Option B: Controlled workflows instead of chaotic events
   */
  setupA2AWorkflows() {
    try {
      // Import ProductionWorkflow dynamically
      import('../workflows/ProductionWorkflow.js').then(({ ProductionWorkflow }) => {
        this.productionWorkflow = new ProductionWorkflow(this.a2aManager);
        console.log('✅ ProductionWorkflow loaded successfully');
      }).catch(error => {
        console.warn('⚠️ ProductionWorkflow not available:', error.message);
        this.productionWorkflow = null;
      });
    } catch (error) {
      console.warn('⚠️ A2A Workflow setup failed:', error.message);
    }
  }

  // ========================================================================
  // A2A FUNCTIONALITY (Existing)
  // ========================================================================

  /**
   * Setup A2A Handlers for Agents (Enhanced Error Handling)
   * Registers agents with A2A capabilities and sets up message listeners
   */
  setupA2AHandlers() {
    if (!this.a2aManager) return;

    this.agents.forEach(agent => {
      if (agent.a2aCapabilities && Array.isArray(agent.a2aCapabilities)) {
        console.log(`🔗 Setting up A2A for ${agent.id}:`, agent.a2aCapabilities);
        
        try {
          // Register agent in A2A system (safe call)
          if (typeof this.a2aManager.registerAgent === 'function') {
            this.a2aManager.registerAgent(agent.id, agent.a2aCapabilities);
          } else {
            console.warn(`⚠️ A2A Manager registerAgent method not available`);
            return;
          }
          
          // Setup A2A message listeners for each capability
          agent.a2aCapabilities.forEach(capability => {
            try {
              this.eventBusManager.subscribe(`a2a.${agent.id}.${capability}`, 
                (eventData) => this.handleA2ARequest(agent, capability, eventData)
              );
            } catch (error) {
              console.warn(`⚠️ Failed to setup A2A listener for ${agent.id}.${capability}:`, error.message);
            }
          });
        } catch (error) {
          console.warn(`⚠️ Failed to setup A2A for ${agent.id}:`, error.message);
        }
      }
    });

    console.log(`🔗 A2A setup completed for ${this.getA2AEnabledAgents().length} agents`);
  }

  /**
   * Handle A2A Request for an Agent
   * Processes incoming A2A messages and generates responses
   */
/**
 * Handle A2A Request for an Agent
 * Processes incoming A2A messages and generates responses
 */
async handleA2ARequest(agent, action, eventData) {
  const requestStartTime = Date.now();
  
  try {
    console.log(`📨 A2A Request: ${agent.id}.${action} (RequestID: ${eventData.requestId})`);
    
    // Process the A2A request
    const result = await this.processAgentA2A(agent, action, eventData.data);
    
    // Calculate response time
    const responseTime = Date.now() - requestStartTime;
    
    // Send A2A response back
    this.a2aManager.handleA2AResponse(eventData.requestId, true, result);
    
    // DISABLED: Audit logging (was causing errors)
    console.log(`✅ A2A Request completed: ${agent.id}.${action} in ${responseTime}ms`);
    
  } catch (error) {
    const responseTime = Date.now() - requestStartTime;
    console.error(`❌ A2A Request failed for ${agent.id}.${action}:`, error);
    
    // Send error response
    this.a2aManager.handleA2AResponse(eventData.requestId, false, null, error.message);
    
    // DISABLED: Audit logging (was causing errors)
    console.log(`❌ A2A Request failed: ${agent.id}.${action} in ${responseTime}ms - ${error.message}`);
  }
}

  /**
   * Process Agent A2A Request
   * Handles A2A-specific agent processing with specialized prompts
   */
  async processAgentA2A(agent, action, data) {
    if (!this.anthropic) {
      throw new Error("Claude AI not configured for A2A processing");
    }

    let prompt;
    
    // Use A2A-specific prompt if available, otherwise fall back to standard prompt
    if (agent.a2aPrompts && agent.a2aPrompts[action]) {
      // Specialized A2A prompt for this action
      prompt = agent.a2aPrompts[action]
        .replace('{timestamp}', new Date().toISOString())
        .replace('{action}', action)
        .replace('{orderId}', data.orderId || 'N/A')
        .replace('{priority}', data.priority || 'normal')
        .replace('{data}', JSON.stringify(data, null, 2));
    } else {
      // Fallback to standard prompt with A2A context
      const agentData = this.dataManager.getMockDataForAgent(agent.dataSource);
      
      prompt = `${agent.promptTemplate}

=== A2A REQUEST CONTEXT ===
Action: ${action}
Request Data: ${JSON.stringify(data, null, 2)}

IMPORTANT: This is an Agent-to-Agent communication request.
Please respond with structured, actionable data that another agent can process.
Focus on providing clear status, recommendations, and any required follow-up actions.

Expected Response Format: JSON with clear status and reasoning.`
        .replace('{timestamp}', new Date().toISOString())
        .replace('{userMessage}', `A2A Request: ${action}`)
        .replace('{data}', agentData);
    }

    console.log(`🔍 Processing A2A request for ${agent.id}.${action}`);

    // Execute Claude AI request (using existing Claude integration)
    const response = await this.anthropic.messages.create({
      model: this.claudeModel,
      max_tokens: 800, // Increased for A2A responses
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = response.content[0].text;
    
    // Try to parse as JSON for structured A2A communication
    let structuredResult;
    try {
      structuredResult = JSON.parse(responseText);
    } catch {
      // If not JSON, return as structured object
      structuredResult = {
        action,
        result: responseText,
        timestamp: new Date().toISOString(),
        agentId: agent.id,
        type: 'text_response'
      };
    }

    return {
      action,
      result: structuredResult,
      timestamp: new Date().toISOString(),
      agentId: agent.id,
      responseType: 'a2a_response'
    };
  }

  // ========================================================================
  // MAIN AGENT PROCESSING (Modified for Option B)
  // ========================================================================

  /**
   * Find Agent by Trigger
   * Searches agent registry for matching trigger
   */
  findAgent(message) {
    if (!message || typeof message !== 'string') {
      console.warn('⚠️ Invalid message provided to findAgent:', message);
      return null;
    }
    
    return this.agents.find(
      (a) =>
        a.trigger === message ||
        message.toLowerCase().includes(a.trigger.toLowerCase())
    );
  }

  /**
   * Process Agent with Prompt Template (Enhanced for Option B)
   * Executes agent with data injection and Claude AI
   * Now supports A2A workflow triggers instead of chaotic events
   */
  async processAgent(agent, userMessage, isAutoTriggered = false) {
    // Rate Limiting Check
    if (!this.rateLimiter.canMakeCall(agent.id)) {
      const status = this.rateLimiter.getStatus();
      return `Rate limit exceeded. ${status.callsInWindow}/${status.maxCalls} calls used. Next reset in ${Math.ceil(status.nextResetIn/1000)} seconds.`;
    }

    if (!this.anthropic) return "Claude AI not configured.";
    
    // Increment total API counter
    this.totalApiCalls++;
    console.log(`🔍 API Call #${this.totalApiCalls} - Agent: ${agent.id} (Auto: ${isAutoTriggered})`);

    // Get data for agent from DataManager
    const agentData = this.dataManager.getMockDataForAgent(agent.dataSource);
    
    // Replace placeholders in prompt template
    const prompt = agent.promptTemplate
      .replace('{timestamp}', new Date().toISOString())
      .replace('{userMessage}', userMessage)
      .replace('{data}', agentData);

    console.log(`🔍 Agent ${agent.id} processing:`, agentData.substring(0, 100) + '...');

    try {
      // Execute Claude AI request
      const response = await this.anthropic.messages.create({
        model: this.claudeModel,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      });

      const responseText = response.content[0].text;

      // OPTION B: Controlled A2A Workflow Publishing (replaces chaotic events)
      if (agent.events && agent.events.publishes && !isAutoTriggered) {
        this.isAutoTriggered = isAutoTriggered; // Add context for workflow
        await this.publishEventsWithControl(agent, userMessage, responseText);
      }

      return responseText;

    } catch (error) {
      console.error(`❌ Claude API error for ${agent.id}:`, error.message);
      return `Agent processing failed: ${error.message}`;
    }
  }

  /**
   * OPTION B: EVENTS DEAKTIVIERT - Ersetzt durch A2A-Workflows
   * Replaces chaotic event chains with controlled workflows
   * Triggers ProductionWorkflow for pharmaceutical compliance processes
   */
  async publishEventsWithControl(agent, userMessage, responseText) {
    console.log(`🔗 Events DISABLED - Using A2A workflows instead for agent: ${agent.id}`);
    
    // Event-System komplett deaktiviert für Option B
    // Keine automatischen Event-Chains mehr
    // Kontrollierte A2A-Workflows ersetzen Events
    
    // A2A Workflow Trigger (ersetzt Events)
    if (agent.id === 'orderAgent' && !this.isAutoTriggered && this.productionWorkflow) {
      setTimeout(async () => {
        try {
          console.log(`🔗 Triggering A2A workflow for orderAgent result`);
          await this.productionWorkflow.executeOrderAnalysisWorkflow(
            'ORD-1001', // Extract from response or userMessage
            { source: 'orderAgent', response: responseText }
          );
        } catch (error) {
          console.error('A2A workflow failed:', error.message);
        }
      }, 1000); // 1s delay für Response-Rückgabe
    }
    
    return {
      published: 0,
      reason: 'Events disabled - A2A workflows active'
    };
  }

  // ========================================================================
  // ENHANCED FUNCTIONALITY (Extended for A2A)
  // ========================================================================

  /**
   * Get All Agents (Enhanced with A2A info)
   */
  getAllAgents() {
    return this.agents.map(agent => ({
      ...agent,
      a2aEnabled: !!(agent.a2aCapabilities && this.a2aManager),
      a2aCapabilities: agent.a2aCapabilities || []
    }));
  }

  /**
   * Get Agent Statistics (Enhanced with A2A stats)
   */
  getStats() {
    const a2aStats = this.a2aManager ? {
      a2aEnabled: true,
      a2aAgents: this.getA2AEnabledAgents().length,
      pendingA2ARequests: this.a2aManager.pendingRequests?.size || 0,
      workflowsActive: this.productionWorkflow ? 1 : 0
    } : {
      a2aEnabled: false,
      a2aAgents: 0,
      pendingA2ARequests: 0,
      workflowsActive: 0
    };

    return {
      ...this.agentStats,
      ...a2aStats
    };
  }

  /**
   * Get A2A-Enabled Agents
   * Returns list of agents with A2A capabilities
   */
  getA2AEnabledAgents() {
    return this.agents.filter(agent => 
      agent.a2aCapabilities && Array.isArray(agent.a2aCapabilities) && agent.a2aCapabilities.length > 0
    );
  }

  /**
   * Get A2A Service Registry
   * Returns all available A2A services and their agents
   */
  getA2AServiceRegistry() {
    if (!this.a2aManager) return null;

    const registry = {};
    this.getA2AEnabledAgents().forEach(agent => {
      agent.a2aCapabilities.forEach(capability => {
        if (!registry[capability]) {
          registry[capability] = [];
        }
        registry[capability].push({
          agentId: agent.id,
          agentName: agent.name,
          description: agent.description
        });
      });
    });

    return registry;
  }

  // ========================================================================
  // EXISTING METHODS (Unchanged for backward compatibility)
  // ========================================================================

  /**
   * Get Agent Templates for Frontend
   */
  getTemplates() {
    return this.agents.map((a) => ({
      value: a.trigger,
      text: a.name || `${a.id} (${a.trigger})`,
      description: a.description,
      a2aEnabled: !!(a.a2aCapabilities && this.a2aManager)
    }));
  }

  /**
   * Get Event Publishers
   */
  getEventPublishers() {
    return this.agents.filter(a => a.events && a.events.publishes).map(a => ({
      id: a.id,
      name: a.name,
      publishes: a.events.publishes
    }));
  }

  /**
   * Reload Agent Configuration (Enhanced with A2A reset)
   */
  reloadAgents(configPath = "config/agents.yaml") {
    try {
      // Reset A2A registrations if A2A is enabled
      if (this.a2aManager) {
        console.log("🔄 Resetting A2A registrations...");
        this.a2aManager.registeredAgents?.clear?.();
      }

      this.agents = [];
      this.agentStats = { loaded: 0, failed: 0, lastReload: null };
      return this.loadAgents(configPath);
    } catch (error) {
      console.error("❌ Failed to reload agents:", error);
      return false;
    }
  }
}

export default AgentManager;