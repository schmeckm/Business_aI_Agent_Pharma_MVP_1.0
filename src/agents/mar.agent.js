// Enhanced MAR Agent with AI Integration - Version 3
// Complete implementation with Phase 3 capabilities

import { EventEmitter } from 'events';
import logger from '../services/logger.js';

/**
 * Enhanced Manufacturing Agent with AI Integration - Version 3
 * Features Phase 3 capabilities: Consensus Engine, Knowledge Graph, 
 * Predictive Intelligence, Autonomous Orchestration
 */

// Phase 3: Consensus Engine
class ConsensusEngine {
  constructor() {
    this.nodes = new Map(); // Agent nodes in consensus
    this.proposals = new Map(); // Active proposals
    this.votes = new Map(); // Voting records
    this.threshold = 0.67; // Consensus threshold (67%)
  }

  async proposeDecision(proposalId, decision, proposer, affectedAgents = []) {
    const proposal = {
      id: proposalId,
      decision,
      proposer,
      affectedAgents,
      votes: new Map(),
      status: 'PENDING',
      createdAt: Date.now(),
      deadline: Date.now() + 30000 // 30 second voting window
    };

    this.proposals.set(proposalId, proposal);
    
    // Notify affected agents to vote
    for (const agentId of affectedAgents) {
      await this.notifyAgent(agentId, 'VOTE_REQUEST', proposal);
    }

    logger.info(`Consensus proposal ${proposalId} created by ${proposer}`);
    return proposal;
  }

  async castVote(proposalId, agentId, vote, reasoning = '') {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'PENDING') {
      throw new Error(`Invalid proposal ${proposalId}`);
    }

    if (Date.now() > proposal.deadline) {
      proposal.status = 'EXPIRED';
      throw new Error(`Voting deadline passed for ${proposalId}`);
    }

    proposal.votes.set(agentId, {
      vote, // 'APPROVE', 'REJECT', 'ABSTAIN'
      reasoning,
      timestamp: Date.now()
    });

    // Check if consensus reached
    await this.evaluateConsensus(proposalId);
    return proposal;
  }

  async evaluateConsensus(proposalId) {
    const proposal = this.proposals.get(proposalId);
    const totalVotes = proposal.votes.size;
    const requiredVotes = Math.ceil(proposal.affectedAgents.length * this.threshold);
    
    let approvals = 0;
    let rejections = 0;

    for (const [agentId, voteData] of proposal.votes) {
      if (voteData.vote === 'APPROVE') approvals++;
      if (voteData.vote === 'REJECT') rejections++;
    }

    if (approvals >= requiredVotes) {
      proposal.status = 'APPROVED';
      await this.executeDecision(proposal);
      logger.info(`Consensus APPROVED for ${proposalId}: ${approvals}/${totalVotes} votes`);
    } else if (rejections > proposal.affectedAgents.length - requiredVotes) {
      proposal.status = 'REJECTED';
      logger.info(`Consensus REJECTED for ${proposalId}: ${rejections}/${totalVotes} votes`);
    }

    return proposal;
  }

  async executeDecision(proposal) {
    // Execute the approved decision
    logger.info(`Executing consensus decision: ${proposal.decision.action}`);
    // Implementation specific to decision type
  }

  async notifyAgent(agentId, eventType, data) {
    // Notify agent about consensus events
    logger.debug(`Notifying ${agentId} about ${eventType}`);
  }
}

// Phase 3: Knowledge Graph
class KnowledgeGraph {
  constructor() {
    this.nodes = new Map(); // Entity nodes
    this.edges = new Map(); // Relationships
    this.contexts = new Map(); // Context-specific subgraphs
    this.version = 1;
  }

  addNode(id, type, properties = {}) {
    const node = {
      id,
      type,
      properties: { ...properties },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: this.version++
    };

    this.nodes.set(id, node);
    logger.debug(`Knowledge node added: ${id} (${type})`);
    return node;
  }

  addEdge(fromId, toId, relationship, properties = {}) {
    const edgeId = `${fromId}->${relationship}->${toId}`;
    const edge = {
      id: edgeId,
      from: fromId,
      to: toId,
      relationship,
      properties: { ...properties },
      strength: properties.strength || 1.0,
      createdAt: Date.now(),
      version: this.version++
    };

    this.edges.set(edgeId, edge);
    logger.debug(`Knowledge edge added: ${edgeId}`);
    return edge;
  }

  query(pattern, context = 'default') {
    // Simple pattern matching for manufacturing scenarios
    const results = [];
    
    if (pattern.type === 'find_related') {
      const node = this.nodes.get(pattern.nodeId);
      if (node) {
        // Find all edges from this node
        for (const [edgeId, edge] of this.edges) {
          if (edge.from === pattern.nodeId) {
            const relatedNode = this.nodes.get(edge.to);
            if (relatedNode) {
              results.push({
                node: relatedNode,
                relationship: edge.relationship,
                strength: edge.strength
              });
            }
          }
        }
      }
    }

    return results;
  }

  getInsights(entityId) {
    // Extract insights about an entity from the knowledge graph
    const insights = {
      entity: this.nodes.get(entityId),
      relationships: [],
      patterns: [],
      recommendations: []
    };

    // Find all relationships
    for (const [edgeId, edge] of this.edges) {
      if (edge.from === entityId || edge.to === entityId) {
        insights.relationships.push(edge);
      }
    }

    // Identify patterns (simplified)
    const relationshipTypes = insights.relationships.map(r => r.relationship);
    const uniqueTypes = [...new Set(relationshipTypes)];
    
    if (uniqueTypes.length > 3) {
      insights.patterns.push({
        type: 'COMPLEX_RELATIONSHIPS',
        description: `Entity has ${uniqueTypes.length} different relationship types`
      });
    }

    return insights;
  }

  updateNode(id, properties) {
    const node = this.nodes.get(id);
    if (node) {
      node.properties = { ...node.properties, ...properties };
      node.updatedAt = Date.now();
      node.version = this.version++;
    }
    return node;
  }
}

// Phase 3: Predictive Intelligence
class PredictiveIntelligence {
  constructor() {
    this.models = new Map();
    this.predictions = new Map();
    this.historicalData = [];
    this.learningRate = 0.01;
  }

  addHistoricalData(dataPoint) {
    this.historicalData.push({
      ...dataPoint,
      timestamp: Date.now()
    });

    // Keep only last 1000 data points
    if (this.historicalData.length > 1000) {
      this.historicalData = this.historicalData.slice(-1000);
    }
  }

