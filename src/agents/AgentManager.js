/**
 * ========================================================================
 * AGENT MANAGER
 * ========================================================================
 * 
 * Manages agent lifecycle, configuration, and execution
 * Handles YAML configuration loading and agent registry
 * 
 * Developer: Markus Schmeckenbecher
 * Version: 1.2.0
 * 
 * Features:
 * - YAML-based agent configuration loading
 * - Agent registry and validation
 * - Agent execution with prompt template processing
 * - Event publishing integration
 * ========================================================================
 */

import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import Anthropic from "@anthropic-ai/sdk";

export class AgentManager {
  constructor(dataManager, eventBusManager, auditLogger) {
    this.dataManager = dataManager;
    this.eventBusManager = eventBusManager;
    this.auditLogger = auditLogger;
    this.agents = [];
    this.agentStats = { loaded: 0, failed: 0, lastReload: null };
    
    // Claude AI Configuration
    this.claudeApiKey = process.env.CLAUDE_API_KEY || null;
    this.claudeModel = process.env.CLAUDE_MODEL || "claude-3-7-sonnet-20250219";
    this.anthropic = null;
    
    this.initializeClaudeAI();
    console.log("🤖 AgentManager initialized");
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
   * Load Agent Configuration from YAML
   * Parses agents.yaml and builds agent registry
   */
  loadAgents(configPath = "config/agents.yaml") {
    try {
      const raw = fs.readFileSync(path.join(configPath), "utf8");
      const config = yaml.load(raw);
      this.agents = config.agents || [];

      // Validate agent configuration
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
      
      // Build event subscriptions
      this.eventBusManager.buildEventSubscriptions(this.agents);
      
      return true;
    } catch (err) {
      console.error("❌ Failed to load agents.yaml:", err.message);
      this.agentStats.failed++;
      return false;
    }
  }

  /**
   * Find Agent by Trigger
   * Searches agent registry for matching trigger
   */
  findAgent(message) {
    return this.agents.find(
      (a) =>
        a.trigger === message ||
        message.toLowerCase().includes(a.trigger.toLowerCase())
    );
  }

  /**
   * Process Agent with Prompt Template
   * Executes agent with data injection and Claude AI
   */
  async processAgent(agent, userMessage, isAutoTriggered = false) {
    if (!this.anthropic) return "Claude AI not configured.";
    
    // Get data for agent from DataManager
    const agentData = this.dataManager.getMockDataForAgent(agent.dataSource);
    
    // Replace placeholders in prompt template
    const prompt = agent.promptTemplate
      .replace('{timestamp}', new Date().toISOString())
      .replace('{userMessage}', userMessage)
      .replace('{data}', agentData);

    console.log(`🔍 Agent ${agent.id} processing:`, agentData.substring(0, 100) + '...');

    // Execute Claude AI request
    const response = await this.anthropic.messages.create({
      model: this.claudeModel,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = response.content[0].text;

    // Publish events if agent publishes and not auto-triggered (prevent loops)
    if (agent.events && agent.events.publishes && !isAutoTriggered) {
      console.log(`📤 Agent ${agent.id} publishing events:`, agent.events.publishes);
      
      for (const eventType of agent.events.publishes) {
        // Add delay to prevent system overload
        setTimeout(() => {
          this.eventBusManager.publishEvent(
            eventType, 
            { userMessage, response: responseText.substring(0, 500) }, 
            agent.id,
            this
          );
        }, 50);
      }
    }

    return responseText;
  }

  /**
   * Get All Agents
   */
  getAllAgents() {
    return this.agents;
  }

  /**
   * Get Agent Statistics
   */
  getStats() {
    return this.agentStats;
  }

  /**
   * Get Agent Templates for Frontend
   */
  getTemplates() {
    return this.agents.map((a) => ({
      value: a.trigger,
      text: a.name || `${a.id} (${a.trigger})`,
      description: a.description,
    }));
  }

  /**
   * Get Event Publishers
   * Returns agents that publish events
   */
  getEventPublishers() {
    return this.agents.filter(a => a.events && a.events.publishes).map(a => ({
      id: a.id,
      name: a.name,
      publishes: a.events.publishes
    }));
  }

  /**
   * Reload Agent Configuration
   * Reloads agents without server restart
   */
  reloadAgents(configPath = "config/agents.yaml") {
    try {
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