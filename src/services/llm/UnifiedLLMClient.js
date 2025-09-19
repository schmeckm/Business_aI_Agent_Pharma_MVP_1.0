// src/services/llm/UnifiedLLMClient.js
import { setTimeout as wait } from "timers/promises";
import logger from "../logger.js";

/**
 * Unified LLM Client with provider fallbacks and standardized interface
 * Consolidates Claude and OpenAI clients with intelligent routing
 */
export class UnifiedLLMClient {
  constructor(config = {}) {
    this.config = {
      defaultProvider: config.defaultProvider || 'claude',
      fallbackChain: config.fallbackChain || ['claude', 'openai'],
      timeout: config.timeout || 30000,
      retries: config.retries || 2,
      ...config
    };
    
    this.providers = new Map();
    this.setupProviders();
    
    // Metrics tracking
    this.metrics = {
      requests: 0,
      failures: 0,
      fallbacks: 0,
      providerStats: new Map()
    };
    
    logger.info('UnifiedLLMClient initialized', { 
      providers: Array.from(this.providers.keys()),
      default: this.config.defaultProvider 
    });
  }

  setupProviders() {
    // Claude provider
    if (process.env.CLAUDE_API_KEY || this.config.claude?.apiKey) {
      this.providers.set('claude', new ClaudeProvider({
        apiKey: process.env.CLAUDE_API_KEY || this.config.claude?.apiKey,
        model: process.env.CLAUDE_MODEL || this.config.claude?.model || 'claude-3-5-sonnet-20241022',
        baseUrl: process.env.CLAUDE_API_URL || this.config.claude?.baseUrl || 'https://api.anthropic.com/v1/messages',
        timeout: this.config.timeout,
        retries: this.config.retries
      }));
    }

    // OpenAI provider
    if (process.env.OPENAI_API_KEY || this.config.openai?.apiKey) {
      this.providers.set('openai', new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY || this.config.openai?.apiKey,
        model: process.env.OPENAI_MODEL || this.config.openai?.model || 'gpt-4o-mini',
        baseUrl: this.config.openai?.baseUrl || 'https://api.openai.com/v1/chat/completions',
        timeout: this.config.timeout,
        retries: this.config.retries
      }));
    }

    if (this.providers.size === 0) {
      logger.warn('No LLM providers configured - LLM features will be disabled');
    }
  }

  /**
   * Main chat interface with automatic fallback
   */
  async chat(messages, options = {}) {
    if (this.providers.size === 0) {
      throw new Error('No LLM providers available');
    }

    this.metrics.requests++;
    
    const provider = options.provider || this.config.defaultProvider;
    const startTime = Date.now();
    
    // Try primary provider first
    if (this.providers.has(provider)) {
      try {
        const result = await this.providers.get(provider).chat(messages, options);
        this.updateProviderStats(provider, Date.now() - startTime, true);
        return result;
      } catch (error) {
        logger.warn(`Primary provider ${provider} failed:`, error.message);
        this.updateProviderStats(provider, Date.now() - startTime, false);
      }
    }

    // Try fallback chain
    for (const fallbackProvider of this.config.fallbackChain) {
      if (fallbackProvider === provider) continue; // Skip already tried
      
      if (this.providers.has(fallbackProvider)) {
        try {
          logger.info(`Attempting fallback to ${fallbackProvider}`);
          this.metrics.fallbacks++;
          
          const result = await this.providers.get(fallbackProvider).chat(messages, options);
          this.updateProviderStats(fallbackProvider, Date.now() - startTime, true);
          return result;
          
        } catch (error) {
          logger.warn(`Fallback provider ${fallbackProvider} failed:`, error.message);
          this.updateProviderStats(fallbackProvider, Date.now() - startTime, false);
        }
      }
    }

    this.metrics.failures++;
    throw new Error('All LLM providers failed');
  }

  /**
   * Structured data extraction with schema validation
   */
  async extractStructured(text, schema, options = {}) {
    const prompt = this.buildExtractionPrompt(text, schema);
    
    try {
      const response = await this.chat([
        { role: 'user', content: prompt }
      ], { 
        ...options, 
        temperature: 0,
        max_tokens: 500 
      });

      return this.parseStructuredResponse(response.text, schema);
    } catch (error) {
      logger.warn('Structured extraction failed:', error.message);
      return null;
    }
  }

  /**
   * Manufacturing-specific NLU extraction
   */
  async parseManufacturingCommand(text) {
    const schema = {
      material: { type: 'string', pattern: /^[A-Z]+-\d+$/, description: 'Material code like FG-123' },
      qty: { type: 'number', minimum: 0, description: 'Quantity in pieces' },
      line: { type: 'string', pattern: /^[A-Z]+-\d+$/, description: 'Production line like PCK-01' },
      country: { type: 'string', enum: ['EU', 'US', 'CH', 'DE', 'FR', 'ROW'], description: 'Target market' },
      date: { type: 'string', format: 'date', description: 'Due date in YYYY-MM-DD format' },
      priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], description: 'Order priority' }
    };

    return await this.extractStructured(text, schema);
  }

  buildExtractionPrompt(text, schema) {
    const fields = Object.entries(schema).map(([key, spec]) => {
      return `- ${key}: ${spec.description || 'No description'}`;
    }).join('\n');

    return `Extract structured data from this German manufacturing command. Return only valid JSON.

Schema:
${fields}

Text: "${text}"

Rules:
- Set fields to null if not found or unclear
- Material codes must match pattern like FG-123, PCK-01
- Quantities must be positive numbers
- Dates must be YYYY-MM-DD format
- Countries: EU/US/CH/DE/FR/ROW only

Return JSON only:`;
  }

  parseStructuredResponse(text, schema) {
    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Basic validation
      const validated = {};
      for (const [key, spec] of Object.entries(schema)) {
        const value = parsed[key];
        
        if (value !== null && value !== undefined) {
          // Type checking
          if (spec.type === 'number' && typeof value === 'string') {
            const num = parseFloat(value);
            validated[key] = isNaN(num) ? null : num;
          } else if (spec.type === 'string' && typeof value !== 'string') {
            validated[key] = String(value);
          } else {
            validated[key] = value;
          }
        } else {
          validated[key] = null;
        }
      }

      return validated;
    } catch (error) {
      logger.warn('Failed to parse structured response:', error.message);
      return null;
    }
  }

  updateProviderStats(provider, responseTime, success) {
    if (!this.metrics.providerStats.has(provider)) {
      this.metrics.providerStats.set(provider, {
        requests: 0,
        failures: 0,
        avgResponseTime: 0,
        lastUsed: null
      });
    }

    const stats = this.metrics.providerStats.get(provider);
    stats.requests++;
    if (!success) stats.failures++;
    stats.avgResponseTime = (stats.avgResponseTime + responseTime) / 2;
    stats.lastUsed = new Date();
  }

  getMetrics() {
    return {
      ...this.metrics,
      providerStats: Object.fromEntries(this.metrics.providerStats)
    };
  }

  isAvailable() {
    return this.providers.size > 0;
  }
}

