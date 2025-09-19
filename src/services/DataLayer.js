// src/services/DataLayer.js - Centralized Data Management
import logger from './logger.js';
import { readJson } from '../utils/jsonfile.js';
import { evaluateRmsl } from '../utils/rmsl.js';

/**
 * Centralized data layer for manufacturing operations
 * Provides consistent interface for data access with validation and caching
 */
export class DataLayer {
  constructor(initialData = {}) {
    this.data = {
      orders: [],
      inventory: [],
      bom: {},
      rules: [],
      masterdata: {},
      equipment: [],
      qualityControl: [],
      ...initialData
    };
    
    this.cache = new Map();
    this.cacheTimeout = 300000; // 5 minutes
    this.metrics = {
      queries: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    logger.info('DataLayer initialized', { 
      orders: this.data.orders.length,
      materials: Object.keys(this.data.masterdata).length
    });
  }

  /**
   * Load data from multiple sources
   */
  async loadData(sources = []) {
    try {
      for (const source of sources) {
        if (typeof source === 'string') {
          // File path
          const fileData = readJson(source);
          this.mergeData(fileData);
          logger.info('Data loaded from file', { source, records: this.countRecords(fileData) });
        } else if (typeof source === 'object') {
          // Direct data object
          this.mergeData(source);
          logger.info('Data loaded from object', { records: this.countRecords(source) });
        }
      }
    } catch (error) {
      logger.error('Failed to load data', { error: error.message });
      throw error;
    }
  }

  /**
   * Merge new data into existing data structure
   */
  mergeData(newData) {
    if (Array.isArray(newData)) {
      // Assume it's orders if it's an array
      this.data.orders = [...this.data.orders, ...newData];
    } else if (typeof newData === 'object') {
      for (const [key, value] of Object.entries(newData)) {
        if (Array.isArray(value) && Array.isArray(this.data[key])) {
          this.data[key] = [...this.data[key], ...value];
        } else if (typeof value === 'object' && typeof this.data[key] === 'object') {
          this.data[key] = { ...this.data[key], ...value };
        } else {
          this.data[key] = value;
        }
      }
    }
    
    // Clear cache when data changes
    this.clearCache();
  }

  /**
   * Get cached result or execute query
   */
  async getCached(key, queryFn) {
    this.metrics.queries++;
    
    if (this.cache.has(key)) {
      const cached = this.cache.get(key);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        this.metrics.cacheHits++;
        return cached.data;
      } else {
        this.cache.delete(key);
      }
    }
    
    this.metrics.cacheMisses++;
    const result = await queryFn();
    
    this.cache.set(key, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  }

  /**
   * Orders operations
   */
  async listOrders(filters = {}) {
    const cacheKey = `orders_${JSON.stringify(filters)}`;
    return this.getCached(cacheKey, () => {
      let orders = [...this.data.orders];
      
      if (filters.status) {
        orders = orders.filter(o => o.status === filters.status);
      }
      
      if (filters.material) {
        orders = orders.filter(o => o.material === filters.material);
      }
      
      if (filters.country) {
        orders = orders.filter(o => o.country === filters.country);
      }
      
      if (filters.priority) {
        orders = orders.filter(o => o.priority === filters.priority);
      }
      
      if (filters.limit) {
        orders = orders.slice(0, filters.limit);
      }
      
      return orders;
    });
  }

  async getOrder(orderId) {
    return this.getCached(`order_${orderId}`, () => {
      return this.data.orders.find(o => o.id === orderId) || null;
    });
  }

  async updateOrder(orderId, updates) {
    const orderIndex = this.data.orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) {
      throw new Error(`Order ${orderId} not found`);
    }
    
    this.data.orders[orderIndex] = {
      ...this.data.orders[orderIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.clearCachePattern(`order_${orderId}`);
    this.clearCachePattern('orders_');
    
    logger.info('Order updated', { orderId, updates: Object.keys(updates) });
    return this.data.orders[orderIndex];
  }

  /**
   * Inventory operations
   */
  async getInventory(filters = {}) {
    const cacheKey = `inventory_${JSON.stringify(filters)}`;
    return this.getCached(cacheKey, () => {
      let inventory = [...this.data.inventory];
      
      if (filters.material) {
        inventory = inventory.filter(i => i.material === filters.material);
      }
      
      if (filters.location) {
        inventory = inventory.filter(i => i.storageLocation === filters.location);
      }
      
      if (filters.status) {
        inventory = inventory.filter(i => i.qualityStatus === filters.status);
      }
      
      if (filters.lowStock) {
        inventory = inventory.filter(i => 
          i.qty <= (i.reorderLevel || 0)
        );
      }
      
      return inventory;
    });
  }

  async getInventoryByMaterial(material) {
    return this.getCached(`inventory_material_${material}`, () => {
      return this.data.inventory.find(i => i.material === material) || null;
    });
  }

  /**
   * BOM operations
   */
  async getBom(material) {
    return this.getCached(`bom_${material}`, () => {
      return this.data.bom[material] || [];
    });
  }

  async getBomTree(material, maxDepth = 3) {
    const cacheKey = `bom_tree_${material}_${maxDepth}`;
    return this.getCached(cacheKey, async () => {
      const buildTree = async (mat, depth = 0) => {
        if (depth >= maxDepth) return { material: mat, components: [] };
        
        const bom = await this.getBom(mat);
        const components = await Promise.all(
          bom.map(async component => ({
            ...component,
            subComponents: await buildTree(component.component, depth + 1)
          }))
        );
        
        return { material: mat, components };
      };
      
      return buildTree(material);
    });
  }

  /**
   * Master data operations
   */
  async getMasterData(material) {
    return this.getCached(`masterdata_${material}`, () => {
      return this.data.masterdata[material] || null;
    });
  }

  async validateMaterial(material) {
    const md = await this.getMasterData(material);
    return md?.status === 'Active';
  }

  /**
   * Rules operations
   */
  async getTricRules(filters = {}) {
    const cacheKey = `rules_${JSON.stringify(filters)}`;
    return this.getCached(cacheKey, () => {
      let rules = [...this.data.rules];
      
      if (filters.material) {
        rules = rules.filter(r => r.material === filters.material);
      }
      
      if (filters.country) {
        rules = rules.filter(r => r.country === filters.country);
      }
      
      if (filters.type) {
        rules = rules.filter(r => r.type === filters.type);
      }
      
      return rules;
    });
  }

  async getRmslRule(material, country) {
    const rules = await this.getTricRules({ material, country, type: 'RMSL' });
    return rules[0] || null;
  }

  /**
   * Equipment operations
   */
  async getEquipment(filters = {}) {
    const cacheKey = `equipment_${JSON.stringify(filters)}`;
    return this.getCached(cacheKey, () => {
      let equipment = [...this.data.equipment];
      
      if (filters.status) {
        equipment = equipment.filter(e => e.status === filters.status);
      }
      
      if (filters.location) {
        equipment = equipment.filter(e => e.location === filters.location);
      }
      
      if (filters.type) {
        equipment = equipment.filter(e => e.name.toLowerCase().includes(filters.type.toLowerCase()));
      }
      
      return equipment;
    });
  }

  async getEquipmentById(equipmentId) {
    return this.getCached(`equipment_${equipmentId}`, () => {
      return this.data.equipment.find(e => e.equipmentId === equipmentId) || null;
    });
  }

  /**
   * Quality Control operations
   */
  async getQcLots(filters = {}) {
    const cacheKey = `qc_${JSON.stringify(filters)}`;
    return this.getCached(cacheKey, () => {
      let qc = [...this.data.qualityControl];
      
      if (filters.material) {
        qc = qc.filter(q => q.productName.includes(filters.material));
      }
      
      if (filters.status) {
        qc = qc.filter(q => q.overallResult === filters.status);
      }
      
      if (filters.date) {
        qc = qc.filter(q => q.testDate === filters.date);
      }
      
      return qc;
    });
  }

  /**
   * Comprehensive order assessment
   */
  async assessOrder(order) {
    const cacheKey = `assessment_${order.id}_${order.material}_${order.qty}`;
    return this.getCached(cacheKey, async () => {
      const material = order.material;
      const qty = order.qty || 0;
      const country = order.country || 'EU';
      
      // Get all required data
      const [bom, inventory, rules, masterData] = await Promise.all([
        this.getBom(material),
        this.getInventory(),
        this.getTricRules({ material, country }),
        this.getMasterData(material)
      ]);
      
      // Calculate material needs
      const needs = bom.map(component => ({
        component: component.component,
        need: qty * (component.perFG || 0),
        uom: component.uom || 'PCS'
      }));
      
      // Check inventory availability
      const missing = needs.filter(need => {
        const stock = inventory.find(i => i.material === need.component)?.qty || 0;
        return stock < need.need;
      });
      
      // TRIC compliance check
      const tricRules = rules.filter(r => r.type === 'TRIC');
      const tricOk = tricRules.every(r => r.status !== 'notallowed');
      
      // RMSL compliance check
      const rmslRule = rules.find(r => r.type === 'RMSL');
      let rmslOk = true;
      let rmslDetails = null;
      
      if (rmslRule) {
        const bulkMaterial = `BULK-${material.split('-')[1] || ''}`;
        const bulkInventory = inventory.find(i => i.material === bulkMaterial);
        
        if (bulkInventory) {
          rmslDetails = evaluateRmsl({ rmslRule, invEntry: bulkInventory, md: masterData });
          rmslOk = rmslDetails.rmslOk;
        }
      }
      
      // Master data check
      const mdOk = masterData?.status === 'Active';
      
      // Overall assessment
      const ok = tricOk && rmslOk && mdOk && missing.length === 0;
      
      return {
        ok,
        material,
        qty,
        country,
        checks: {
          tricOk,
          rmslOk,
          mdOk,
          inventoryOk: missing.length === 0
        },
        details: {
          missing,
          needs,
          rmsl: rmslDetails,
          bomComponents: bom.length,
          applicableRules: rules.length
        },
        timestamp: new Date().toISOString()
      };
    });
  }

  /**
   * Batch operations
   */
  async assessMultipleOrders(orderIds) {
    const orders = await Promise.all(
      orderIds.map(id => this.getOrder(id))
    );
    
    const assessments = await Promise.all(
      orders.filter(Boolean).map(order => this.assessOrder(order))
    );
    
    return {
      total: assessments.length,
      releasable: assessments.filter(a => a.ok),
      blocked: assessments.filter(a => !a.ok),
      assessments
    };
  }

  /**
   * Cache management
   */
  clearCache() {
    this.cache.clear();
    logger.debug('Cache cleared');
  }

  clearCachePattern(pattern) {
    for (const [key] of this.cache.entries()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Metrics and health
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      hitRate: this.metrics.queries > 0 ? this.metrics.cacheHits / this.metrics.queries : 0,
      dataStats: {
        orders: this.data.orders.length,
        inventory: this.data.inventory.length,
        materials: Object.keys(this.data.masterdata).length,
        bomEntries: Object.keys(this.data.bom).length,
        rules: this.data.rules.length,
        equipment: this.data.equipment.length,
        qcRecords: this.data.qualityControl.length
      }
    };
  }

  async healthCheck() {
    try {
      // Test basic operations
      await this.listOrders({ limit: 1 });
      await this.getInventory({ limit: 1 });
      
      return {
        ok: true,
        metrics: this.getMetrics(),
        status: 'operational'
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message,
        status: 'error'
      };
    }
  }

  /**
   * Utility methods
   */
  countRecords(data) {
    if (Array.isArray(data)) return data.length;
    if (typeof data === 'object') {
      return Object.values(data).reduce((count, value) => {
        if (Array.isArray(value)) return count + value.length;
        if (typeof value === 'object') return count + Object.keys(value).length;
        return count + 1;
      }, 0);
    }
    return 0;
  }

  /**
   * Export current data state
   */
  exportData() {
    return {
      ...this.data,
      exportedAt: new Date().toISOString(),
      metrics: this.getMetrics()
    };
  }
}

export default DataLayer;