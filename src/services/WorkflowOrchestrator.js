// src/services/WorkflowOrchestrator.js - Phase 2 Workflow Management
import logger from "./logger.js";
import { v4 as uuidv4 } from "uuid";

/**
 * WorkflowOrchestrator - Manages complex multi-agent manufacturing workflows
 * Enables coordination of sequential, parallel, and conditional agent operations
 */
export class WorkflowOrchestrator {
  constructor({ router, eventBus }) {
    this.router = router;
    this.eventBus = eventBus;
    this.workflows = new Map();
    this.executions = new Map();
    this.templates = new Map();
    
    // Metrics
    this.metrics = {
      totalExecutions: 0,
      completedExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0
    };
    
    this.initializeManufacturingWorkflows();
    logger.info('WorkflowOrchestrator initialized for Phase 2');
  }

  /**
   * Register a workflow definition
   */
  registerWorkflow(workflowId, definition) {
    // Validate workflow definition
    this.validateWorkflow(definition);
    
    definition.id = workflowId;
    definition.registeredAt = Date.now();
    
    this.workflows.set(workflowId, definition);
    
    logger.info('Workflow registered', { 
      workflowId, 
      steps: definition.steps?.length || 0,
      name: definition.name 
    });
  }

  /**
   * Execute a workflow with context
   */
  async executeWorkflow(workflowId, initialContext = {}) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const executionId = uuidv4();
    const execution = {
      id: executionId,
      workflowId,
      name: workflow.name || workflowId,
      context: { ...initialContext },
      status: 'running',
      startTime: Date.now(),
      steps: [],
      currentStepIndex: 0,
      totalSteps: workflow.steps.length,
      error: null,
      endTime: null
    };

    this.executions.set(executionId, execution);
    this.metrics.totalExecutions++;

    // Publish workflow started event
    await this.eventBus.publish('workflow.started', {
      executionId,
      workflowId,
      name: execution.name
    });

    logger.info('Workflow execution started', { 
      executionId, 
      workflowId,
      totalSteps: execution.totalSteps 
    });

    try {
      // Execute workflow steps
      for (let i = 0; i < workflow.steps.length; i++) {
        execution.currentStepIndex = i;
        const step = workflow.steps[i];
        
        logger.debug('Executing workflow step', { 
          executionId, 
          stepIndex: i, 
          stepId: step.id, 
          stepType: step.type 
        });

        const stepStartTime = Date.now();
        const stepResult = await this.executeStep(step, execution.context, executionId);
        const stepDuration = Date.now() - stepStartTime;
        
        execution.steps.push({
          stepId: step.id,
          stepType: step.type,
          result: stepResult,
          duration: stepDuration,
          timestamp: new Date().toISOString(),
          success: stepResult?.ok !== false
        });

        // Merge step results into context for next steps
        if (stepResult && typeof stepResult === 'object') {
          execution.context = { 
            ...execution.context, 
            [`step_${step.id}`]: stepResult,
            lastStepResult: stepResult
          };
        }

        // Check for step failure
        if (stepResult?.ok === false && step.required !== false) {
          throw new Error(`Step ${step.id} failed: ${stepResult.error || 'Unknown error'}`);
        }
      }

      // Mark as completed
      execution.status = 'completed';
      execution.endTime = Date.now();
      this.metrics.completedExecutions++;

      const totalDuration = execution.endTime - execution.startTime;
      this.metrics.averageExecutionTime = 
        (this.metrics.averageExecutionTime + totalDuration) / 2;

      // Publish completion event
      await this.eventBus.publish('workflow.completed', {
        executionId,
        workflowId,
        duration: totalDuration,
        steps: execution.steps.length
      });

      logger.info('Workflow execution completed', { 
        executionId, 
        workflowId,
        duration: totalDuration,
        steps: execution.steps.length
      });

      return execution;

    } catch (error) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.endTime = Date.now();
      this.metrics.failedExecutions++;

      // Publish failure event
      await this.eventBus.publish('workflow.failed', {
        executionId,
        workflowId,
        error: error.message,
        currentStep: execution.currentStepIndex
      });

      logger.error('Workflow execution failed', {
        executionId,
        workflowId,
        error: error.message,
        currentStep: execution.currentStepIndex
      });