/**
 * Claude Provider Implementation
 */
class ClaudeProvider {
  constructor(config) {
    this.config = config;
  }

  async chat(messages, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      // Separate system message from conversation
      let systemMessage = null;
      const conversationMessages = [];

      for (const msg of messages) {
        if (msg.role === 'system') {
          systemMessage = msg.content;
        } else {
          conversationMessages.push(msg);
        }
      }

      const payload = {
        model: options.model || this.config.model,
        messages: conversationMessages,
        max_tokens: options.max_tokens || 1000,
        temperature: options.temperature ?? 0.7,
        ...(systemMessage && { system: systemMessage })
      };

      const response = await fetch(this.config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        text: data.content?.[0]?.text || '',
        raw: data,
        usage: data.usage,
        model: data.model,
        provider: 'claude'
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * OpenAI Provider Implementation
 */
class OpenAIProvider {
  constructor(config) {
    this.config = config;
  }

  async chat(messages, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const payload = {
        model: options.model || this.config.model,
        messages,
        max_tokens: options.max_tokens || 1000,
        temperature: options.temperature ?? 0.7
      };

      const response = await fetch(this.config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        text: data.choices?.[0]?.message?.content || '',
        raw: data,
        usage: data.usage,
        model: data.model,
        provider: 'openai'
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export default UnifiedLLMClient;