// src/services/RouterService.js - Enhanced version with A2A communication
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import logger from "./logger.js";

/**
 * Enhanced Router Service with Agent-to-Agent (A2A) communication
 * Supports both in-process and remote agent execution with improved error handling
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
      agentStats: new Map()
    };
    
    logger.info('RouterService initialized with enhanced A2A support');
  }

  /**
   * Main routing method with comprehensive error handling and metrics
   */
  async route({ intent, context = {}, text = "", callId = null }) {
    const startTime = Date.now();
    const routingId = callId || uuidv4();
    
    this.metrics.totalCalls++;
    
    // Create enhanced context with A2A helper
    const enhancedContext = {
      ...context,
      _routing: {
        id: routingId,
        timestamp: startTime,
        depth: this.getCallDepth(routingId)
      },
      rag: this.rag,
      data: this.data,
      llm: this.llm,
      a2a: this.createA2AHelper(routingId)
    };

    try {
      const result = await this._executeRoute(intent, enhancedContext, text);
      
      // Track successful calls
      const responseTime = Date.now() - startTime;
      this.updateMetrics(intent, responseTime, true);
      
      return {
        ...result,
        _meta: {
          routingId,
          responseTime,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(intent, responseTime, false);
      
      logger.error('Routing failed', { 
        intent, 
        routingId, 
        error: error.message,
        responseTime 
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
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Internal route execution with agent discovery and fallback
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
        context: {
          ...context,
          // Remove circular references and functions for remote calls
          rag: undefined,
          data: undefined,
          llm: undefined,
          a2a: undefined
        }
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
   * Create A2A helper function with call tracking and circular dependency detection
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
   * Update routing metrics
   */
  updateMetrics(intent, responseTime, success) {
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
  }

  /**
   * Get routing metrics for monitoring
   */
  getMetrics() {
    return {
      ...this.metrics,
      agentStats: Object.fromEntries(this.metrics.agentStats),
      successRate: this.metrics.totalCalls > 0 
        ? this.metrics.successfulCalls / this.metrics.totalCalls 
        : 0,
      activeCallsCount: this.callStack.size
    };
  }

  /**
   * Health check for the routing service
   */
  async healthCheck() {
    const agents = this.registry.all();
    const inProcessCount = agents.filter(a => a.inProcess).length;
    const remoteCount = agents.filter(a => !a.inProcess && a.url).length;
    
    return {
      ok: true,
      agents: {
        total: agents.length,
        inProcess: inProcessCount,
        remote: remoteCount
      },
      runtime: !!this.runtime,
      llm: this.llm?.isAvailable() || false,
      metrics: this.getMetrics()
    };
  }
}