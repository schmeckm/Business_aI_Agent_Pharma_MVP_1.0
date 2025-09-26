/**
 * ========================================================================
 * FLEXIBLE DATA MANAGER WITH SAP API + OEE MQTT SUPPORT
 * ========================================================================
 * 
 * Multi-source data management system supporting:
 * - Mock JSON files (Development)
 * - SAP APIs (Production)
 * - REST APIs
 * - OEE MQTT (Realtime)
 * 
 * Developer: Markus Schmeckenbecher
 * Version: 1.4.0
 * ========================================================================
 */

import fs from "fs";
import path from "path";
import mqtt from "mqtt";

// ========================================================================
// DATA SOURCE INTERFACES
// ========================================================================

/**
 * Base Data Source Interface
 * All data sources must implement this interface
 */
class DataSource {
  async fetchData(sourceConfig) {
    throw new Error("fetchData method must be implemented");
  }
  
  async updateData(sourceConfig, entryId, updates) {
    throw new Error("updateData method must be implemented");
  }
  
  getName() {
    throw new Error("getName method must be implemented");
  }
}

// ========================================================================
// MOCK DATA SOURCE (Development)
// ========================================================================

class MockDataSource extends DataSource {
  constructor(basePath = "mock-data") {
    super();
    this.basePath = basePath;
  }

  async fetchData(sourceConfig) {
    const filePath = path.join(process.cwd(), this.basePath, `${sourceConfig.file}.json`);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Mock file not found: ${filePath}`);
      return null;
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      console.log(`📁 Mock: Loaded ${sourceConfig.file}.json (${data.length || Object.keys(data).length} entries)`);
      return data;
    } catch (error) {
      console.error(`❌ Mock: Error loading ${sourceConfig.file}:`, error.message);
      return null;
    }
  }

  async updateData(sourceConfig, entryId, updates) {
    const filePath = path.join(process.cwd(), this.basePath, `${sourceConfig.file}.json`);
    
    try {
      let data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      
      if (Array.isArray(data)) {
        const entryIndex = data.findIndex(item => 
          item.id === entryId || 
          item.orderId === entryId || 
          item.batchId === entryId ||
          item.issueId === entryId
        );
        
        if (entryIndex !== -1) {
          data[entryIndex] = { ...data[entryIndex], ...updates, lastUpdated: new Date().toISOString() };
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
          console.log(`💾 Mock: Updated ${entryId} in ${sourceConfig.file}`);
          return data[entryIndex];
        }
      }
      
      throw new Error(`Entry ${entryId} not found`);
    } catch (error) {
      console.error(`❌ Mock: Update failed:`, error.message);
      throw error;
    }
  }

  getName() {
    return "MockDataSource";
  }
}

// ========================================================================
// SAP API DATA SOURCE (Production)
// ========================================================================

class SAPDataSource extends DataSource {
  constructor(config) {
    super();
    this.baseUrl = config.baseUrl || process.env.SAP_API_BASE_URL;
    this.username = config.username || process.env.SAP_USERNAME;
    this.password = config.password || process.env.SAP_PASSWORD;
    this.client = config.client || process.env.SAP_CLIENT;
    this.timeout = config.timeout || 30000;
    this.defaultPlant = config.defaultPlant || process.env.SAP_DEFAULT_PLANT;
  }

  async fetchData(sourceConfig) {
    try {
      const url = this.buildSAPUrl(sourceConfig);
      console.log(`🌐 SAP: Fetching from ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
          'sap-client': this.client,
          ...sourceConfig.headers
        },
        timeout: this.timeout
      });

      if (!response.ok) {
        throw new Error(`SAP API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const transformedData = this.transformSAPResponse(data, sourceConfig);
      
      console.log(`✅ SAP: Loaded ${sourceConfig.file} (${transformedData.length || Object.keys(transformedData).length} entries)`);
      return transformedData;
      
    } catch (error) {
      console.error(`❌ SAP: Error fetching ${sourceConfig.file}:`, error.message);
      throw error;
    }
  }

  buildSAPUrl(sourceConfig) {
    let url = `${this.baseUrl}${sourceConfig.endpoint}`;
    const queryParams = new URLSearchParams();
    
    if (sourceConfig.staticParams) {
      Object.entries(sourceConfig.staticParams).forEach(([key, value]) => {
        const resolvedValue = this.resolveEnvironmentVariable(value);
        queryParams.append(key, resolvedValue);
      });
    }
    
    const filters = this.buildSAPFilters(sourceConfig);
    if (filters) queryParams.append('$filter', filters);
    if (sourceConfig.selectFields) queryParams.append('$select', sourceConfig.selectFields.join(','));
    if (sourceConfig.orderBy) queryParams.append('$orderby', sourceConfig.orderBy);
    if (sourceConfig.top) queryParams.append('$top', sourceConfig.top.toString());
    queryParams.append('$format', 'json');
    
    const queryString = queryParams.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  buildSAPFilters(sourceConfig) {
    const filters = [];
    const plant = sourceConfig.plant || this.defaultPlant;
    if (plant) filters.push(`Plant eq '${plant}'`);
    if (sourceConfig.orderType) filters.push(`OrderType eq '${sourceConfig.orderType}'`);
    if (sourceConfig.mrpController) filters.push(`MRPController eq '${sourceConfig.mrpController}'`);
    return filters.length > 0 ? filters.join(' and ') : null;
  }

  resolveEnvironmentVariable(value) {
    if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
      const envVar = value.slice(2, -1);
      const [varName, defaultValue] = envVar.split(':');
      return process.env[varName] || defaultValue || value;
    }
    return value;
  }

  async updateData() {
    throw new Error("SAPDataSource update not implemented in this version");
  }

  getAuthHeader() {
    const credentials = btoa(`${this.username}:${this.password}`);
    return `Basic ${credentials}`;
  }

  transformSAPResponse(sapData, sourceConfig) {
    if (sourceConfig.transform && typeof sourceConfig.transform === 'function') {
      return sourceConfig.transform(sapData);
    }
    if (sapData.d && sapData.d.results) return sapData.d.results;
    if (sapData.value) return sapData.value;
    return sapData;
  }

  getName() {
    return "SAPDataSource";
  }
}

// ========================================================================
// REST API DATA SOURCE
// ========================================================================

class RestAPIDataSource extends DataSource {
  constructor(config) {
    super();
    this.baseUrl = config.baseUrl;
    this.headers = config.headers || {};
    this.timeout = config.timeout || 15000;
  }

  async fetchData(sourceConfig) {
    try {
      const url = `${this.baseUrl}${sourceConfig.endpoint}`;
      console.log(`🌐 REST: Fetching from ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: { ...this.headers, ...sourceConfig.headers },
        timeout: this.timeout
      });

      if (!response.ok) {
        throw new Error(`REST API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ REST: Loaded ${sourceConfig.file}`);
      return data;
      
    } catch (error) {
      console.error(`❌ REST: Error fetching ${sourceConfig.file}:`, error.message);
      throw error;
    }
  }

  async updateData() {
    throw new Error("RestAPIDataSource update not implemented in this version");
  }

  getName() {
    return "RestAPIDataSource";
  }
}
// ========================================================================
// OEE MQTT DATA SOURCE (Realtime OEE from MQTT)
// ========================================================================