  async predictDemand(productId, timeHorizon = 7) {
    // Simple moving average prediction for demand
    const productData = this.historicalData.filter(d => d.productId === productId);
    
    if (productData.length < 3) {
      return {
        prediction: 0,
        confidence: 0.1,
        reasoning: 'Insufficient historical data'
      };
    }

    const recentData = productData.slice(-timeHorizon);
    const average = recentData.reduce((sum, d) => sum + (d.demand || 0), 0) / recentData.length;
    
    // Simple trend analysis
    const trend = recentData.length > 1 ? 
      (recentData[recentData.length - 1].demand - recentData[0].demand) / (recentData.length - 1) : 0;

    const prediction = Math.max(0, Math.round(average + (trend * timeHorizon)));
    const confidence = Math.min(0.9, recentData.length / 10); // Higher confidence with more data

    return {
      prediction,
      confidence,
      trend,
      reasoning: `Based on ${recentData.length} recent data points with trend ${trend.toFixed(2)}`
    };
  }

  async predictMaintenance(equipmentId) {
    const equipmentData = this.historicalData.filter(d => d.equipmentId === equipmentId);
    
    if (equipmentData.length === 0) {
      return {
        riskLevel: 'UNKNOWN',
        probability: 0,
        recommendedAction: 'COLLECT_DATA'
      };
    }

    // Simple heuristic based on usage and failure patterns
    const recentUsage = equipmentData.slice(-30); // Last 30 data points
    const avgUsage = recentUsage.reduce((sum, d) => sum + (d.usage || 0), 0) / recentUsage.length;
    const lastMaintenance = Math.max(...equipmentData.map(d => d.maintenanceDate || 0));
    const daysSinceMaintenance = (Date.now() - lastMaintenance) / (1000 * 60 * 60 * 24);

    let riskLevel = 'LOW';
    let probability = 0.1;

    if (avgUsage > 80 && daysSinceMaintenance > 30) {
      riskLevel = 'HIGH';
      probability = 0.8;
    } else if (avgUsage > 60 || daysSinceMaintenance > 20) {
      riskLevel = 'MEDIUM';
      probability = 0.4;
    }

    return {
      riskLevel,
      probability,
      avgUsage,
      daysSinceMaintenance,
      recommendedAction: riskLevel === 'HIGH' ? 'SCHEDULE_MAINTENANCE' : 'MONITOR'
    };
  }

  async predictQualityIssues(batchId, processParameters) {
    // Predict quality issues based on process parameters
    let riskScore = 0;
    const factors = [];

    // Temperature variance
    if (processParameters.temperatureVariance > 5) {
      riskScore += 0.3;
      factors.push('High temperature variance');
    }

    // Pressure stability
    if (processParameters.pressureStability < 0.95) {
      riskScore += 0.2;
      factors.push('Poor pressure stability');
    }

    // Material quality
    if (processParameters.materialQuality < 0.8) {
      riskScore += 0.4;
      factors.push('Low material quality');
    }

    // Speed variance
    if (processParameters.speedVariance > 10) {
      riskScore += 0.1;
      factors.push('High speed variance');
    }

    riskScore = Math.min(1, riskScore); // Cap at 1

    let riskLevel = 'LOW';
    if (riskScore > 0.7) riskLevel = 'HIGH';
    else if (riskScore > 0.4) riskLevel = 'MEDIUM';

    return {
      batchId,
      riskLevel,
      riskScore,
      factors,
      recommendations: this.getQualityRecommendations(factors)
    };
  }

  getQualityRecommendations(factors) {
    const recommendations = [];
    
    if (factors.includes('High temperature variance')) {
      recommendations.push('Calibrate temperature sensors and improve heating system control');
    }
    if (factors.includes('Poor pressure stability')) {
      recommendations.push('Check pressure regulators and seal integrity');
    }
    if (factors.includes('Low material quality')) {
      recommendations.push('Inspect incoming materials and contact supplier');
    }
    if (factors.includes('High speed variance')) {
      recommendations.push('Check drive system and reduce speed variations');
    }

    return recommendations;
  }
}

// Phase 3: Autonomous Orchestration
class AutonomousOrchestration extends EventEmitter {
  constructor(consensusEngine, knowledgeGraph, predictiveIntelligence) {
    super();
    this.consensus = consensusEngine;
    this.knowledge = knowledgeGraph;
    this.predictive = predictiveIntelligence;
    this.activeOrchestrations = new Map();
    this.agents = new Map();
    this.workflowTemplates = new Map();
    this.isRunning = false;
  }

  registerAgent(agentId, capabilities, priority = 5) {
    const agent = {
      id: agentId,
      capabilities,
      priority,
      status: 'AVAILABLE',
      workload: 0,
      lastActivity: Date.now(),
      performance: {
        successRate: 1.0,
        avgResponseTime: 1000,
        tasksCompleted: 0
      }
    };

    this.agents.set(agentId, agent);
    logger.info(`Agent ${agentId} registered with capabilities: ${capabilities.join(', ')}`);
    return agent;
  }

  async startAutonomousMode() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logger.info('Autonomous orchestration mode started');

    // Start monitoring loop
    this.monitoringInterval = setInterval(async () => {
      await this.autonomousMonitoring();
    }, 5000); // Check every 5 seconds

