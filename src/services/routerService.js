// src/services/RouterService.js - Enhanced version with Phase 3 Integration
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import logger from "./logger.js";
import { Phase3ManufacturingSystem } from "../agents/mar.agent.js";

/**
 * Enhanced Router Service with Agent-to-Agent (A2A) communication and Phase 3 Integration
 * Supports both in-process and remote agent execution with Phase 3 AI capabilities
 */
export class RouterService {
  constructor({ registry, runtime, rag, data, http, defaultRemoteHeaders, llm } = {}) {
    this.registry = registry;
    this.runtime = runtime;
    this.rag = rag;
    this.data = data;
    this.llm = llm; // Unified LLM client
    this.http = http || axios.create({ 
      timeout: 60000,
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });
    this.defaultRemoteHeaders = defaultRemoteHeaders || {};
    
    // A2A call tracking for debugging and metrics
    this.callStack = new Map();
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      avgResponseTime: 0,
      agentStats: new Map(),
      phase3Stats: new Map() // New Phase 3 specific metrics
    };
    
    // Phase 3 Manufacturing System
    this.phase3System = null;
    this.phase3Config = {
      enableAutonomousMode: process.env.ENABLE_AUTONOMOUS_MODE === 'true',
      complianceLevel: process.env.COMPLIANCE_LEVEL || 'STANDARD',
      predictivePeriod: parseInt(process.env.PREDICTIVE_PERIOD) || 7
    };
    
    // Initialize Phase 3 system
    this.initializePhase3System();
    
