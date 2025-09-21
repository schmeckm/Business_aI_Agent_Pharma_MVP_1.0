/**
 * ========================================================================
 * FLEXIBLE DATA MANAGER WITH SAP API SUPPORT
 * ========================================================================
 * 
 * Multi-source data management system supporting:
 * - Mock JSON files (Development)
 * - SAP APIs (Production)
 * - Other external APIs
 * 
 * Developer: Markus Schmeckenbecher
 * Version: 1.3.0
 * ========================================================================
 */

import fs from "fs";
import path from "path";

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
// SAP API DATA SOURCE (Production) - Enhanced with Parameters
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
      
      // Transform SAP response to expected format
      const transformedData = this.transformSAPResponse(data, sourceConfig);
      
      console.log(`✅ SAP: Loaded ${sourceConfig.file} (${transformedData.length || Object.keys(transformedData).length} entries)`);
      return transformedData;
      
    } catch (error) {
      console.error(`❌ SAP: Error fetching ${sourceConfig.file}:`, error.message);
      throw error;
    }
  }

  /**
   * Build SAP URL with Parameters and Filters
   */
  buildSAPUrl(sourceConfig) {
    let url = `${this.baseUrl}${sourceConfig.endpoint}`;
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    
    // Add static parameters from config
    if (sourceConfig.staticParams) {
      Object.entries(sourceConfig.staticParams).forEach(([key, value]) => {
        // Replace environment variables in static params
        const resolvedValue = this.resolveEnvironmentVariable(value);
        queryParams.append(key, resolvedValue);
      });
    }
    
    // Add SAP OData filters
    const filters = this.buildSAPFilters(sourceConfig);
    if (filters) {
      queryParams.append('$filter', filters);
    }
    
    // Add SAP OData select fields
    if (sourceConfig.selectFields) {
      queryParams.append('$select', sourceConfig.selectFields.join(','));
    }
    
    // Add SAP OData ordering
    if (sourceConfig.orderBy) {
      queryParams.append('$orderby', sourceConfig.orderBy);
    }
    
    // Add SAP OData top (limit)
    if (sourceConfig.top) {
      queryParams.append('$top', sourceConfig.top.toString());
    }
    
    // Add format parameter for JSON
    queryParams.append('$format', 'json');
    
    const queryString = queryParams.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  /**
   * Build SAP OData Filters
   */
  buildSAPFilters(sourceConfig) {
    const filters = [];
    
    // Plant filter (most important for SAP)
    const plant = sourceConfig.plant || this.defaultPlant;
    if (plant) {
      filters.push(`Plant eq '${plant}'`);
    }
    
    // Order Type filter
    if (sourceConfig.orderType) {
      filters.push(`OrderType eq '${sourceConfig.orderType}'`);
    }
    
    // MRP Controller filter
    if (sourceConfig.mrpController) {
      filters.push(`MRPController eq '${sourceConfig.mrpController}'`);
    }
    
    // Status filters
    if (sourceConfig.statusFilter) {
      if (Array.isArray(sourceConfig.statusFilter)) {
        const statusFilters = sourceConfig.statusFilter.map(status => `Status eq '${status}'`);
        filters.push(`(${statusFilters.join(' or ')})`);
      } else {
        filters.push(`Status eq '${sourceConfig.statusFilter}'`);
      }
    }
    
    // Date range filters
    if (sourceConfig.dateFilter) {
      const { field, from, to } = sourceConfig.dateFilter;
      if (from) {
        filters.push(`${field} ge datetime'${from}'`);
      }
      if (to) {
        filters.push(`${field} le datetime'${to}'`);
      }
    }
    
    // Material filter
    if (sourceConfig.materialFilter) {
      if (Array.isArray(sourceConfig.materialFilter)) {
        const materialFilters = sourceConfig.materialFilter.map(mat => `Material eq '${mat}'`);
        filters.push(`(${materialFilters.join(' or ')})`);
      } else {
        filters.push(`Material eq '${sourceConfig.materialFilter}'`);
      }
    }
    
    // Custom filters from config
    if (sourceConfig.customFilters) {
      filters.push(...sourceConfig.customFilters);
    }
    
    return filters.length > 0 ? filters.join(' and ') : null;
  }

  /**
   * Resolve Environment Variables in Config
   */
  resolveEnvironmentVariable(value) {
    if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
      const envVar = value.slice(2, -1);
      const [varName, defaultValue] = envVar.split(':');
      return process.env[varName] || defaultValue || value;
    }
    return value;
  }

  async updateData(sourceConfig, entryId, updates) {
    try {
      // For updates, we might need to include plant in the URL
      const plant = sourceConfig.plant || this.defaultPlant;
      let url = `${this.baseUrl}${sourceConfig.updateEndpoint || sourceConfig.endpoint}`;
      
      // Some SAP services require plant in the key
      if (sourceConfig.requirePlantInKey && plant) {
        url += `(OrderId='${entryId}',Plant='${plant}')`;
      } else {
        url += `('${entryId}')`;
      }
      
      // Transform updates to SAP format
      const sapData = this.transformToSAPFormat(updates, sourceConfig);
      
      // Add plant to update data if required
      if (plant && sourceConfig.includePlantInUpdate) {
        sapData.Plant = plant;
      }
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
          'sap-client': this.client,
          'X-Requested-With': 'XMLHttpRequest',
          ...sourceConfig.headers
        },
        body: JSON.stringify(sapData),
        timeout: this.timeout
      });

      if (!response.ok) {
        throw new Error(`SAP update error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`💾 SAP: Updated ${entryId} in plant ${plant}`);
      
      return this.transformSAPResponse(result, sourceConfig);
      
    } catch (error) {
      console.error(`❌ SAP: Update failed:`, error.message);
      throw error;
    }
  }

  getAuthHeader() {
    const credentials = btoa(`${this.username}:${this.password}`);
    return `Basic ${credentials}`;
  }

  transformSAPResponse(sapData, sourceConfig) {
    // Default transformation - can be overridden per source
    if (sourceConfig.transform && typeof sourceConfig.transform === 'function') {
      return sourceConfig.transform(sapData);
    }
    
    // Standard SAP OData response handling
    if (sapData.d && sapData.d.results) {
      return sapData.d.results;
    }
    
    if (sapData.value) {
      return sapData.value;
    }
    
    return sapData;
  }

  transformToSAPFormat(data, sourceConfig) {
    // Transform our format to SAP format
    if (sourceConfig.reverseTransform && typeof sourceConfig.reverseTransform === 'function') {
      return sourceConfig.reverseTransform(data);
    }
    
    return data;
  }

  getName() {
    return "SAPDataSource";
  }
}

// ========================================================================
// GENERIC REST API DATA SOURCE
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

  async updateData(sourceConfig, entryId, updates) {
    try {
      const url = `${this.baseUrl}${sourceConfig.updateEndpoint || sourceConfig.endpoint}/${entryId}`;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...this.headers, 
          ...sourceConfig.headers 
        },
        body: JSON.stringify(updates),
        timeout: this.timeout
      });

      if (!response.ok) {
        throw new Error(`REST update error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`💾 REST: Updated ${entryId}`);
      return result;
      
    } catch (error) {
      console.error(`❌ REST: Update failed:`, error.message);
      throw error;
    }
  }

  getName() {
    return "RestAPIDataSource";
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
      
      default:
        throw new Error(`Unknown data source type: ${type}`);
    }
  }
}