    // Start optimization loop
    this.optimizationInterval = setInterval(async () => {
      await this.autonomousOptimization();
    }, 30000); // Optimize every 30 seconds
  }

  async stopAutonomousMode() {
    this.isRunning = false;
    if (this.monitoringInterval) clearInterval(this.monitoringInterval);
    if (this.optimizationInterval) clearInterval(this.optimizationInterval);
    logger.info('Autonomous orchestration mode stopped');
  }

  async autonomousMonitoring() {
    try {
      // Monitor agent health
      for (const [agentId, agent] of this.agents) {
        if (Date.now() - agent.lastActivity > 60000) { // 1 minute
          await this.handleUnresponsiveAgent(agentId);
        }
      }

      // Monitor active orchestrations
      for (const [orchId, orchestration] of this.activeOrchestrations) {
        if (orchestration.status === 'RUNNING') {
          await this.checkOrchestrationProgress(orchId);
        }
      }

      // Predictive monitoring
      await this.predictiveMonitoring();

    } catch (error) {
      logger.error('Autonomous monitoring error:', error);
    }
  }

  async predictiveMonitoring() {
    // Use predictive intelligence to anticipate issues
    for (const [agentId, agent] of this.agents) {
      if (agent.workload > 0.8) {
        // Predict if agent will become overloaded
        const prediction = await this.predictive.predictDemand(agentId, 3);
        
        if (prediction.prediction > agent.capabilities.length * 2) {
          logger.warn(`Predicted overload for agent ${agentId}`);
          await this.proactiveLoadBalancing(agentId);
        }
      }
    }
  }

  async autonomousOptimization() {
    try {
      // Optimize agent assignments
      await this.optimizeAgentDistribution();
      
      // Optimize workflows
      await this.optimizeActiveWorkflows();
      
      // Update knowledge graph with performance data
      await this.updateKnowledgeFromPerformance();

    } catch (error) {
      logger.error('Autonomous optimization error:', error);
    }
  }

  async createOrchestration(id, workflow, context = {}) {
    const orchestration = {
      id,
      workflow,
      context,
      status: 'CREATED',
      steps: [],
      currentStep: 0,
      assignedAgents: new Map(),
      metrics: {
        startTime: Date.now(),
        stepsCompleted: 0,
        totalSteps: workflow.steps ? workflow.steps.length : 0
      },
      results: new Map()
    };

    this.activeOrchestrations.set(id, orchestration);
    
    // Use knowledge graph to enhance workflow
    await this.enhanceWorkflowWithKnowledge(orchestration);
    
    return orchestration;
  }

  async executeOrchestration(orchestrationId) {
    const orchestration = this.activeOrchestrations.get(orchestrationId);
    if (!orchestration) {
      throw new Error(`Orchestration ${orchestrationId} not found`);
    }

    orchestration.status = 'RUNNING';
    logger.info(`Starting autonomous orchestration: ${orchestrationId}`);

    try {
      while (orchestration.currentStep < orchestration.workflow.steps.length) {
        const step = orchestration.workflow.steps[orchestration.currentStep];
        await this.executeStep(orchestration, step);
        orchestration.currentStep++;
        orchestration.metrics.stepsCompleted++;
      }

      orchestration.status = 'COMPLETED';
      orchestration.metrics.endTime = Date.now();
      orchestration.metrics.duration = orchestration.metrics.endTime - orchestration.metrics.startTime;

      logger.info(`Orchestration ${orchestrationId} completed in ${orchestration.metrics.duration}ms`);
      
    } catch (error) {
      orchestration.status = 'FAILED';
      orchestration.error = error.message;
      logger.error(`Orchestration ${orchestrationId} failed:`, error);
      
      // Attempt autonomous recovery
      await this.attemptAutonomousRecovery(orchestration, error);
    }

    return orchestration;
  }

  async executeStep(orchestration, step) {
    // Select best agent for this step
    const selectedAgent = await this.selectOptimalAgent(step.requiredCapabilities, step.priority);
    
    if (!selectedAgent) {
      throw new Error(`No suitable agent found for step: ${step.name}`);
    }

    // Record assignment
    orchestration.assignedAgents.set(step.name, selectedAgent.id);
    
    // Execute step with selected agent
    const stepResult = await this.executeStepWithAgent(selectedAgent, step, orchestration.context);
    
    // Store result
    orchestration.results.set(step.name, stepResult);
    
    // Update agent performance
    await this.updateAgentPerformance(selectedAgent.id, stepResult);
    
    logger.debug(`Step ${step.name} completed by agent ${selectedAgent.id}`);
    return stepResult;
  }

  async selectOptimalAgent(requiredCapabilities, priority = 5) {
    const suitableAgents = [];
    
    for (const [agentId, agent] of this.agents) {
      if (agent.status === 'AVAILABLE') {
        const hasCapabilities = requiredCapabilities.every(cap => 
          agent.capabilities.includes(cap)
        );
        
        if (hasCapabilities) {
          // Calculate suitability score
          const score = this.calculateAgentScore(agent, priority);
          suitableAgents.push({ agent, score });
        }
      }
    }

    if (suitableAgents.length === 0) {
      return null;
    }

    // Sort by score (highest first)
    suitableAgents.sort((a, b) => b.score - a.score);
    return suitableAgents[0].agent;
  }

  calculateAgentScore(agent, taskPriority) {
    let score = 0;
    
    // Performance factor (higher success rate = higher score)
    score += agent.performance.successRate * 40;
    
    // Availability factor (lower workload = higher score)
    score += (1 - agent.workload) * 30;
    
    // Priority matching (closer priority match = higher score)
    score += Math.max(0, 20 - Math.abs(agent.priority - taskPriority));
    
    // Response time factor (faster = higher score)
    const responseTimeFactor = Math.max(0, 10 - (agent.performance.avgResponseTime / 1000));
    score += responseTimeFactor;

    return score;
  }

  async executeStepWithAgent(agent, step, context) {
    const startTime = Date.now();
    
    try {
      // Update agent workload
      agent.workload = Math.min(1, agent.workload + 0.2);
      agent.status = 'BUSY';
      
      // Simulate step execution (in real implementation, this would call the actual agent)
      const result = await this.simulateStepExecution(agent, step, context);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Update agent metrics
      agent.performance.avgResponseTime = 
        (agent.performance.avgResponseTime + responseTime) / 2;
      agent.performance.tasksCompleted++;
      agent.lastActivity = endTime;
      
      return {
        success: true,
        result,
        responseTime,
        agent: agent.id
      };
      
    } catch (error) {
      // Update failure rate
      const totalTasks = agent.performance.tasksCompleted + 1;
      const successfulTasks = agent.performance.tasksCompleted * agent.performance.successRate;
      agent.performance.successRate = successfulTasks / totalTasks;
      
      throw error;
    } finally {
      // Update agent availability
      agent.workload = Math.max(0, agent.workload - 0.2);
      if (agent.workload === 0) {
        agent.status = 'AVAILABLE';
      }
    }
  }

  async simulateStepExecution(agent, step, context) {
    // Simulate different types of manufacturing steps
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 200));
    
    return {
      stepName: step.name,
      agentId: agent.id,
      executedAt: Date.now(),
      parameters: step.parameters || {},
      context: context.summary || 'No context provided'
    };
  }

  async enhanceWorkflowWithKnowledge(orchestration) {
    // Use knowledge graph to optimize workflow
    for (const step of orchestration.workflow.steps) {
      const insights = this.knowledge.getInsights(step.name);
      
      if (insights.patterns.length > 0) {
        step.knowledgeInsights = insights.patterns;
        logger.debug(`Enhanced step ${step.name} with knowledge insights`);
      }
    }
  }

  async updateAgentPerformance(agentId, stepResult) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    if (stepResult.success) {
      // Update success rate
      const totalTasks = agent.performance.tasksCompleted;
      const successfulTasks = totalTasks * agent.performance.successRate + 1;
      agent.performance.successRate = successfulTasks / (totalTasks + 1);
    }

    // Add performance data to predictive intelligence
    this.predictive.addHistoricalData({
      agentId,
      success: stepResult.success,
      responseTime: stepResult.responseTime,
      timestamp: Date.now()
    });
  }

  async attemptAutonomousRecovery(orchestration, error) {
    logger.info(`Attempting autonomous recovery for orchestration ${orchestration.id}`);
    
    // Strategy 1: Retry with different agent
    if (orchestration.currentStep > 0) {
      const failedStep = orchestration.workflow.steps[orchestration.currentStep];
      const alternativeAgent = await this.selectOptimalAgent(
        failedStep.requiredCapabilities, 
        failedStep.priority,
        [orchestration.assignedAgents.get(failedStep.name)] // Exclude failed agent
      );
      
      if (alternativeAgent) {
        logger.info(`Retrying with alternative agent: ${alternativeAgent.id}`);
        try {
          await this.executeStep(orchestration, failedStep);
          orchestration.status = 'RUNNING'; // Continue execution
          return;
        } catch (retryError) {
          logger.warn('Alternative agent also failed');
        }
      }
    }
    
    // Strategy 2: Request consensus for alternative approach
    if (this.consensus) {
      await this.consensus.proposeDecision(
        `recovery-${orchestration.id}`,
        {
          action: 'ALTERNATIVE_WORKFLOW',
          orchestrationId: orchestration.id,
          error: error.message
        },
        'autonomous-orchestrator',
        Array.from(this.agents.keys())
      );
    }
  }
}