    logger.info('RouterService initialized with enhanced A2A support and Phase 3 integration');
  }

  /**
   * Initialize Phase 3 Manufacturing System
   */
  async initializePhase3System() {
    try {
      logger.info('Initializing Phase 3 Manufacturing System...');
      
      this.phase3System = new Phase3ManufacturingSystem(this.phase3Config);
      await this.phase3System.initialize();
      
      // Set up Phase 3 event listeners
      this.setupPhase3EventListeners();
      
      logger.info('✅ Phase 3 Manufacturing System initialized successfully');
      
    } catch (error) {
      logger.error('❌ Phase 3 initialization failed:', error);
      // Continue without Phase 3 capabilities
      this.phase3System = null;
    }
  }

  /**
   * Set up Phase 3 event listeners for monitoring
   */
  setupPhase3EventListeners() {
    if (!this.phase3System) return;

    this.phase3System.on('system:initialized', () => {
      logger.info('Phase 3 system fully operational');
    });

    this.phase3System.on('production:completed', (result) => {
      logger.info(`Autonomous production completed: ${result.id}`);
      this.updatePhase3Metrics('production_completed', result);
    });

    this.phase3System.on('production:failed', (error) => {
      logger.warn(`Autonomous production failed: ${error.orchestrationId}`);
      this.updatePhase3Metrics('production_failed', error);
    });

    this.phase3System.on('consensus:reached', (proposal) => {
      logger.info(`Consensus reached for: ${proposal.id}`);
      this.updatePhase3Metrics('consensus_reached', proposal);
    });
  }

  /**
   * Main routing method with Phase 3 enhancement detection
   */
  async route({ intent, context = {}, text = "", callId = null }) {
    const startTime = Date.now();
    const routingId = callId || uuidv4();
    
    this.metrics.totalCalls++;
    
    // Detect if this should use Phase 3 enhancements
    const usePhase3 = this.shouldUsePhase3(intent, context, text);
    
    // Create enhanced context with A2A helper and Phase 3 capabilities
    const enhancedContext = {
      ...context,
      _routing: {
        id: routingId,
        timestamp: startTime,
        depth: this.getCallDepth(routingId),
        phase3Enabled: usePhase3
      },
      rag: this.rag,
      data: this.data,
      llm: this.llm,
      a2a: this.createA2AHelper(routingId),
      // Phase 3 services (only if available and enabled)
      ...(usePhase3 && this.phase3System && {
        phase3: this.phase3System,
        consensus: this.phase3System.consensusEngine,
        knowledge: this.phase3System.knowledgeGraph,
        predictive: this.phase3System.predictiveIntelligence,
        orchestration: this.phase3System.orchestration,
        compliance: this.phase3System.compliance
      })
    };

    try {
      let result;
      
      // Route through Phase 3 enhanced processing if applicable
      if (usePhase3 && this.phase3System) {
        result = await this._executePhase3Route(intent, enhancedContext, text);
      } else {
        result = await this._executeRoute(intent, enhancedContext, text);
      }
      
      // Track successful calls
      const responseTime = Date.now() - startTime;
      this.updateMetrics(intent, responseTime, true, usePhase3);
      
      return {
        ...result,
        _meta: {
          routingId,
          responseTime,
          timestamp: new Date().toISOString(),
          phase3Enhanced: usePhase3 && !!this.phase3System
        }
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(intent, responseTime, false, usePhase3);
      
      logger.error('Routing failed', { 
        intent, 
        routingId, 
        error: error.message,
        responseTime,
        phase3: usePhase3
      });
      
      return {
        via: "error",
        agent: null,
        result: { 
          ok: false, 
          error: error.message,
          type: error.constructor.name,
          routingId 
        },
        _meta: {
          routingId,
          responseTime,
          timestamp: new Date().toISOString(),
          phase3Enhanced: false
        }
      };
    }
  }

  /**
   * Determine if intent should use Phase 3 enhancements
   */
  shouldUsePhase3(intent, context, text) {
    if (!this.phase3System || !this.phase3System.isInitialized) {
      return false;
    }

    // Manufacturing related intents
    const manufacturingIntents = [
      'mar.', 'manufacturing.', 'production.', 'quality.', 'maintenance.',
      'assess', 'plan', 'allocate', 'monitor', 'optimize'
    ];

    // Check intent patterns
    const isManufacturingIntent = manufacturingIntents.some(pattern => 
      intent.toLowerCase().includes(pattern.toLowerCase())
    );

    // Check text content for manufacturing keywords
    const manufacturingKeywords = [
      'order', 'production', 'quality', 'equipment', 'batch', 'schedule',
      'capacity', 'resource', 'maintenance', 'compliance', 'workflow'
    ];

    const hasManufacturingKeywords = manufacturingKeywords.some(keyword =>
      text.toLowerCase().includes(keyword)
    );

    // Check context for manufacturing data
    const hasManufacturingContext = !!(
      context.orderId || context.productId || context.equipmentId ||
      context.batchId || context.processId || context.workflowId
    );

    return isManufacturingIntent || hasManufacturingKeywords || hasManufacturingContext;
  }

  /**
   * Execute route through Phase 3 enhanced processing
   */
  async _executePhase3Route(intent, context, text) {
    try {
      logger.debug('Using Phase 3 enhanced processing', { intent });
      
      // Clean intent for Phase 3 processing
      const cleanIntent = intent.replace('mar.', '').replace('manufacturing.', '');
      
      // Route through Phase 3 system
      const phase3Result = await this.phase3System.handleMARRequest(cleanIntent, context);
      
      // If Phase 3 processing was successful, return enhanced result
      if (phase3Result && phase3Result.success) {
        return {
          via: "phase3-enhanced",
          agent: "phase3-mar-agent",
          result: phase3Result,
          enhanced: true
        };
      }
      
      // Fallback to standard routing if Phase 3 fails
      logger.warn('Phase 3 processing failed, falling back to standard routing');
      return await this._executeRoute(intent, context, text);
      
    } catch (error) {
      logger.error('Phase 3 processing error:', error);
      // Always fallback to standard routing on Phase 3 errors
      return await this._executeRoute(intent, context, text);
    }
  }

  /**
   * Internal route execution with agent discovery and fallback (original method)
   */
  async _executeRoute(intent, context, text) {
    if (!intent) {
      return { via: "none", result: { ok: false, reason: "missing intent" } };
    }

    const ns = String(intent).split(".")[0];
    
    // Try to find agent by exact intent match first, then by namespace
    const entry = this.registry.findByIntent(intent) || this.registry.byNamespace(ns);

    if (!entry) {
      // Try LLM-based intent resolution if available
      if (this.llm && text) {
        const resolvedIntent = await this.tryIntentResolution(text, intent);
        if (resolvedIntent && resolvedIntent !== intent) {
          logger.info(`Intent resolved: ${intent} -> ${resolvedIntent}`);
          return await this._executeRoute(resolvedIntent, context, text);
        }
      }
      
      return { 
        via: "none", 
        result: { ok: false, reason: `no agent for ${intent}` } 
      };
    }

    // Prefer in-process execution
    if (entry.inProcess) {
      return await this._executeInProcess(intent, context, entry);
    }

    // Fall back to remote execution
    return await this._executeRemote(intent, context, text, entry);
  }

  /**
   * Execute agent in-process with enhanced error handling
   */
  async _executeInProcess(intent, context, entry) {
    if (!this.runtime) {
      return { 
        via: "in-process", 
        agent: entry.id, 
        result: { ok: false, reason: "runtime not available" } 
      };
    }

    try {
      const result = await this.runtime.run(intent, context);
      return { 
        via: "in-process", 
        agent: entry.id, 
        result 
      };
    } catch (error) {
      // Enhanced error information for debugging
      const errorInfo = {
        ok: false,
        error: error.message,
        type: error.constructor.name,
        agent: entry.id,
        intent,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };

      return { 
        via: "in-process", 
        agent: entry.id, 
        result: errorInfo 
      };
    }
  }

  /**
   * Execute remote agent with improved error handling and retries
   */
  async _executeRemote(intent, context, text, entry) {
    if (!entry.url) {
      return { 
        via: "remote", 
        agent: entry.id, 
        result: { ok: false, reason: "remote url missing" } 
      };
    }

    const headers = {
      "content-type": "application/json",
      ...(this.defaultRemoteHeaders || {}),
      ...(entry.headers || {}),
    };

    const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Clean context for remote calls (remove Phase 3 services)
    const cleanContext = {
      ...context,
      // Remove circular references and functions for remote calls
      rag: undefined,
      data: undefined,
      llm: undefined,
      a2a: undefined,
      phase3: undefined,
      consensus: undefined,
      knowledge: undefined,
      predictive: undefined,
      orchestration: undefined,
      compliance: undefined
    };

    const body = {
      jsonrpc: "2.0",
      id,
      method: "tasks/send",
      params: {
        id,
        message: { 
          role: "user", 
          parts: [{ type: "text", text: text || `Execute ${intent}` }] 
        },
        context: cleanContext
      }
    };

    try {
      const response = await this.http.post(entry.url, body, { headers });
      
      if (response.status >= 400) {
        throw new Error(`Remote agent returned ${response.status}: ${response.statusText}`);
      }

      const data = response.data;
      
      if (data?.error) {
        throw new Error(data.error.message || JSON.stringify(data.error));
      }

      return { 
        via: "remote", 
        agent: entry.id, 
        result: data.result ?? data 
      };
      
    } catch (error) {
      const errorInfo = {
        ok: false,
        error: error.message,
        type: 'RemoteAgentError',
        agent: entry.id,
        url: entry.url,
        status: error.response?.status
      };

      return { 
        via: "remote", 
        agent: entry.id, 
        result: errorInfo 
      };
    }
  }

  /**
   * Create A2A helper function with Phase 3 awareness
   */
  createA2AHelper(parentCallId) {
    const router = this;
    
    return async function a2a(subIntent, subContext = {}) {
      const callId = uuidv4();
      const depth = router.getCallDepth(parentCallId) + 1;
      
      // Prevent infinite recursion
      if (depth > 10) {
        throw new Error(`A2A call depth exceeded (${depth}): possible circular dependency`);
      }
      
      // Track call relationships
      router.callStack.set(callId, {
        parent: parentCallId,
        intent: subIntent,
        depth,
        timestamp: Date.now()
      });
      
      logger.debug('A2A call', { 
        parent: parentCallId, 
        child: callId, 
        intent: subIntent, 
        depth 
      });

      try {
        const result = await router.route({ 
          intent: subIntent, 
          context: subContext, 
          text: subContext?.text || "", 
          callId 
        });
        
        // A2A calls should throw on failure to maintain error propagation
        if (result?.result?.ok === false || result?.result?.error) {
          const error = new Error(result?.result?.error || result?.result?.reason || 'A2A call failed');
          error.routingResult = result;
          throw error;
        }
        
        return result.result;
        
      } finally {
        router.callStack.delete(callId);
      }
    };
  }

  /**
   * Get call depth for circular dependency detection
   */
  getCallDepth(callId) {
    let depth = 0;
    let currentId = callId;
    
    while (currentId && this.callStack.has(currentId)) {
      const call = this.callStack.get(currentId);
      currentId = call.parent;
      depth++;
      
      // Safety break
      if (depth > 20) break;
    }
    
    return depth;
  }

  /**
   * LLM-based intent resolution for unknown intents
   */
  async tryIntentResolution(text, originalIntent) {
    if (!this.llm?.isAvailable()) return null;
    
    try {
      const knownIntents = this.registry.all()
        .flatMap(agent => (agent.skills || []).map(skill => skill.intent))
        .filter(Boolean);
        
      const prompt = `Analyze this manufacturing command and suggest the best matching intent.

Command: "${text}"
Original intent: "${originalIntent}"

Known intents:
${knownIntents.join('\n')}

Rules:
- Return only the intent name, nothing else
- If no good match, return "UNKNOWN"
- Prefer exact namespace matches (mar.*, cmo.*, qa.*)

Best matching intent:`;

      const response = await this.llm.chat([
        { role: 'user', content: prompt }
      ], { temperature: 0, max_tokens: 50 });
      
      const suggestedIntent = response.text.trim();
      
      if (suggestedIntent !== 'UNKNOWN' && knownIntents.includes(suggestedIntent)) {
        return suggestedIntent;
      }
      
    } catch (error) {
      logger.warn('Intent resolution failed:', error.message);
    }
    
    return null;
  }

  /**
   * Update routing metrics with Phase 3 tracking
   */
  updateMetrics(intent, responseTime, success, usedPhase3 = false) {
    if (success) {
      this.metrics.successfulCalls++;
    } else {
      this.metrics.failedCalls++;
    }
    
    // Update average response time
    this.metrics.avgResponseTime = (this.metrics.avgResponseTime + responseTime) / 2;
    
    // Update per-agent stats
    const namespace = intent.split('.')[0];
    if (!this.metrics.agentStats.has(namespace)) {
      this.metrics.agentStats.set(namespace, { calls: 0, failures: 0, avgTime: 0 });
    }
    
    const stats = this.metrics.agentStats.get(namespace);
    stats.calls++;
    if (!success) stats.failures++;
    stats.avgTime = (stats.avgTime + responseTime) / 2;

    // Track Phase 3 usage
    if (usedPhase3) {
      this.updatePhase3Metrics('route_processed', { intent, success, responseTime });
    }
  }

  /**
   * Update Phase 3 specific metrics
   */
  updatePhase3Metrics(event, data) {
    if (!this.metrics.phase3Stats.has(event)) {
      this.metrics.phase3Stats.set(event, { count: 0, lastSeen: null });
    }
    
    const eventStats = this.metrics.phase3Stats.get(event);
    eventStats.count++;
    eventStats.lastSeen = new Date().toISOString();
    
    if (data) {
      eventStats.lastData = data;
    }
  }

  /**
   * Get Phase 3 system status
   */
  getPhase3Status() {
    if (!this.phase3System) {
      return {
        available: false,
        reason: 'Phase 3 system not initialized'
      };
    }

    return {
      available: true,
      initialized: this.phase3System.isInitialized,
      autonomousMode: this.phase3Config.enableAutonomousMode,
      components: this.phase3System.getSystemStatus ? 
        this.phase3System.getSystemStatus() : 
        { status: 'unknown' }
    };
  }

  /**
   * Get comprehensive routing metrics including Phase 3
   */
  getMetrics() {
    return {
      ...this.metrics,
      agentStats: Object.fromEntries(this.metrics.agentStats),
      phase3Stats: Object.fromEntries(this.metrics.phase3Stats),
      successRate: this.metrics.totalCalls > 0 
        ? this.metrics.successfulCalls / this.metrics.totalCalls 
        : 0,
      activeCallsCount: this.callStack.size,
      phase3: this.getPhase3Status()
    };
  }

  /**
   * Health check for the routing service including Phase 3
   */
  async healthCheck() {
    const agents = this.registry.all();
    const inProcessCount = agents.filter(a => a.inProcess).length;
    const remoteCount = agents.filter(a => !a.inProcess && a.url).length;
    
    // Check Phase 3 health
    let phase3Health = { available: false };
    if (this.phase3System) {
      try {
        phase3Health = {
          available: true,
          initialized: this.phase3System.isInitialized,
          autonomousMode: this.phase3Config.enableAutonomousMode,
          components: await this.phase3System.getSystemStatus?.() || {}
        };
      } catch (error) {
        phase3Health = {
          available: false,
          error: error.message
        };
      }
    }
    
    return {
      ok: true,
      agents: {
        total: agents.length,
        inProcess: inProcessCount,
        remote: remoteCount
      },
      runtime: !!this.runtime,
      llm: this.llm?.isAvailable() || false,
      phase3: phase3Health,
      metrics: this.getMetrics()
    };
  }

  /**
   * Graceful shutdown including Phase 3 cleanup
   */
  async shutdown() {
    logger.info('Shutting down RouterService...');
    
    if (this.phase3System && this.phase3System.shutdown) {
      try {
        await this.phase3System.shutdown();
        logger.info('Phase 3 system shutdown complete');
      } catch (error) {
        logger.error('Phase 3 shutdown error:', error);
      }
    }
    
    // Clear call stack
    this.callStack.clear();
    
    logger.info('RouterService shutdown complete');
  }
}