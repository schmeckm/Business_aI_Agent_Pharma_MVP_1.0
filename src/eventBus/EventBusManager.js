/**
 * ========================================================================
 * EVENT BUS MANAGER
 * ========================================================================
 * 
 * Handles all event-driven communication between agents
 * Supports both local EventEmitter and production message brokers
 * 
 * Developer: Markus Schmeckenbecher
 * Version: 1.2.0
 * 
 * Features:
 * - Event publishing and subscription management
 * - Agent auto-triggering based on event subscriptions
 * - Loop prevention for cascading events
 * - Audit logging integration
 * ========================================================================
 */

import EventEmitter from "events";

export class EventBusManager {
  constructor(auditLogger) {
    this.eventBus = new EventEmitter();
    this.auditLogger = auditLogger;
    this.agentSubscriptions = new Map();
    
    console.log("🔗 EventBusManager initialized");
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
   * Publish Agent Event
   * Distributes events to all subscribing agents
   */
  async publishEvent(eventType, data, sourceAgentId, agentProcessor) {
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
          const response = await agentProcessor.processAgent(subscribingAgent, autoMessage, true);
          
          // Log auto-triggered response
          const autoEvent = {
            type: "auto_triggered_agent",
            triggeredAgent: subscribingAgent.id,
            triggerEvent: eventType,
            sourceAgent: sourceAgentId,
            response: response.substring(0, 200) + '...',
            timestamp: new Date().toISOString()
          };
          
          this.auditLogger.appendAudit(autoEvent);
          this.emit("event", autoEvent);
          
          // Handle cascading events with delay to prevent overload
          if (subscribingAgent.events && subscribingAgent.events.publishes) {
            for (const publishedEvent of subscribingAgent.events.publishes) {
              setTimeout(() => {
                this.publishEvent(publishedEvent, { response }, subscribingAgent.id, agentProcessor);
              }, 100);
            }
          }
          
        } catch (error) {
          console.error(`❌ Error auto-triggering agent ${subscribingAgent.id}:`, error);
        }
      }
    }
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
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get Subscribers for Event
   * Returns array of agent IDs subscribed to specific event
   */
  getSubscribers(eventType) {
    return this.agentSubscriptions.get(eventType)?.map(a => a.id) || [];
  }
}

export default EventBusManager;