// ========================================================================
// ENHANCED DATA MANAGER
// ========================================================================

export class DataManager {
  constructor(configPath = "config/data-sources.yaml") {
    this.dataSources = new Map();
    this.dataCache = new Map();
    this.sourceConfigs = new Map();
    this.configPath = configPath;
    
    console.log("📊 Enhanced DataManager initialized");
  }

  /**
   * Load Data Source Configuration
   * Defines which data source to use for each data type
   */
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
      
      // Initialize data sources based on config
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
    // Default to mock data for all sources
    const defaultSources = ['orders', 'issues', 'batches', 'compliance'];
    
    defaultSources.forEach(source => {
      this.sourceConfigs.set(source, {
        type: 'mock',
        file: source,
        config: { basePath: 'mock-data' }
      });
    });

    const mockSource = DataSourceFactory.createDataSource('mock');
    this.dataSources.set('mock', mockSource);
  }

  /**
   * Load All Data from Configured Sources
   */
  async loadAllData() {
    console.log("🔄 Loading data from configured sources...");
    
    for (const [dataType, sourceConfig] of this.sourceConfigs.entries()) {
      try {
        await this.loadDataType(dataType);
      } catch (error) {
        console.error(`❌ Failed to load ${dataType}:`, error.message);
      }
    }
    
    console.log(`🎯 Data loading completed. Cached: ${Array.from(this.dataCache.keys()).join(', ')}`);
  }

  /**
   * Load Specific Data Type
   */
  async loadDataType(dataType) {
    const sourceConfig = this.sourceConfigs.get(dataType);
    if (!sourceConfig) {
      throw new Error(`No source configuration for ${dataType}`);
    }

    const dataSource = this.dataSources.get(sourceConfig.type);
    if (!dataSource) {
      throw new Error(`No data source available for type ${sourceConfig.type}`);
    }

    const data = await dataSource.fetchData(sourceConfig);
    if (data !== null) {
      this.dataCache.set(dataType, data);
      console.log(`📦 Cached ${dataType} from ${dataSource.getName()}`);
    }
    
    return data;
  }

  /**
   * Get Mock Data for Agent (Enhanced)
   * Supports both cached and live data fetching
   */
  getMockDataForAgent(dataSource, forceRefresh = false) {
    if (!dataSource) return "No data source configured";
    
    try {
      if (Array.isArray(dataSource)) {
        // Multiple data sources
        const allData = {};
        dataSource.forEach(source => {
          const fileName = this.extractFileName(source);
          const data = this.getCachedData(fileName, forceRefresh);
          allData[fileName] = data;
        });
        return JSON.stringify(allData, null, 2);
      } else {
        // Single data source
        const fileName = this.extractFileName(dataSource);
        const data = this.getCachedData(fileName, forceRefresh);
        return JSON.stringify(data, null, 2);
      }
    } catch (error) {
      console.error('❌ Error preparing data for agent:', error);
      return `Error preparing data: ${error.message}`;
    }
  }

  getCachedData(dataType, forceRefresh = false) {
    if (forceRefresh || !this.dataCache.has(dataType)) {
      // Trigger async reload but return cached data if available
      this.loadDataType(dataType).catch(error => 
        console.error(`Background reload failed for ${dataType}:`, error)
      );
    }
    
    return this.dataCache.get(dataType) || null;
  }

  /**
   * Update Data Entry (Enhanced)
   * Routes to appropriate data source for updates
   */
  async updateDataEntry(dataType, entryId, updates) {
    const sourceConfig = this.sourceConfigs.get(dataType);
    if (!sourceConfig) {
      throw new Error(`No source configuration for ${dataType}`);
    }

    const dataSource = this.dataSources.get(sourceConfig.type);
    if (!dataSource) {
      throw new Error(`No data source available for type ${sourceConfig.type}`);
    }

    try {
      const result = await dataSource.updateData(sourceConfig, entryId, updates);
      
      // Update cache
      await this.loadDataType(dataType);
      
      return result;
    } catch (error) {
      console.error(`❌ Error updating ${dataType}:`, error);
      throw error;
    }
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

  validateDataIntegrity(requiredFiles = ['orders', 'issues', 'batches', 'compliance']) {
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
}

export default DataManager;