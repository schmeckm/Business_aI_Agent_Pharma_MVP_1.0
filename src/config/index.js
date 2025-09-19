// src/config/index.js - Centralized Configuration Management
import 'dotenv/config';
import logger from '../services/logger.js';

/**
 * Centralized configuration with validation and environment-specific settings
 */
export class AppConfig {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    this.config = this.loadConfig();
    this.validate();
  }

  loadConfig() {
    return {
      // Server Configuration
      server: {
        port: Number(process.env.PORT || 4000),
        host: process.env.HOST || 'localhost',
        cors: {
          origin: process.env.CORS_ORIGIN || '*',
          credentials: true
        }
      },

      // Database Configuration
      database: {
        chroma: {
          url: process.env.CHROMA_URL || 'http://localhost:8001',
          tenant: process.env.CHROMA_TENANT || 'default_tenant',
          database: process.env.CHROMA_DATABASE || 'default_database',
          collection: process.env.CHROMA_COLLECTION || 'agentic_docs',
          forceMode: (process.env.CHROMA_FORCE_MODE || 'v2mt').toLowerCase()
        }
      },

      // LLM Configuration
      llm: {
        defaultProvider: process.env.LLM_DEFAULT_PROVIDER || 'claude',
        fallbackChain: (process.env.LLM_FALLBACK_CHAIN || 'claude,openai').split(','),
        timeout: Number(process.env.LLM_TIMEOUT || 30000),
        retries: Number(process.env.LLM_RETRIES || 2),
        
        claude: {
          apiKey: process.env.CLAUDE_API_KEY,
          model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
          baseUrl: process.env.CLAUDE_API_URL || 'https://api.anthropic.com/v1/messages'
        },
        
        openai: {
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          baseUrl: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions'
        }
      },

      // Embeddings Configuration
      embeddings: {
        provider: (process.env.EMBEDDINGS_PROVIDER || 'openai').toLowerCase(),
        openai: {
          model: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
          timeout: Number(process.env.EMBEDDINGS_TIMEOUT_MS || 15000)
        }
      },

      // Authentication Configuration
      auth: {
        adminApiKey: process.env.ADMIN_API_KEY || 'admin-123',
        userApiKey: process.env.USER_API_KEY || 'user-123',
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          adminEmails: (process.env.ADMIN_ALLOWED_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean),
          adminDomains: (process.env.ADMIN_ALLOWED_DOMAINS || '').split(',').map(s => s.trim()).filter(Boolean)
        }
      },

      // Phase Control
      phases: {
        enablePhase2: process.env.ENABLE_PHASE2 !== 'false', // Default true
        enablePhase3: process.env.ENABLE_PHASE3 === 'true',  // Default false
        enableWorkflows: process.env.ENABLE_WORKFLOWS !== 'false',
        enableEvents: process.env.ENABLE_EVENTS !== 'false'
      },

      // Agent Configuration
      agents: {
        configPath: process.env.AGENTS_CONFIG_PATH || './agents.json',
        timeout: Number(process.env.AGENT_TIMEOUT || 15000),
        maxConcurrent: Number(process.env.AGENT_MAX_CONCURRENT || 10),
        retries: Number(process.env.AGENT_RETRIES || 2)
      },

      // Logging Configuration
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'pretty', // pretty | json
        file: process.env.LOG_FILE,
        hmacKey: process.env.LOG_HMAC_KEY
      },

      // Security Configuration
      security: {
        rateLimit: {
          windowMs: Number(process.env.RATE_LIMIT_WINDOW || 15 * 60 * 1000), // 15 minutes
          max: Number(process.env.RATE_LIMIT_MAX || 100),
          skipSuccessfulRequests: true
        },
        cors: {
          maxAge: Number(process.env.CORS_MAX_AGE || 86400),
          allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
        }
      },

      // Feature Flags
      features: {
        ragSearch: process.env.FEATURE_RAG === 'true',
        advancedCompliance: process.env.FEATURE_COMPLIANCE === 'true',
        predictiveIntelligence: process.env.FEATURE_PREDICTIVE === 'true',
        knowledgeGraph: process.env.FEATURE_KNOWLEDGE_GRAPH === 'true'
      },

      // External Services
      external: {
        mpc: {
          url: process.env.MPC_URL || 'http://localhost:5200',
          apiKey: process.env.MPC_API_KEY,
          timeout: Number(process.env.MPC_TIMEOUT || 45000)
        },
        opc: {
          endpoint: process.env.OPC_ENDPOINT || 'opc.tcp://localhost:4840',
          user: process.env.OPC_USER,
          password: process.env.OPC_PASS
        }
      }
    };
  }

  validate() {
    const errors = [];

    // Required environment variables
    const required = [
      { key: 'CLAUDE_API_KEY', condition: this.config.llm.claude.apiKey },
      { key: 'OPENAI_API_KEY', condition: this.config.llm.openai.apiKey }
    ];

    // At least one LLM provider must be configured
    const hasLLMProvider = this.config.llm.claude.apiKey || this.config.llm.openai.apiKey;
    if (!hasLLMProvider) {
      errors.push('At least one LLM provider (CLAUDE_API_KEY or OPENAI_API_KEY) must be configured');
    }

    // Validate numeric values
    const numericValidations = [
      { key: 'PORT', value: this.config.server.port, min: 1, max: 65535 },
      { key: 'LLM_TIMEOUT', value: this.config.llm.timeout, min: 1000 },
      { key: 'RATE_LIMIT_MAX', value: this.config.security.rateLimit.max, min: 1 }
    ];

    numericValidations.forEach(({ key, value, min, max }) => {
      if (isNaN(value) || value < min || (max && value > max)) {
        errors.push(`${key} must be a valid number between ${min} and ${max || 'infinity'}`);
      }
    });

    // Validate URLs
    const urlValidations = [
      { key: 'CHROMA_URL', value: this.config.database.chroma.url },
      { key: 'MPC_URL', value: this.config.external.mpc.url }
    ];

    urlValidations.forEach(({ key, value }) => {
      try {
        new URL(value);
      } catch (e) {
        errors.push(`${key} must be a valid URL`);
      }
    });

    if (errors.length > 0) {
      logger.error('Configuration validation failed', { errors });
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    logger.info('Configuration validated successfully', {
      env: this.env,
      phases: this.config.phases,
      features: this.config.features
    });
  }

  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.config);
  }

  isDevelopment() {
    return this.env === 'development';
  }

  isProduction() {
    return this.env === 'production';
  }

  isPhase2Enabled() {
    return this.config.phases.enablePhase2;
  }

  isPhase3Enabled() {
    return this.config.phases.enablePhase3;
  }

  getLogLevel() {
    return this.config.logging.level;
  }

  getLLMConfig() {
    return this.config.llm;
  }

  getDbConfig() {
    return this.config.database;
  }
}

// Create singleton instance
export const config = new AppConfig();
export default config;