// Phase 3: Advanced Compliance Framework
class AdvancedCompliance {
  constructor() {
    this.rules = new Map();
    this.violations = [];
    this.auditTrail = [];
    this.complianceScores = new Map();
    this.regulatoryFrameworks = new Map();
  }

  addComplianceRule(ruleId, rule) {
    const complianceRule = {
      id: ruleId,
      ...rule,
      createdAt: Date.now(),
      isActive: true,
      violations: 0,
      lastChecked: null
    };

    this.rules.set(ruleId, complianceRule);
    logger.info(`Compliance rule added: ${ruleId}`);
    return complianceRule;
  }

  async checkCompliance(entityId, entityType, data, context = {}) {
    const results = {
      entityId,
      entityType,
      timestamp: Date.now(),
      overallScore: 100,
      violations: [],
      warnings: [],
      recommendations: []
    };

    // Check all applicable rules
    for (const [ruleId, rule] of this.rules) {
      if (!rule.isActive) continue;
      
      if (rule.appliesTo.includes(entityType) || rule.appliesTo.includes('ALL')) {
        const ruleResult = await this.evaluateRule(rule, data, context);
        
        if (!ruleResult.compliant) {
          const violation = {
            ruleId,
            severity: rule.severity,
            description: rule.description,
            details: ruleResult.details,
            timestamp: Date.now()
          };

          if (rule.severity === 'CRITICAL') {
            results.violations.push(violation);
            results.overallScore -= 25;
          } else if (rule.severity === 'HIGH') {
            results.violations.push(violation);
            results.overallScore -= 15;
          } else if (rule.severity === 'MEDIUM') {
            results.warnings.push(violation);
            results.overallScore -= 10;
          } else {
            results.warnings.push(violation);
            results.overallScore -= 5;
          }

          // Record violation
          this.violations.push(violation);
          rule.violations++;
        }

        rule.lastChecked = Date.now();
      }
    }

    // Ensure score doesn't go below 0
    results.overallScore = Math.max(0, results.overallScore);
    
    // Generate recommendations
    results.recommendations = this.generateRecommendations(results);
    
    // Update compliance score for entity
    this.complianceScores.set(entityId, results.overallScore);
    
    // Add to audit trail
    this.auditTrail.push({
      entityId,
      entityType,
      score: results.overallScore,
      violations: results.violations.length,
      warnings: results.warnings.length,
      timestamp: Date.now()
    });

    return results;
  }

  async evaluateRule(rule, data, context) {
    try {
      // Evaluate rule condition
      const conditionResult = await this.evaluateCondition(rule.condition, data, context);
      
      return {
        compliant: conditionResult,
        details: conditionResult ? 'Rule satisfied' : `Rule violation: ${rule.description}`
      };
      
    } catch (error) {
      logger.error(`Error evaluating rule ${rule.id}:`, error);
      return {
        compliant: false,
        details: `Rule evaluation error: ${error.message}`
      };
    }
  }

  async evaluateCondition(condition, data, context) {
    // Simple condition evaluation (in production, use a more sophisticated rule engine)
    switch (condition.type) {
      case 'RANGE':
        const value = this.getNestedValue(data, condition.field);
        return value >= condition.min && value <= condition.max;
        
      case 'REQUIRED_FIELD':
        return this.getNestedValue(data, condition.field) !== undefined;
        
      case 'ENUM':
        const enumValue = this.getNestedValue(data, condition.field);
        return condition.allowedValues.includes(enumValue);
        
      case 'CUSTOM':
        return await this.evaluateCustomCondition(condition, data, context);
        
      default:
        return false;
    }
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  async evaluateCustomCondition(condition, data, context) {
    // Implement custom business logic
    switch (condition.name) {
      case 'QUALITY_THRESHOLD':
        return data.qualityScore >= 0.95;
        
      case 'SAFETY_PROTOCOL':
        return data.safetyChecks && data.safetyChecks.length >= 3;
        
      case 'ENVIRONMENTAL_LIMIT':
        return data.emissions <= condition.maxEmissions;
        
      default:
        return true;
    }
  }

  generateRecommendations(complianceResult) {
    const recommendations = [];
    
    for (const violation of complianceResult.violations) {
      switch (violation.ruleId) {
        case 'QUALITY_CONTROL':
          recommendations.push('Increase quality control sampling frequency');
          break;
        case 'SAFETY_PROTOCOL':
          recommendations.push('Review and update safety procedures');
          break;
        case 'ENVIRONMENTAL':
          recommendations.push('Implement emission reduction measures');
          break;
        default:
          recommendations.push(`Address ${violation.ruleId} compliance gap`);
      }
    }
    
    return recommendations;
  }

  getComplianceReport(entityId, timeRange = 30) {
    const cutoffTime = Date.now() - (timeRange * 24 * 60 * 60 * 1000);
    const relevantAudits = this.auditTrail.filter(
      audit => audit.entityId === entityId && audit.timestamp >= cutoffTime
    );

    if (relevantAudits.length === 0) {
      return {
        entityId,
        status: 'NO_DATA',
        message: 'No compliance data available for specified time range'
      };
    }

    const avgScore = relevantAudits.reduce((sum, audit) => sum + audit.score, 0) / relevantAudits.length;
    const totalViolations = relevantAudits.reduce((sum, audit) => sum + audit.violations, 0);
    const totalWarnings = relevantAudits.reduce((sum, audit) => sum + audit.warnings, 0);

    return {
      entityId,
      timeRange,
      averageScore: Math.round(avgScore),
      totalViolations,
      totalWarnings,
      trend: this.calculateComplianceTrend(relevantAudits),
      status: avgScore >= 90 ? 'EXCELLENT' : avgScore >= 75 ? 'GOOD' : avgScore >= 60 ? 'FAIR' : 'POOR',
      audits: relevantAudits.length
    };
  }

  calculateComplianceTrend(audits) {
    if (audits.length < 2) return 'STABLE';
    
    const firstHalf = audits.slice(0, Math.floor(audits.length / 2));
    const secondHalf = audits.slice(Math.floor(audits.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, audit) => sum + audit.score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, audit) => sum + audit.score, 0) / secondHalf.length;
    
    const difference = secondAvg - firstAvg;
    
    if (difference > 5) return 'IMPROVING';
    if (difference < -5) return 'DECLINING';
    return 'STABLE';
  }