class OEEDataSource extends DataSource {
  constructor(config) {
    super();
    this.brokerUrl = config.brokerUrl || process.env.MQTT_BROKER_URL;
    this.topicBase = config.topicBase || process.env.MQTT_TOPIC_BASE || "plc";
    this.client = null;
    this.data = new Map(); // line → last payload
    this.connect();
  }

  connect() {
    const options = {};

    // Prüfen, ob User/Pass gesetzt sind
    if (process.env.MQTT_USER && process.env.MQTT_PASS) {
      options.username = process.env.MQTT_USER;
      options.password = process.env.MQTT_PASS;
      console.log(`🔑 Using MQTT authentication with user "${process.env.MQTT_USER}"`);
    } else {
      console.log("🔓 Connecting to MQTT broker without authentication");
    }

    this.client = mqtt.connect(this.brokerUrl, options);

this.client.on("connect", () => {
  console.log(`📡 OEEDataSource connected to MQTT: ${this.brokerUrl}`);
  const topic = `${this.topicBase}/+/status`;
  console.log(`🔍 Subscribing to MQTT topic: ${topic}`);
  this.client.subscribe(topic);
});

this.client.on("message", (topic, message) => {
  try {
    const msgStr = message.toString();
    console.log(`🔍 MQTT DEBUG: Topic=${topic}, Message=${msgStr}`);
    
    if (!msgStr.startsWith("{") && !msgStr.startsWith("[")) {
      console.warn(`⚠️ Ignored non-JSON MQTT message on ${topic}: ${msgStr}`);
      return;
    }

    const payload = JSON.parse(msgStr);
    console.log(`🔍 MQTT DEBUG: Parsed payload=`, payload);

    if (payload && payload.line && payload.metrics) {
      this.data.set(payload.line, payload);
      console.log(`📊 OEE update received for ${payload.line}, total entries: ${this.data.size}`);
    } else {
      console.warn(`⚠️ Ignored invalid OEE payload on ${topic}:`, payload);
    }

  } catch (err) {
    console.error(`❌ OEEDataSource parse error on ${topic}:`, err.message);
  }
});

    this.client.on("error", (err) => {
      console.error("❌ OEEDataSource MQTT error:", err.message);
    });
  }

async fetchData() {
  console.log(`🔍 OEE fetchData called, data.size=${this.data.size}`);
  const result = Array.from(this.data.values());
  console.log(`🔍 OEE fetchData returning:`, result);
  return result;
}

