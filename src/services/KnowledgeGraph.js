// src/services/KnowledgeGraph.js - Phase 3 Manufacturing Knowledge Graph
import logger from "./logger.js";

/**
 * ManufacturingKnowledgeGraph - Contextual manufacturing intelligence
 * Models relationships between materials, processes, equipment, regulations
 */
export class ManufacturingKnowledgeGraph {
  constructor(llm = null) {
    this.llm = llm;
    
    // Core entities in manufacturing domain
    this.entities = {
      materials: new Map(),
      processes: new Map(), 
      equipment: new Map(),
      regulations: new Map(),
      personnel: new Map(),
      suppliers: new Map()
    };
    
    // Relationship types
    this.relationshipTypes = {
      'requires': { symmetric: false, strength: 1.0 },
      'produces': { symmetric: false, strength: 1.0 },
      'influences': { symmetric: true, strength: 0.8 },
      'regulates': { symmetric: false, strength: 0.9 },
      'operates': { symmetric: false, strength: 0.7 },
      'supplies': { symmetric: false, strength: 0.6 },
      'competes_with': { symmetric: true, strength: 0.5 },
      'depends_on': { symmetric: false, strength: 0.8 }
    };
    
    // Relationship graph
    this.relationships = new Map();
    
    // Context cache for performance
    this.contextCache = new Map();
    this.cacheTimeout = 300000; // 5 minutes
    
    // Initialize with pharmaceutical manufacturing knowledge
    this.initializePharmaceuticalKnowledge();
    
    logger.info('ManufacturingKnowledgeGraph initialized');
  }

  /**
   * Initialize with core pharmaceutical manufacturing knowledge
   */
  initializePharmaceuticalKnowledge() {
    // Core materials
    this.addEntity('materials', 'API_acetaminophen', {
      name: 'Acetaminophen API',
      type: 'active_pharmaceutical_ingredient',
      storageTemp: '15-25°C',
      shelfLife: '36 months',
      criticalQualityAttributes: ['purity', 'particle_size', 'moisture_content']
    });

    this.addEntity('materials', 'excipient_lactose', {
      name: 'Lactose Monohydrate',
      type: 'excipient',
      function: 'filler_binder',
      gradeCertification: 'USP/EP',
      allergenInfo: 'contains_lactose'
    });

    this.addEntity('materials', 'magnesium_stearate', {
      name: 'Magnesium Stearate',
      type: 'excipient',
      function: 'lubricant',
      concentration: '0.25-1.0%'
    });

    // Manufacturing processes
    this.addEntity('processes', 'wet_granulation', {
      name: 'Wet Granulation',
      type: 'solid_dosage_processing',
      criticalParameters: ['granulation_time', 'liquid_addition_rate', 'impeller_speed'],
      qualityControls: ['granule_size_distribution', 'moisture_content']
    });

    this.addEntity('processes', 'tablet_compression', {
      name: 'Tablet Compression',
      type: 'solid_dosage_forming',
      criticalParameters: ['compression_force', 'turret_speed', 'fill_depth'],
      qualityControls: ['tablet_hardness', 'weight_variation', 'content_uniformity']
    });

    this.addEntity('processes', 'coating', {
      name: 'Film Coating',
      type: 'solid_dosage_finishing',
      criticalParameters: ['spray_rate', 'inlet_temperature', 'pan_speed'],
      qualityControls: ['coat_weight', 'color_uniformity', 'dissolution']
    });

    // Equipment
    this.addEntity('equipment', 'mixer_granulator_001', {
      name: 'High Shear Mixer Granulator',
      model: 'Collette Gral 75',
      capacity: '75L',
      location: 'Production_Line_A',
      maintenanceSchedule: 'weekly',
      qualification: 'IQ_OQ_PQ_completed'
    });

    this.addEntity('equipment', 'tablet_press_002', {
      name: 'Rotary Tablet Press',
      model: 'Fette P2100',
      capacity: '400000_tablets_hour',
      tooling: 'B_tooling',
      location: 'Production_Line_A'
    });

    // Regulations
    this.addEntity('regulations', 'FDA_21CFR211', {
      name: 'FDA 21 CFR Part 211',
      type: 'cGMP_regulation',
      region: 'USA',
      scope: 'pharmaceutical_manufacturing',
      lastUpdated: '2023-01-01'
    });

    this.addEntity('regulations', 'GMP_EU', {
      name: 'EU GMP Guidelines',
      type: 'cGMP_regulation',
      region: 'Europe',
      scope: 'pharmaceutical_manufacturing',
      annexes: ['Annex_15_Qualification_Validation']
    });

    // Personnel
    this.addEntity('personnel', 'john_smith_qp', {
      name: 'John Smith',
      role: 'Qualified Person',
      certifications: ['EU_QP', 'Pharmacist'],
      responsibilities: ['batch_release', 'deviation_review'],
      experience_years: 15
    });

    // Suppliers
    this.addEntity('suppliers', 'pharma_materials_inc', {
      name: 'Pharma Materials Inc',
      type: 'API_supplier',
      qualification_status: 'approved',
      audit_frequency: 'annual',
      supplies: ['API_acetaminophen']
    });

    // Build relationships
    this.addRelationship('wet_granulation', 'processes', 'API_acetaminophen', 'materials', 'requires', 1.0);
    this.addRelationship('wet_granulation', 'processes', 'excipient_lactose', 'materials', 'requires', 1.0);
    this.addRelationship('wet_granulation', 'processes', 'mixer_granulator_001', 'equipment', 'requires', 1.0);
    this.addRelationship('tablet_compression', 'processes', 'tablet_press_002', 'equipment', 'requires', 1.0);
    this.addRelationship('FDA_21CFR211', 'regulations', 'wet_granulation', 'processes', 'regulates', 1.0);
    this.addRelationship('GMP_EU', 'regulations', 'tablet_compression', 'processes', 'regulates', 1.0);
    this.addRelationship('pharma_materials_inc', 'suppliers', 'API_acetaminophen', 'materials', 'supplies', 1.0);
  }