  async generateComplianceInsights() {
    const insights = {
      summary: {
        totalRules: this.rules.size,
        activeRules: Array.from(this.rules.values()).filter(r => r.isActive).length,
        totalViolations: this.violations.length,
        entitiesTracked: this.complianceScores.size
      },
      topViolations: [],
      riskAreas: [],
      recommendations: []
    };

    // Analyze most frequent violations
    const violationsByRule = new Map();
    for (const violation of this.violations) {
      violationsByRule.set(violation.ruleId, (violationsByRule.get(violation.ruleId) || 0) + 1);
    }

    insights.topViolations = Array.from(violationsByRule.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ruleId, count]) => ({ ruleId, count }));

    // Identify risk areas
    for (const [entityId, score] of this.complianceScores) {
      if (score < 70) {
        insights.riskAreas.push({ entityId, score });
      }
    }

    // Generate strategic recommendations
    if (insights.topViolations.length > 0) {
      insights.recommendations.push(`Focus on ${insights.topViolations[0].ruleId} - most frequent violation`);
    }
    
    if (insights.riskAreas.length > 0) {
      insights.recommendations.push(`Immediate attention needed for ${insights.riskAreas.length} high-risk entities`);
    }

    return insights;
  }
}

// Phase 3 Integration System
class Phase3ManufacturingSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Initialize Phase 3 components
    this.consensusEngine = new ConsensusEngine();
    this.knowledgeGraph = new KnowledgeGraph();
    this.predictiveIntelligence = new PredictiveIntelligence();
    this.compliance = new AdvancedCompliance();
    
    // Initialize orchestration with all components
    this.orchestration = new AutonomousOrchestration(
      this.consensusEngine,
      this.knowledgeGraph,
      this.predictiveIntelligence
    );

    this.config = {
      enableAutonomousMode: config.enableAutonomousMode || false,
      complianceLevel: config.complianceLevel || 'STANDARD',
      predictivePeriod: config.predictivePeriod || 7,
      ...config
    };

    this.isInitialized = false;
    this.agents = new Map();
  }

  async initialize() {
    try {
      logger.info('Initializing Phase 3 Manufacturing System...');

      // Initialize knowledge graph with manufacturing entities
      await this.initializeManufacturingKnowledge();
      
      // Set up compliance rules
      await this.initializeComplianceRules();
      
      // Register core manufacturing agents
      await this.registerCoreAgents();
      
      // Start autonomous mode if enabled
      if (this.config.enableAutonomousMode) {
        await this.orchestration.startAutonomousMode();
      }

      this.isInitialized = true;
      this.emit('system:initialized');
      logger.info('Phase 3 Manufacturing System initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Phase 3 system:', error);
      throw error;
    }
  }

  async initializeManufacturingKnowledge() {
    // Add manufacturing entities to knowledge graph
    
    // Equipment entities
    this.knowledgeGraph.addNode('PCK-01', 'EQUIPMENT', {
      name: 'Packaging Line 01',
      type: 'PACKAGING',
      capacity: 2000,
      status: 'OPERATIONAL'
    });

    this.knowledgeGraph.addNode('PCK-02', 'EQUIPMENT', {
      name: 'Packaging Line 02', 
      type: 'PACKAGING',
      capacity: 1500,
      status: 'MAINTENANCE'
    });

    // Product entities
    this.knowledgeGraph.addNode('FG-123', 'PRODUCT', {
      name: 'Finished Good 123',
      category: 'CONSUMER',
      complexity: 'MEDIUM'
    });

    // Process entities
    this.knowledgeGraph.addNode('PACK-PROCESS', 'PROCESS', {
      name: 'Packaging Process',
      steps: ['PREP', 'FILL', 'SEAL', 'LABEL', 'QC'],
      avgDuration: 300
    });

    // Add relationships
    this.knowledgeGraph.addEdge('FG-123', 'PACK-PROCESS', 'REQUIRES', { priority: 'HIGH' });
    this.knowledgeGraph.addEdge('PACK-PROCESS', 'PCK-01', 'USES_EQUIPMENT', { efficiency: 0.95 });
    this.knowledgeGraph.addEdge('PCK-01', 'PCK-02', 'BACKUP_FOR', { reliability: 0.85 });

    logger.debug('Manufacturing knowledge graph initialized');
  }

  async initializeComplianceRules() {
    // Quality compliance rules
    this.compliance.addComplianceRule('QUALITY_CONTROL', {
      description: 'Quality score must be above 95%',
      appliesTo: ['BATCH', 'PRODUCT'],
      severity: 'CRITICAL',
      condition: {
        type: 'RANGE',
        field: 'qualityScore',
        min: 0.95,
        max: 1.0
      }
    });

    // Safety compliance rules
    this.compliance.addComplianceRule('SAFETY_PROTOCOL', {
      description: 'All safety checks must be completed',
      appliesTo: ['PROCESS', 'EQUIPMENT'],
      severity: 'CRITICAL',
      condition: {
        type: 'CUSTOM',
        name: 'SAFETY_PROTOCOL'
      }
    });

    // Environmental compliance
    this.compliance.addComplianceRule('ENVIRONMENTAL', {
      description: 'Emissions must not exceed regulatory limits',
      appliesTo: ['PROCESS', 'FACILITY'],
      severity: 'HIGH',
      condition: {
        type: 'CUSTOM',
        name: 'ENVIRONMENTAL_LIMIT',
        maxEmissions: 100
      }
    });

    // Documentation compliance
    this.compliance.addComplianceRule('DOCUMENTATION', {
      description: 'All required documentation must be present',
      appliesTo: ['BATCH', 'PROCESS'],
      severity: 'MEDIUM',
      condition: {
        type: 'REQUIRED_FIELD',
        field: 'documentation.batchRecord'
      }
    });

    logger.debug('Compliance rules initialized');
  }

  async registerCoreAgents() {
    // Register manufacturing agents with their capabilities
    
    this.orchestration.registerAgent('mar-agent', [
      'ORDER_ASSESSMENT',
      'CAPACITY_PLANNING',
      'RESOURCE_ALLOCATION',
      'PRODUCTION_SCHEDULING'
    ], 8);

    this.orchestration.registerAgent('qa-agent', [
      'QUALITY_CONTROL',
      'BATCH_TESTING',
      'COMPLIANCE_CHECK',
      'DEFECT_ANALYSIS'
    ], 9);

    this.orchestration.registerAgent('maintenance-agent', [
      'EQUIPMENT_MONITORING',
      'PREDICTIVE_MAINTENANCE',
      'REPAIR_SCHEDULING',
      'SPARE_PARTS_MANAGEMENT'
    ], 7);

    this.orchestration.registerAgent('compliance-agent', [
      'REGULATORY_CHECK',
      'AUDIT_SUPPORT',
      'DOCUMENTATION_REVIEW',
      'RISK_ASSESSMENT'
    ], 6);

    logger.debug('Core manufacturing agents registered');
  }

  // Main enhanced MAR agent handler
  async handleMARRequest(intent, context) {
    const requestId = `mar-${Date.now()}`;
    const startTime = Date.now();
    
    try {
      logger.info(`Processing MAR request: ${intent}`, { requestId, context });

      // Phase 3 Enhancement: Use predictive intelligence
      const predictions = await this.generatePredictions(context);
      
      // Phase 3 Enhancement: Check compliance
      const complianceResult = await this.checkRequestCompliance(intent, context);
      
      // Phase 3 Enhancement: Use knowledge graph for insights
      const knowledgeInsights = await this.getKnowledgeInsights(context);
      
      // Process the request based on intent
      let result;
      switch (intent) {
        case 'assess_order':
          result = await this.assessOrderWithPhase3(context, predictions, knowledgeInsights);
          break;
        case 'plan_production':
          result = await this.planProductionWithPhase3(context, predictions, knowledgeInsights);
          break;
        case 'allocate_resources':
          result = await this.allocateResourcesWithPhase3(context, predictions, knowledgeInsights);
          break;
        case 'monitor_progress':
          result = await this.monitorProgressWithPhase3(context, predictions, knowledgeInsights);
          break;
        default:
          result = await this.handleGenericRequestWithPhase3(intent, context, predictions, knowledgeInsights);
      }

      // Phase 3 Enhancement: If critical decisions needed, use consensus
      if (result.requiresConsensus) {
        const consensusResult = await this.requestConsensusDecision(requestId, result.decision, context);
        result.consensusStatus = consensusResult.status;
      }

      // Add Phase 3 metadata
      result.phase3Metadata = {
        predictions,
        compliance: complianceResult,
        knowledgeInsights,
        processingTime: Date.now() - startTime,
        agentCapabilities: ['PHASE_3_ENHANCED'],
        autonomousCapable: true
      };

      logger.info(`MAR request completed: ${requestId}`, { 
        processingTime: Date.now() - startTime,
        success: result.success 
      });

      return result;

    } catch (error) {
      logger.error(`MAR request failed: ${requestId}`, error);
      
      // Phase 3 Enhancement: Attempt autonomous recovery
      const recoveryResult = await this.attemptAutonomousRecovery(requestId, intent, context, error);
      
      return {
        success: false,
        error: error.message,
        requestId,
        recovery: recoveryResult,
        phase3Metadata: {
          processingTime: Date.now() - startTime,
          agentCapabilities: ['PHASE_3_ENHANCED'],
          errorHandling: 'AUTONOMOUS_RECOVERY_ATTEMPTED'
        }
      };
    }
  }

  async generatePredictions(context) {
    const predictions = {};

    // Demand prediction
    if (context.productId) {
      predictions.demand = await this.predictiveIntelligence.predictDemand(
        context.productId, 
        this.config.predictivePeriod
      );
    }

    // Quality prediction
    if (context.processParameters) {
      predictions.quality = await this.predictiveIntelligence.predictQualityIssues(
        context.batchId || 'unknown',
        context.processParameters
      );
    }

    // Maintenance prediction
    if (context.equipmentId) {
      predictions.maintenance = await this.predictiveIntelligence.predictMaintenance(
        context.equipmentId
      );
    }

    return predictions;
  }

  async checkRequestCompliance(intent, context) {
    // Determine entity type based on intent
    let entityType = 'GENERAL';
    if (intent.includes('order')) entityType = 'ORDER';
    if (intent.includes('production')) entityType = 'PROCESS';
    if (intent.includes('resource')) entityType = 'RESOURCE';

    return await this.compliance.checkCompliance(
      context.id || 'unknown',
      entityType,
      context,
      { intent }
    );
  }

  async getKnowledgeInsights(context) {
    const insights = {};

    // Get insights for relevant entities
    if (context.equipmentId) {
      insights.equipment = this.knowledgeGraph.getInsights(context.equipmentId);
    }

    if (context.productId) {
      insights.product = this.knowledgeGraph.getInsights(context.productId);
    }

    if (context.processId) {
      insights.process = this.knowledgeGraph.getInsights(context.processId);
    }

    return insights;
  }

  async assessOrderWithPhase3(context, predictions, knowledgeInsights) {
    const assessment = {
      orderId: context.orderId,
      feasibility: 'ANALYZING',
      timeline: null,
      resources: [],
      risks: [],
      recommendations: []
    };

    // Use predictions to enhance assessment
    if (predictions.demand) {
      if (predictions.demand.confidence > 0.7) {
        assessment.demandForecast = predictions.demand;
        assessment.recommendations.push(
          `High confidence demand prediction: ${predictions.demand.prediction} units`
        );
      }
    }

    // Use knowledge insights
    if (knowledgeInsights.equipment) {
      const equipmentStatus = knowledgeInsights.equipment.entity?.properties?.status;
      if (equipmentStatus === 'MAINTENANCE') {
        assessment.risks.push('Primary equipment under maintenance');
        assessment.feasibility = 'CONDITIONAL';
      }
    }

    // Simulate capacity calculation
    const orderQuantity = context.quantity || 1000;
    const equipmentCapacity = 2000; // From knowledge graph
    
    assessment.timeline = Math.ceil(orderQuantity / equipmentCapacity) + ' days';
    assessment.feasibility = orderQuantity <= equipmentCapacity ? 'FEASIBLE' : 'REQUIRES_PLANNING';

    // Add autonomous recommendations
    if (predictions.maintenance?.riskLevel === 'HIGH') {
      assessment.recommendations.push('Schedule preventive maintenance before order execution');
    }

    return {
      success: true,
      intent: 'assess_order',
      result: assessment,
      requiresConsensus: assessment.feasibility === 'REQUIRES_PLANNING'
    };
  }

  async planProductionWithPhase3(context, predictions, knowledgeInsights) {
    // Create autonomous production plan
    const orchestrationId = `production-${Date.now()}`;
    
    const workflow = {
      steps: [
        {
          name: 'MATERIAL_PREPARATION',
          requiredCapabilities: ['RESOURCE_ALLOCATION'],
          priority: 8,
          parameters: { materials: context.materials || [] }
        },
        {
          name: 'PRODUCTION_SETUP',
          requiredCapabilities: ['EQUIPMENT_MONITORING'],
          priority: 9,
          parameters: { equipment: context.equipmentId }
        },
        {
          name: 'QUALITY_CHECK',
          requiredCapabilities: ['QUALITY_CONTROL'],
          priority: 10,
          parameters: { standards: context.qualityStandards }
        },
        {
          name: 'PRODUCTION_EXECUTION',
          requiredCapabilities: ['PRODUCTION_SCHEDULING'],
          priority: 8,
          parameters: { quantity: context.quantity }
        }
      ]
    };

    // Create orchestration
    const orchestration = await this.orchestration.createOrchestration(
      orchestrationId,
      workflow,
      context
    );

    // If autonomous mode is enabled, start execution
    if (this.config.enableAutonomousMode) {
      // Execute asynchronously
      this.orchestration.executeOrchestration(orchestrationId)
        .then(result => {
          this.emit('production:completed', result);
        })
        .catch(error => {
          this.emit('production:failed', { orchestrationId, error });
        });
    }

    return {
      success: true,
      intent: 'plan_production',
      result: {
        orchestrationId,
        workflow: workflow.steps.map(s => s.name),
        status: this.config.enableAutonomousMode ? 'EXECUTING' : 'PLANNED',
        estimatedDuration: workflow.steps.length * 15 + ' minutes',
        predictiveInsights: predictions,
        knowledgeEnhanced: Object.keys(knowledgeInsights).length > 0
      },
      requiresConsensus: false
    };
  }

  async allocateResourcesWithPhase3(context, predictions, knowledgeInsights) {
    const allocation = {
      resources: [],
      conflicts: [],
      optimization: {},
      efficiency: 0
    };

    // Use knowledge graph to find optimal resources
    if (context.resourceType) {
      const relatedResources = this.knowledgeGraph.query({
        type: 'find_related',
        nodeId: context.resourceType
      });

      allocation.resources = relatedResources.map(r => ({
        id: r.node.id,
        type: r.node.type,
        availability: r.node.properties.status === 'AVAILABLE',
        efficiency: r.strength
      }));
    }

    // Use predictions to optimize allocation
    if (predictions.maintenance) {
      allocation.resources = allocation.resources.filter(r => 
        predictions.maintenance.riskLevel !== 'HIGH' || r.id !== context.equipmentId
      );
    }

    // Calculate efficiency score
    const availableResources = allocation.resources.filter(r => r.availability);
    allocation.efficiency = availableResources.length / allocation.resources.length;

    return {
      success: true,
      intent: 'allocate_resources',
      result: allocation,
      requiresConsensus: allocation.efficiency < 0.7
    };
  }

  async monitorProgressWithPhase3(context, predictions, knowledgeInsights) {
    const monitoring = {
      status: 'MONITORING',
      activeProcesses: [],
      alerts: [],
      predictions: predictions,
      compliance: await this.compliance.getComplianceReport(context.entityId || 'unknown')
    };

    // Check active orchestrations
    for (const [id, orchestration] of this.orchestration.activeOrchestrations) {
      monitoring.activeProcesses.push({
        id,
        status: orchestration.status,
        progress: `${orchestration.currentStep}/${orchestration.workflow.steps.length}`,
        startTime: orchestration.metrics.startTime
      });
    }

    // Generate alerts based on predictions
    if (predictions.quality?.riskLevel === 'HIGH') {
      monitoring.alerts.push({
        type: 'QUALITY_RISK',
        severity: 'HIGH',
        message: 'Quality issues predicted - immediate attention required'
      });
    }

    if (predictions.maintenance?.riskLevel === 'HIGH') {
      monitoring.alerts.push({
        type: 'MAINTENANCE_REQUIRED',
        severity: 'MEDIUM',
        message: `Equipment ${context.equipmentId} requires maintenance`
      });
    }

    return {
      success: true,
      intent: 'monitor_progress',
      result: monitoring,
      requiresConsensus: monitoring.alerts.some(a => a.severity === 'HIGH')
    };
  }

  async handleGenericRequestWithPhase3(intent, context, predictions, knowledgeInsights) {
    // Handle any other manufacturing request with Phase 3 enhancements
    const result = {
      intent,
      context,
      capabilities: [
        'PREDICTIVE_INTELLIGENCE',
        'KNOWLEDGE_GRAPH',
        'CONSENSUS_ENGINE',
        'AUTONOMOUS_ORCHESTRATION',
        'ADVANCED_COMPLIANCE'
      ],
      suggestions: []
    };

    // Add suggestions based on available enhancements
    if (Object.keys(predictions).length > 0) {
      result.suggestions.push('Predictive insights available - see metadata');
    }

    if (Object.keys(knowledgeInsights).length > 0) {
      result.suggestions.push('Knowledge graph insights available - see metadata');
    }

    return {
      success: true,
      intent,
      result,
      requiresConsensus: false
    };
  }

  async requestConsensusDecision(requestId, decision, context) {
    const proposalId = `decision-${requestId}`;
    const affectedAgents = Array.from(this.orchestration.agents.keys());

    try {
      const proposal = await this.consensusEngine.proposeDecision(
        proposalId,
        decision,
        'mar-agent',
        affectedAgents
      );

      // Wait for consensus (simplified - in production, use callbacks)
      return new Promise((resolve) => {
        const checkConsensus = setInterval(async () => {
          const currentProposal = this.consensusEngine.proposals.get(proposalId);
          
          if (currentProposal && currentProposal.status !== 'PENDING') {
            clearInterval(checkConsensus);
            resolve({
              status: currentProposal.status,
              votes: currentProposal.votes.size,
              proposal: currentProposal
            });
          }
        }, 1000);

        // Timeout after 30 seconds
        setTimeout(() => {
          clearInterval(checkConsensus);
          resolve({
            status: 'TIMEOUT',
            votes: 0,
            proposal: null
          });
        }, 30000);
      });

    } catch (error) {
      return {
        status: 'ERROR',
        error: error.message
      };
    }
  }

  async attemptAutonomousRecovery(requestId, intent, context, error) {
    logger.info(`Attempting autonomous recovery for request ${requestId}`);

    const recovery = {
      attempted: true,
      strategies: [],
      success: false,
      fallback: null
    };

    // Strategy 1: Retry with different parameters
    if (context.equipmentId && error.message.includes('equipment')) {
      recovery.strategies.push('ALTERNATIVE_EQUIPMENT');
      
      // Find alternative equipment from knowledge graph
      const alternatives = this.knowledgeGraph.query({
        type: 'find_related',
        nodeId: context.equipmentId
      });

      if (alternatives.length > 0) {
        recovery.fallback = {
          originalEquipment: context.equipmentId,
          alternativeEquipment: alternatives[0].node.id,
          reason: 'Primary equipment unavailable'
        };
        recovery.success = true;
      }
    }

    // Strategy 2: Request consensus for alternative approach
    if (!recovery.success) {
      recovery.strategies.push('CONSENSUS_ALTERNATIVE');
      
      try {
        await this.consensusEngine.proposeDecision(
          `recovery-${requestId}`,
          {
            action: 'ALTERNATIVE_APPROACH',
            originalIntent: intent,
            error: error.message
          },
          'autonomous-recovery',
          Array.from(this.orchestration.agents.keys())
        );
        
        recovery.success = true;
      } catch (consensusError) {
        recovery.strategies.push('CONSENSUS_FAILED');
      }
    }

    return recovery;
  }

  // System management methods
  async getSystemStatus() {
    return {
      initialized: this.isInitialized,
      autonomousMode: this.config.enableAutonomousMode,
      components: {
        consensusEngine: {
          proposals: this.consensusEngine.proposals.size,
          nodes: this.consensusEngine.nodes.size
        },
        knowledgeGraph: {
          nodes: this.knowledgeGraph.nodes.size,
          edges: this.knowledgeGraph.edges.size,
          version: this.knowledgeGraph.version
        },
        predictiveIntelligence: {
          historicalDataPoints: this.predictiveIntelligence.historicalData.length,
          models: this.predictiveIntelligence.models.size
        },
        orchestration: {
          activeOrchestrations: this.orchestration.activeOrchestrations.size,
          registeredAgents: this.orchestration.agents.size,
          isRunning: this.orchestration.isRunning
        },
        compliance: {
          rules: this.compliance.rules.size,
          violations: this.compliance.violations.length,
          entitiesTracked: this.compliance.complianceScores.size
        }
      },
      performance: {
        uptime: this.isInitialized ? Date.now() - this.initTime : 0,
        memoryUsage: process.memoryUsage()
      }
    };
  }

  async shutdown() {
    logger.info('Shutting down Phase 3 Manufacturing System...');
    
    await this.orchestration.stopAutonomousMode();
    this.isInitialized = false;
    this.emit('system:shutdown');
    
    logger.info('Phase 3 Manufacturing System shutdown complete');
  }
}