      throw error;
    }
  }

  /**
   * Execute individual workflow step
   */
  async executeStep(step, context, executionId) {
    // Resolve template variables in step parameters
    const resolvedStep = this.resolveTemplateVariables(step, context);
    
    switch (resolvedStep.type) {
      case 'agent_call':
        return await this.executeAgentCall(resolvedStep, context, executionId);
      
      case 'parallel':
        return await this.executeParallelSteps(resolvedStep, context, executionId);
      
      case 'conditional':
        return await this.executeConditionalStep(resolvedStep, context, executionId);
      
      case 'event':
        return await this.executeEventStep(resolvedStep, context, executionId);
      
      case 'delay':
        return await this.executeDelayStep(resolvedStep);
      
      case 'data_transform':
        return await this.executeDataTransform(resolvedStep, context);
      
      default:
        throw new Error(`Unknown step type: ${resolvedStep.type}`);
    }
  }

  /**
   * Execute agent call step
   */
  async executeAgentCall(step, context, executionId) {
    try {
      const routingResult = await this.router.route({
        intent: step.intent,
        context: { 
          ...context, 
          ...step.params,
          _workflowExecution: executionId,
          _workflowStep: step.id
        },
        text: step.text || `Workflow step: ${step.id}`
      });

      return routingResult.result;
      
    } catch (error) {
      logger.error('Agent call failed in workflow', {
        stepId: step.id,
        intent: step.intent,
        error: error.message,
        executionId
      });
      throw error;
    }
  }

  /**
   * Execute parallel steps
   */
  async executeParallelSteps(step, context, executionId) {
    const promises = step.agents.map(async (agentStep, index) => {
      try {
        const result = await this.router.route({
          intent: agentStep.intent,
          context: { 
            ...context, 
            ...agentStep.params,
            _workflowExecution: executionId,
            _parallelIndex: index
          }
        });
        return { success: true, result: result.result, agentIndex: index };
      } catch (error) {
        return { success: false, error: error.message, agentIndex: index };
      }
    });

    const results = await Promise.allSettled(promises);
    
    return {
      parallelResults: results.map(r => 
        r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message }
      ),
      allSuccessful: results.every(r => r.status === 'fulfilled' && r.value.success)
    };
  }

  /**
   * Execute conditional step
   */
  async executeConditionalStep(step, context, executionId) {
    const condition = await this.evaluateCondition(step.condition, context);
    
    if (condition && step.thenStep) {
      const result = await this.executeStep(step.thenStep, context, executionId);
      return { conditionResult: condition, branchTaken: 'then', result };
    } else if (!condition && step.elseStep) {
      const result = await this.executeStep(step.elseStep, context, executionId);
      return { conditionResult: condition, branchTaken: 'else', result };
    }
    
    return { conditionResult: condition, branchTaken: 'none' };
  }

  /**
   * Execute event publishing step
   */
  async executeEventStep(step, context, executionId) {
    const eventPayload = {
      ...context,
      ...step.payload,
      _workflowExecution: executionId,
      _workflowStep: step.id
    };

    const result = await this.eventBus.publish(
      step.eventType, 
      eventPayload,
      `workflow-${executionId}`
    );

    return { 
      eventPublished: step.eventType,
      eventId: result.event.id,
      notifiedAgents: result.results.length
    };
  }

  /**
   * Execute delay step
   */
  async executeDelayStep(step) {
    const delay = step.duration || 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
    return { delayed: delay };
  }

  /**
   * Execute data transformation step
   */
  async executeDataTransform(step, context) {
    // Simple data transformation using eval (be careful in production)
    try {
      const transformFunction = new Function('context', step.transform);
      const result = transformFunction(context);
      return { transformed: result };
    } catch (error) {
      throw new Error(`Data transform failed: ${error.message}`);
    }
  }

  /**
   * Evaluate conditional expressions
   */
  async evaluateCondition(condition, context) {
    if (typeof condition === 'boolean') return condition;
    if (typeof condition === 'function') return await condition(context);
    
    // Simple string evaluation (replace with proper expression parser in production)
    try {
      // Replace template variables
      const resolved = this.resolveTemplateString(condition, context);
      // Simple evaluation - extend with proper expression parser
      return eval(resolved);
    } catch (error) {
      logger.warn('Condition evaluation failed', { condition, error: error.message });
      return false;
    }
  }

  /**
   * Resolve template variables in step configuration
   */
  resolveTemplateVariables(step, context) {
    const resolved = JSON.parse(JSON.stringify(step));
    
    const resolveValue = (value) => {
      if (typeof value === 'string') {
        return this.resolveTemplateString(value, context);
      } else if (Array.isArray(value)) {
        return value.map(resolveValue);
      } else if (value && typeof value === 'object') {
        const resolvedObj = {};
        for (const [key, val] of Object.entries(value)) {
          resolvedObj[key] = resolveValue(val);
        }
        return resolvedObj;
      }
      return value;
    };

    return resolveValue(resolved);
  }

  /**
   * Resolve template strings like ${variable.path}
   */
  resolveTemplateString(template, context) {
    if (typeof template !== 'string') return template;
    
    return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
      try {
        // Navigate object path like "step_assess.releasable"
        const value = path.split('.').reduce((obj, key) => obj?.[key], context);
        return value !== undefined ? value : match;
      } catch (error) {
        return match;
      }
    });
  }

  /**
   * Validate workflow definition
   */
  validateWorkflow(workflow) {
    if (!workflow.steps || !Array.isArray(workflow.steps)) {
      throw new Error('Workflow must have steps array');
    }
    
    if (workflow.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }
    
    for (const step of workflow.steps) {
      if (!step.id) throw new Error('All steps must have an id');
      if (!step.type) throw new Error(`Step ${step.id} must have a type`);
    }
  }

  /**
   * Get workflow execution status
   */
  getExecution(executionId) {
    return this.executions.get(executionId);
  }

  /**
   * Get all workflow definitions
   */
  getWorkflows() {
    return Array.from(this.workflows.entries()).map(([id, workflow]) => ({
      id,
      name: workflow.name,
      steps: workflow.steps.length,
      registeredAt: workflow.registeredAt
    }));
  }

  /**
   * Get workflow metrics
   */
  getMetrics() {
    const activeExecutions = Array.from(this.executions.values())
      .filter(e => e.status === 'running').length;
      
    return {
      ...this.metrics,
      activeExecutions,
      totalWorkflows: this.workflows.size,
      successRate: this.metrics.totalExecutions > 0 
        ? this.metrics.completedExecutions / this.metrics.totalExecutions 
        : 0
    };
  }

  /**
   * Initialize manufacturing-specific workflows
   */
  initializeManufacturingWorkflows() {
    // Complete Batch Release Workflow
    this.registerWorkflow('batch_release_complete', {
      name: 'Complete Batch Release Process',
      description: 'Full batch release with quality and supply chain validation',
      steps: [
        {
          id: 'assess_orders',
          type: 'agent_call',
          intent: 'mar.assess_orders',
          description: 'Assess all pending orders for release readiness'
        },
        {
          id: 'quality_check',
          type: 'agent_call',
          intent: 'qa.pre_release_check',
          params: {
            orders: '${step_assess_orders.releasable}'
          },
          description: 'Quality pre-release validation'
        },
        {
          id: 'supply_validation',
          type: 'parallel',
          agents: [
            {
              intent: 'cmo.validate_materials',
              params: { orders: '${step_assess_orders.releasable}' }
            },
            {
              intent: 'cmo.check_transport_capacity',
              params: { orders: '${step_assess_orders.releasable}' }
            }
          ],
          description: 'Parallel supply chain validation'
        },
        {
          id: 'release_decision',
          type: 'conditional',
          condition: '${step_quality_check.ok} && ${step_supply_validation.allSuccessful}',
          thenStep: {
            id: 'execute_release',
            type: 'agent_call',
            intent: 'mar.batch_release',
            params: { confirm: true, validated: true }
          },
          elseStep: {
            id: 'notify_blocked',
            type: 'event',
            eventType: 'batch.release.blocked',
            payload: {
              reason: 'Quality or supply chain issues detected',
              qualityOk: '${step_quality_check.ok}',
              supplyOk: '${step_supply_validation.allSuccessful}'
            }
          },
          description: 'Decision point for batch release'
        },
        {
          id: 'notify_completion',
          type: 'event',
          eventType: 'batch.release.completed',
          payload: {
            batchId: '${step_execute_release.batchId}',
            releasedCount: '${step_execute_release.released.length}'
          },
          description: 'Notify completion to all stakeholders'
        }
      ]
    });

    // Morning Production Planning Workflow
    this.registerWorkflow('morning_production_planning', {
      name: 'Daily Production Planning',
      description: 'Automated morning production planning and optimization',
      steps: [
        {
          id: 'assess_daily_orders',
          type: 'agent_call',
          intent: 'mar.assess_orders'
        },
        {
          id: 'check_resource_availability',
          type: 'parallel',
          agents: [
            { intent: 'cmo.check_material_stock' },
            { intent: 'mar.check_line_availability' },
            { intent: 'qa.check_inspector_capacity' }
          ]
        },
        {
          id: 'optimize_schedule',
          type: 'agent_call',
          intent: 'mpc.optimize_daily_schedule',
          params: {
            orders: '${step_assess_daily_orders.releasable}',
            resources: '${step_check_resource_availability.parallelResults}'
          }
        },
        {
          id: 'notify_teams',
          type: 'event',
          eventType: 'production.daily_plan_ready',
          payload: {
            schedule: '${step_optimize_schedule.schedule}',
            date: new Date().toISOString().split('T')[0]
          }
        }
      ]
    });

    // Quality Alert Response Workflow
    this.registerWorkflow('quality_alert_response', {
      name: 'Quality Alert Response',
      description: 'Automated response to quality issues',
      steps: [
        {
          id: 'assess_impact',
          type: 'agent_call',
          intent: 'qa.assess_quality_impact',
          params: {
            material: '${material}',
            issue: '${issue}'
          }
        },
        {
          id: 'check_affected_batches',
          type: 'agent_call',
          intent: 'mar.find_affected_batches',
          params: {
            material: '${material}',
            timeframe: '${step_assess_impact.affectedTimeframe}'
          }
        },
        {
          id: 'notify_stakeholders',
          type: 'event',
          eventType: 'quality.issue.detected',
          payload: {
            severity: '${step_assess_impact.severity}',
            affectedBatches: '${step_check_affected_batches.batches}',
            recommendedActions: '${step_assess_impact.recommendations}'
          }
        }
      ]
    });

    logger.info('Manufacturing workflows initialized', {
      workflows: this.workflows.size
    });
  }
}

export default WorkflowOrchestrator;