  async updateData() {
    throw new Error("OEEDataSource is read-only");
  }

  getName() {
    return "OEEDataSource";
  }
}


// ========================================================================
// DATA SOURCE FACTORY
// ========================================================================
class DataSourceFactory {
  static createDataSource(type, config = {}) {
    switch (type.toLowerCase()) {
      case 'mock':
        return new MockDataSource(config.basePath);
      case 'sap':
        return new SAPDataSource(config);
      case 'rest':
        return new RestAPIDataSource(config);
      case 'oee': // 🆕
        return new OEEDataSource(config);
      default:
        throw new Error(`Unknown data source type: ${type}`);
    }
  }
}

// ========================================================================
// ENHANCED DATA MANAGER
// ========================================================================

export class DataManager {
  constructor(configPath = "src/config/data-sources.yaml") {
    this.dataSources = new Map();
    this.dataCache = new Map();
    this.sourceConfigs = new Map();
    this.configPath = configPath;
    
    console.log("📊 Enhanced DataManager initialized");
  }

  async loadDataSourceConfig() {
    try {
      const configFile = path.join(process.cwd(), this.configPath);
      if (!fs.existsSync(configFile)) {
        console.log("📋 No data source config found, using defaults");
        this.setDefaultConfig();
        return;
      }

      const yaml = await import('js-yaml');
      const config = yaml.load(fs.readFileSync(configFile, 'utf8'));
      
      for (const [dataType, sourceConfig] of Object.entries(config.dataSources)) {
        this.sourceConfigs.set(dataType, sourceConfig);
        if (!this.dataSources.has(sourceConfig.type)) {
          const dataSource = DataSourceFactory.createDataSource(sourceConfig.type, sourceConfig.config);
          this.dataSources.set(sourceConfig.type, dataSource);
        }
      }
      
      console.log("✅ Data source configuration loaded");
      console.log("🔗 Configured sources:", Array.from(this.sourceConfigs.keys()));
      
    } catch (error) {
      console.error("❌ Error loading data source config:", error.message);
      this.setDefaultConfig();
    }
  }

  setDefaultConfig() {
    const defaultSources = ['orders', 'issues', 'batches', 'compliance'];
    defaultSources.forEach(source => {
      this.sourceConfigs.set(source, {
        type: 'mock',
        file: source,
        config: { basePath: 'mock-data' }
      });
    });

    // 🆕 Add OEE MQTT as default
    this.sourceConfigs.set("oee", {
      type: "oee",
      config: {
        brokerUrl: process.env.MQTT_BROKER_URL,
        topicBase: process.env.MQTT_TOPIC_BASE || "plc"
      }
    });

    const mockSource = DataSourceFactory.createDataSource('mock');
    this.dataSources.set('mock', mockSource);

    const oeeSource = DataSourceFactory.createDataSource('oee', {
      brokerUrl: process.env.MQTT_BROKER_URL,
      topicBase: process.env.MQTT_TOPIC_BASE || "plc"
    });
    this.dataSources.set('oee', oeeSource);
  }

  async loadAllData() {
    console.log("🔄 Loading data from configured sources...");
    for (const [dataType] of this.sourceConfigs.entries()) {
      try {
        await this.loadDataType(dataType);
      } catch (error) {
        console.error(`❌ Failed to load ${dataType}:`, error.message);
      }
    }
    console.log(`🎯 Data loading completed. Cached: ${Array.from(this.dataCache.keys()).join(', ')}`);
  }

  async loadDataType(dataType) {
    const sourceConfig = this.sourceConfigs.get(dataType);
    if (!sourceConfig) throw new Error(`No source configuration for ${dataType}`);
    const dataSource = this.dataSources.get(sourceConfig.type);
    if (!dataSource) throw new Error(`No data source available for type ${sourceConfig.type}`);
    const data = await dataSource.fetchData(sourceConfig);
    if (data !== null) {
      this.dataCache.set(dataType, data);
      console.log(`📦 Cached ${dataType} from ${dataSource.getName()}`);
    }
    return data;
  }

async getCachedData(dataType, forceRefresh = false) {
  if (forceRefresh || !this.dataCache.has(dataType)) {
    await this.loadDataType(dataType);
  }
  return this.dataCache.get(dataType) || null;
}