// Export the enhanced MAR agent function for integration
export async function handle({ intent, context }) {
  // This is the main entry point that integrates with your existing system
  
  // Create Phase 3 system instance if not exists
  if (!global.phase3System) {
    global.phase3System = new Phase3ManufacturingSystem({
      enableAutonomousMode: process.env.ENABLE_AUTONOMOUS_MODE === 'true',
      complianceLevel: process.env.COMPLIANCE_LEVEL || 'STANDARD'
    });
    
    await global.phase3System.initialize();
  }

  // Process request through Phase 3 enhanced MAR agent
  return await global.phase3System.handleMARRequest(intent, context);
}

// Export Phase 3 system for direct access
export { Phase3ManufacturingSystem, ConsensusEngine, KnowledgeGraph, PredictiveIntelligence, AutonomousOrchestration, AdvancedCompliance };

// Example usage and testing
export const examples = {
  // Example 1: Order assessment with Phase 3 enhancements
  assessOrder: async () => {
    const context = {
      orderId: 'ORD-001',
      productId: 'FG-123',
      quantity: 2000,
      equipmentId: 'PCK-01',
      priority: 'HIGH'
    };
    
    return await handle({ intent: 'assess_order', context });
  },

  // Example 2: Production planning with autonomous orchestration
  planProduction: async () => {
    const context = {
      productId: 'FG-123',
      quantity: 1500,
      equipmentId: 'PCK-01',
      materials: ['MAT-A', 'MAT-B'],
      qualityStandards: { minScore: 0.95 }
    };
    
    return await handle({ intent: 'plan_production', context });
  },

  // Example 3: Resource allocation with knowledge graph optimization
  allocateResources: async () => {
    const context = {
      resourceType: 'EQUIPMENT',
      requirements: ['PACKAGING'],
      priority: 'HIGH'
    };
    
    return await handle({ intent: 'allocate_resources', context });
  },

  // Example 4: Progress monitoring with predictive insights
  monitorProgress: async () => {
    const context = {
      entityId: 'PCK-01',
      equipmentId: 'PCK-01',
      processParameters: {
        temperatureVariance: 3,
        pressureStability: 0.98,
        materialQuality: 0.95,
        speedVariance: 5
      }
    };
    
    return await handle({ intent: 'monitor_progress', context });
  }
};