  /**
   * Add entity to knowledge graph
   */
  addEntity(category, id, properties) {
    if (!this.entities[category]) {
      this.entities[category] = new Map();
    }
    
    this.entities[category].set(id, {
      id,
      category,
      properties,
      addedAt: Date.now(),
      lastUpdated: Date.now()
    });
    
    logger.debug('Entity added to knowledge graph', { category, id });
  }

  /**
   * Add relationship between entities
   */
  addRelationship(fromId, fromCategory, toId, toCategory, relationshipType, strength = 1.0) {
    const relationshipId = `${fromCategory}:${fromId}->${relationshipType}->${toCategory}:${toId}`;
    
    this.relationships.set(relationshipId, {
      from: { id: fromId, category: fromCategory },
      to: { id: toId, category: toCategory },
      type: relationshipType,
      strength,
      bidirectional: this.relationshipTypes[relationshipType]?.symmetric || false,
      createdAt: Date.now()
    });
    
    // Add reverse relationship if symmetric
    if (this.relationshipTypes[relationshipType]?.symmetric) {
      const reverseId = `${toCategory}:${toId}->${relationshipType}->${fromCategory}:${fromId}`;
      this.relationships.set(reverseId, {
        from: { id: toId, category: toCategory },
        to: { id: fromId, category: fromCategory },
        type: relationshipType,
        strength,
        bidirectional: true,
        createdAt: Date.now()
      });
    }
    
    logger.debug('Relationship added', { from: fromId, to: toId, type: relationshipType });
  }

  /**
   * Query contextual knowledge for decision making
   */
  async queryContext(question, entities = []) {
    const cacheKey = `${question}-${entities.join(',')}`;
    
    if (this.contextCache.has(cacheKey)) {
      const cached = this.contextCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }
    
    try {
      // Find relevant entities and relationships
      const relevantContext = this.findRelevantContext(question, entities);
      
      // Use LLM for intelligent synthesis if available
      let synthesizedAnswer = null;
      if (this.llm && relevantContext.entities.length > 0) {
        synthesizedAnswer = await this.synthesizeWithLLM(question, relevantContext);
      }
      
      const result = {
        question,
        directMatches: relevantContext.entities,
        relationships: relevantContext.relationships,
        synthesizedAnswer,
        confidence: this.calculateConfidence(relevantContext),
        timestamp: Date.now()
      };
      
      // Cache result
      this.contextCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
      
    } catch (error) {
      logger.error('Context query failed', { question, error: error.message });
      return {
        question,
        error: error.message,
        directMatches: [],
        relationships: [],
        confidence: 0
      };
    }
  }

  /**
   * Find relevant context for a query
   */
  findRelevantContext(question, entityHints = []) {
    const questionLower = question.toLowerCase();
    const relevantEntities = [];
    const relevantRelationships = [];
    
    // Search through all entities
    for (const [category, entityMap] of Object.entries(this.entities)) {
      for (const [entityId, entity] of entityMap.entries()) {
        const relevanceScore = this.calculateEntityRelevance(entity, questionLower, entityHints);
        if (relevanceScore > 0.3) {
          relevantEntities.push({ ...entity, relevanceScore });
        }
      }
    }
    
    // Find relationships involving relevant entities
    const relevantEntityIds = new Set(relevantEntities.map(e => e.id));
    
    for (const [relationshipId, relationship] of this.relationships.entries()) {
      if (relevantEntityIds.has(relationship.from.id) || 
          relevantEntityIds.has(relationship.to.id)) {
        relevantRelationships.push(relationship);
      }
    }
    
    return {
      entities: relevantEntities.sort((a, b) => b.relevanceScore - a.relevanceScore),
      relationships: relevantRelationships
    };
  }