  async updateDataEntry(dataType, entryId, updates) {
    const sourceConfig = this.sourceConfigs.get(dataType);
    if (!sourceConfig) throw new Error(`No source configuration for ${dataType}`);
    const dataSource = this.dataSources.get(sourceConfig.type);
    if (!dataSource) throw new Error(`No data source available for type ${sourceConfig.type}`);
    try {
      const result = await dataSource.updateData(sourceConfig, entryId, updates);
      await this.loadDataType(dataType);
      return result;
    } catch (error) {
      console.error(`❌ Error updating ${dataType}:`, error);
      throw error;
    }
  }

async getOrdersWithOEE() {
  const orders = (await this.getCachedData("orders", true)) || [];
  const oeeData = (await this.getCachedData("oee", true)) || [];

  if (!Array.isArray(orders)) {
    console.warn("⚠️ Orders data is not an array, normalizing...");
    return [];
  }  

  return orders.map(order => {
    // Falls mehrere Operationen → nimm die erste mit Workcenter
    const opWithWorkCenter = order.operations?.find(op => op.workCenter) || null;
    const workCenter = opWithWorkCenter ? opWithWorkCenter.workCenter : "UNKNOWN";

    const oeeMatch = oeeData.find(o => o.line === workCenter);

    return {
      ...order,
      workCenter,
      oee: oeeMatch || { status: "no-data", metrics: {} }
    };
  });
}

getRealtimeOEEData() {
  const oeeSource = this.dataSources.get('oee');
  if (oeeSource && oeeSource.data) {
    const data = Array.from(oeeSource.data.values());
    console.log(`📊 Real-time OEE: ${data.length} production lines`);
    return data;
  }
  console.warn("⚠️ OEE DataSource not available for real-time access");
  return [];
}

  extractFileName(source) {
    return path.basename(source, '.json');
  }

  getLoadedDataKeys() {
    return Array.from(this.dataCache.keys());
  }

  getDataStats() {
    const stats = {};
    this.dataCache.forEach((data, key) => {
      const sourceConfig = this.sourceConfigs.get(key);
      stats[key] = {
        type: Array.isArray(data) ? 'array' : 'object',
        entries: Array.isArray(data) ? data.length : Object.keys(data).length,
        source: sourceConfig ? sourceConfig.type : 'unknown',
        sample: Array.isArray(data) ? data[0] : Object.keys(data).slice(0, 3)
      };
    });
    return stats;
  }

  async reloadData() {
    try {
      this.dataCache.clear();
      await this.loadDataSourceConfig();
      await this.loadAllData();
      return true;
    } catch (error) {
      console.error("❌ Failed to reload data:", error);
      return false;
    }
  }

  getDataOverview(includeFullData = false) {
    const summary = Array.from(this.dataCache.entries()).map(([key, data]) => {
      const sourceConfig = this.sourceConfigs.get(key);
      return {
        file: key,
        source: sourceConfig ? sourceConfig.type : 'unknown',
        entries: Array.isArray(data) ? data.length : Object.keys(data).length,
        sample: Array.isArray(data) ? data[0] : Object.keys(data).slice(0, 3)
      };
    });
    
    return {
      loaded: Array.from(this.dataCache.keys()),
      summary,
      fullData: includeFullData ? Object.fromEntries(this.dataCache) : 'Use ?full=true to see all data',
      timestamp: new Date().toISOString(),
    };
  }

  validateDataIntegrity(requiredFiles = ['orders', 'issues', 'batches', 'compliance', 'oee']) {
    const missing = requiredFiles.filter(file => !this.dataCache.has(file));
    const isValid = missing.length === 0;
    return {
      isValid,
      missing,
      loaded: Array.from(this.dataCache.keys()),
      sources: Object.fromEntries(
        Array.from(this.sourceConfigs.entries()).map(([key, config]) => [key, config.type])
      ),
      timestamp: new Date().toISOString()
    };
  }

/**
 * Compatibility helper for agents.yaml
 * Returns all data for the configured agent sources
 */
getMockDataForAgent(agentConfig) {
  const results = {};

  if (!agentConfig?.dataSource) {
    return results;
  }

  agentConfig.dataSource.forEach(src => {
    try {
      // Datei-Namen aus dem Pfad ziehen (z.B. "mock-data/orders.json" → "orders")
      const key = this.extractFileName(src.replace(/^mock-data\//, ''));
      const data = this.getCachedData(key);
      if (data) {
        results[key] = data;
      }
    } catch (err) {
      console.warn(`⚠️ Could not load mock data for ${src}:`, err.message);
    }
  });

  return results;
}


}

export default DataManager;
