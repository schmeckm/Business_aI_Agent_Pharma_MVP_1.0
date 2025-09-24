/**
 * ========================================================================
 * EVENT BUS MANAGER (A2A ENHANCED)
 * ========================================================================
 * 
 * Handles all event-driven communication between agents
 * Supports both local EventEmitter and production message brokers
 * Enhanced with A2A (Agent-to-Agent) communication support
 * 
 * Developer: Markus Schmeckenbecher
 * Version: 1.3.0 - A2A Integration
 * 
 * Features:
 * - Event publishing and subscription management
 * - Agent auto-triggering based on event subscriptions
 * - Loop prevention for cascading events
 * - Audit logging integration
 * - A2A communication support with AgentManager integration
 * ========================================================================
 */

import EventEmitter from "events";

export class EventBusManager {
  constructor(auditLogger) {
    this.eventBus = new EventEmitter();
    this.auditLogger = auditLogger;
    this.agentSubscriptions = new Map();
    this.agentManager = null; // Will be set by server.js for A2A support
    
    console.log("🔗 EventBusManager initialized");
  }

  /**
   * Set AgentManager Reference for A2A Communication
   * Called by server.js after AgentManager initialization
   */
  setAgentManager(agentManager) {
    this.agentManager = agentManager;
    console.log("🔗 EventBusManager linked to AgentManager for A2A communication");
  }

  /**
   * Build Event Subscription Mappings
   * Creates efficient lookup table for event-to-agent routing
   */
  buildEventSubscriptions(agents) {
    this.agentSubscriptions.clear();
    
    agents.forEach(agent => {
      if (agent.events && agent.events.subscribes) {
        agent.events.subscribes.forEach(event => {
          if (!this.agentSubscriptions.has(event)) {
            this.agentSubscriptions.set(event, []);
          }
          this.agentSubscriptions.get(event).push(agent);
        });
      }
    });
    
    console.log("🔗 Event subscriptions built:", 
      Array.from(this.agentSubscriptions.entries()).map(([event, agents]) => 
        `${event} → [${agents.map(a => a.id).join(', ')}]`
      )
    );
  }

  /**
   * Publish Agent Event (Enhanced for A2A)
   * Distributes events to all subscribing agents
   * Now supports both legacy agentProcessor and new A2A agentManager
   */
  async publishEvent(eventType, data, sourceAgentId, agentProcessor = null) {
    console.log(`📡 Publishing event: ${eventType} from ${sourceAgentId}`);
    
    // Audit logging for GMP compliance
    const auditEvent = {
      type: "agent_event",
      eventType,
      sourceAgent: sourceAgentId,
      data,
      timestamp: new Date().toISOString()
    };
    
    this.auditLogger.appendAudit(auditEvent);
    this.emit("event", auditEvent);
    
    // Find and trigger subscribing agents
    const subscribers = this.agentSubscriptions.get(eventType) || [];
    const wildcardSubscribers = this.agentSubscriptions.get("*") || [];
    const allSubscribers = [...subscribers, ...wildcardSubscribers];
    
    if (allSubscribers.length > 0) {
      console.log(`🎯 Triggering ${allSubscribers.length} subscribing agents:`, 
        allSubscribers.map(a => a.id)
      );
      
      // Execute subscribing agents with loop prevention
      for (const subscribingAgent of allSubscribers) {
        try {
          console.log(`⚡ Auto-triggering agent: ${subscribingAgent.id}`);
          
          const autoMessage = `Auto-triggered by event: ${eventType} from ${sourceAgentId}`;
          let response = null;
          
          // ENHANCED: Support both legacy agentProcessor and new A2A agentManager
          if (agentProcessor && typeof agentProcessor.processAgent === 'function') {
            // Legacy event system
            response = await agentProcessor.processAgent(subscribingAgent, autoMessage, true);
          } else if (this.agentManager && typeof this.agentManager.processAgent === 'function') {
            // A2A system
            response = await this.agentManager.processAgent(subscribingAgent, autoMessage, true);
          } else {
            console.warn(`⚠️ No agent processor available for ${subscribingAgent.id}`);
            console.log(`📋 Event ${eventType} logged for ${subscribingAgent.id} (no processing)`);
            continue; // Skip to next agent
          }
          
          // Log auto-triggered response
          const autoEvent = {
            type: "auto_triggered_agent",
            triggeredAgent: subscribingAgent.id,
            triggerEvent: eventType,
            sourceAgent: sourceAgentId,
            response: response ? response.substring(0, 200) + '...' : 'No response',
            timestamp: new Date().toISOString()
          };
          
          this.auditLogger.appendAudit(autoEvent);
          this.emit("event", autoEvent);
          
          // Handle cascading events with delay to prevent overload
// OPTION B: Disable cascading events to prevent infinite loops
// Cascading events replaced by controlled A2A workflows
console.log(`Cascading events disabled for ${subscribingAgent.id} (Option B: A2A workflows)`);
// No automatic event cascading - use controlled A2A workflows instead
          
        } catch (error) {
          console.error(`❌ Error auto-triggering agent ${subscribingAgent.id}:`, error.message);
          // Continue with other agents even if one fails
        }
      }
    }
  }

  /**
   * Subscribe to Event (Enhanced for A2A)
   * Register event listener with A2A callback support
   */
  subscribe(eventPattern, callback) {
    this.eventBus.on(eventPattern, callback);
    console.log(`📩 Subscribed to event pattern: ${eventPattern}`);
  }

  /**
   * Subscribe to Events
   * Register event listener for real-time updates
   */
  on(event, listener) {
    this.eventBus.on(event, listener);
  }

  /**
   * Emit Event
   * Send event to all registered listeners
   */
  emit(event, data) {
    this.eventBus.emit(event, data);
  }

  /**
   * Remove Event Listener
   */
  removeListener(event, listener) {
    this.eventBus.removeListener(event, listener);
  }

  /**
   * Get Event Subscriptions Overview
   * Returns mapping of events to subscribing agents
   */
  getEventSubscriptions() {
    const subscriptions = Array.from(this.agentSubscriptions.entries()).map(([event, agents]) => ({
      event,
      subscribers: agents.map(a => ({ id: a.id, name: a.name, trigger: a.trigger }))
    }));
    
    return {
      subscriptions,
      totalEvents: this.agentSubscriptions.size,
      a2aEnabled: !!this.agentManager,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get Subscribers for Event
   * Returns array of agent IDs subscribed to specific event
   */
  getSubscribers(eventType) {
    const directSubscribers = this.agentSubscriptions.get(eventType)?.map(a => a.id) || [];
    const wildcardSubscribers = this.agentSubscriptions.get("*")?.map(a => a.id) || [];
    
    // Combine and deduplicate
    return [...new Set([...directSubscribers, ...wildcardSubscribers])];
  }

  /**
   * Health Check for A2A Integration
   */
  getA2AStatus() {
    return {
      agentManagerLinked: !!this.agentManager,
      eventSubscriptions: this.agentSubscriptions.size,
      canProcessAgents: !!(this.agentManager?.processAgent),
      timestamp: new Date().toISOString()
    };
  }
}

export default EventBusManager;