  /**
   * Calculate entity relevance to question
   */
  calculateEntityRelevance(entity, questionLower, entityHints) {
    let score = 0;
    
    // Direct ID match
    if (questionLower.includes(entity.id.toLowerCase())) {
      score += 1.0;
    }
    
    // Hint match
    if (entityHints.includes(entity.id)) {
      score += 0.8;
    }
    
    // Property matches
    const properties = entity.properties;
    if (properties.name && questionLower.includes(properties.name.toLowerCase())) {
      score += 0.9;
    }
    
    // Type/category matches
    if (questionLower.includes(entity.category)) {
      score += 0.6;
    }
    
    if (properties.type && questionLower.includes(properties.type.toLowerCase())) {
      score += 0.7;
    }
    
    // Keyword matches in properties
    const propertyText = JSON.stringify(properties).toLowerCase();
    const questionWords = questionLower.split(/\s+/);
    
    for (const word of questionWords) {
      if (word.length > 3 && propertyText.includes(word)) {
        score += 0.2;
      }
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Synthesize answer using LLM
   */
  async synthesizeWithLLM(question, context) {
    try {
      const prompt = this.buildContextPrompt(question, context);
      const response = await this.llm.complete(prompt);
      return response.trim();
    } catch (error) {
      logger.error('LLM synthesis failed', { error: error.message });
      return null;
    }
  }

  /**
   * Build context prompt for LLM
   */
  buildContextPrompt(question, context) {
    let prompt = `Based on the following pharmaceutical manufacturing knowledge, please answer this question: "${question}"\n\n`;
    
    prompt += "RELEVANT ENTITIES:\n";
    context.entities.forEach(entity => {
      prompt += `- ${entity.category.toUpperCase()}: ${entity.id}\n`;
      prompt += `  Properties: ${JSON.stringify(entity.properties, null, 2)}\n`;
    });
    
    prompt += "\nRELEVANT RELATIONSHIPS:\n";
    context.relationships.forEach(rel => {
      prompt += `- ${rel.from.category}:${rel.from.id} ${rel.type} ${rel.to.category}:${rel.to.id} (strength: ${rel.strength})\n`;
    });
    
    prompt += "\nPlease provide a concise, accurate answer based on this manufacturing knowledge. Focus on practical implications for pharmaceutical manufacturing operations.";
    
    return prompt;
  }

  /**
   * Calculate confidence score for context match
   */
  calculateConfidence(context) {
    if (context.entities.length === 0) return 0;
    
    const avgRelevance = context.entities.reduce((sum, e) => sum + e.relevanceScore, 0) / context.entities.length;
    const relationshipBonus = Math.min(context.relationships.length * 0.1, 0.3);
    
    return Math.min(avgRelevance + relationshipBonus, 1.0);
  }

  /**
   * Find entities connected to a specific entity
   */
  getConnectedEntities(entityId, entityCategory, maxDepth = 2) {
    const visited = new Set();
    const connected = [];
    
    const traverse = (currentId, currentCategory, depth) => {
      if (depth > maxDepth || visited.has(`${currentCategory}:${currentId}`)) {
        return;
      }
      
      visited.add(`${currentCategory}:${currentId}`);
      
      for (const [_, relationship] of this.relationships.entries()) {
        let connectedEntity = null;
        
        if (relationship.from.id === currentId && relationship.from.category === currentCategory) {
          connectedEntity = relationship.to;
        } else if (relationship.to.id === currentId && relationship.to.category === currentCategory) {
          connectedEntity = relationship.from;
        }
        
        if (connectedEntity && !visited.has(`${connectedEntity.category}:${connectedEntity.id}`)) {
          const entity = this.entities[connectedEntity.category]?.get(connectedEntity.id);
          if (entity) {
            connected.push({
              entity,
              relationship: relationship.type,
              distance: depth + 1
            });
            
            traverse(connectedEntity.id, connectedEntity.category, depth + 1);
          }
        }
      }
    };
    
    traverse(entityId, entityCategory, 0);
    return connected;
  }

  /**
   * Export knowledge graph for visualization or backup
   */
  exportGraph() {
    return {
      entities: Object.fromEntries(
        Object.entries(this.entities).map(([category, entityMap]) => [
          category,
          Object.fromEntries(entityMap)
        ])
      ),
      relationships: Object.fromEntries(this.relationships),
      metadata: {
        totalEntities: Object.values(this.entities).reduce((sum, map) => sum + map.size, 0),
        totalRelationships: this.relationships.size,
        relationshipTypes: Object.keys(this.relationshipTypes),
        exportedAt: Date.now()
      }
    };
  }

  /**
   * Get knowledge graph statistics
   */
  getStatistics() {
    const entityCounts = Object.fromEntries(
      Object.entries(this.entities).map(([category, entityMap]) => [category, entityMap.size])
    );
    
    const relationshipTypeCount = {};
    for (const relationship of this.relationships.values()) {
      relationshipTypeCount[relationship.type] = (relationshipTypeCount[relationship.type] || 0) + 1;
    }
    
    return {
      entities: entityCounts,
      totalEntities: Object.values(entityCounts).reduce((sum, count) => sum + count, 0),
      relationships: relationshipTypeCount,
      totalRelationships: this.relationships.size,
      cacheSize: this.contextCache.size,
      lastUpdated: Date.now()
    };
  }
}

export default ManufacturingKnowledgeGraph;