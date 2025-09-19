// src/agents/mar.agent.js - Enhanced MAR Agent for Phase 2
import logger from '../services/logger.js';
import { ManufacturingAgent } from '../services/BaseAgent.js';

/**
 * Enhanced Manufacturing Agent with Phase 2 event-driven capabilities
 * Demonstrates event subscription, workflow integration, and reactive manufacturing
 */

let marAgent = null; // Global agent instance for event handling

export async function handle({ intent, context }) {
  const { data, a2a, llm, eventBus, router } = context;
  const startTime = Date.now();
  
  // Initialize agent instance for event handling if not exists
  if (!marAgent && eventBus && router) {
    marAgent = new ManufacturingAgent('mar-agent', eventBus, router);
    await marAgent.initialize();
    
    // Subscribe to manufacturing events
    marAgent.subscribe('material.shortage', async (event) => {
      logger.warn('Material shortage detected', {
        material: event.payload.material,
        currentStock: event.payload.currentStock
      });
      
      // Auto-trigger supply chain action
      try {
        await marAgent.a2a('cmo.create_urgent_pr', {
          material: event.payload.material,
          urgency: 'high',
          reason: 'stock_shortage'
        });
      } catch (error) {
        logger.error('Failed to create urgent PR', error);
      }
    });
    
    marAgent.subscribe('quality.alert', async (event) => {
      const { material, severity, issue } = event.payload;
      
      if (severity === 'high' || severity === 'critical') {
        // Find and hold affected batches
        const affectedOrders = data.orders.filter(o => 
          o.material === material && o.status === 'released'
        );
        
        if (affectedOrders.length > 0) {
          // Publish batch hold event
          await marAgent.publish('batch.hold_required', {
            material,
            reason: issue,
            affectedOrders: affectedOrders.map(o => o.id)
          });
        }
      }
    });
    
    logger.info('MAR Agent initialized with Phase 2 capabilities');
  }
  
  logger.info('MAR Agent handling intent', { intent, contextKeys: Object.keys(context) });
  
  try {
    switch (intent) {
      case 'mar.assess_orders':
        return await assessOrdersEnhanced(data, a2a, llm, eventBus);
        
      case 'mar.batch_release':
        return await batchReleaseEnhanced(data, context, a2a, eventBus);
        
      case 'mar.schedule_line':
        return await scheduleLineEnhanced(context, data, a2a);
        
      case 'mar.morning_briefing':
        return await generateMorningBriefing(data, a2a, llm, eventBus);
        
      case 'mar.find_affected_batches':
        return await findAffectedBatches(context, data);
        
      case 'mar.check_line_availability':
        return await checkLineAvailability(context, data);
        
      default:
        return {
          ok: false,
          error: `Unknown MAR intent: ${intent}`,
          supportedIntents: [
            'mar.assess_orders',
            'mar.batch_release', 
            'mar.schedule_line',
            'mar.morning_briefing',
            'mar.find_affected_batches',
            'mar.check_line_availability'
          ]
        };
    }
  } catch (error) {
    logger.error('MAR Agent error', { 
      intent, 
      error: error.message, 
      duration: Date.now() - startTime 
    });
    
    return {
      ok: false,
      error: error.message,
      type: 'MAR_AGENT_ERROR',
      intent,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Enhanced order assessment with event-driven QA and supply chain validation
 */
async function assessOrdersEnhanced(data, a2a, llm, eventBus) {
  const orders = data.orders.filter(o => !o.status || o.status === 'pending');
  const assessments = [];
  
  logger.info(`Assessing ${orders.length} pending orders with Phase 2 capabilities`);
  
  for (const order of orders) {
    const basicAssessment = assessSingleOrder(order, data);
    
    // A2A call to QA for quality assessment
    let qaAssessment = null;
    if (a2a) {
      try {
        qaAssessment = await a2a('qa.assess_order_quality', {
          orderId: order.id,
          material: order.material,
          qty: order.qty
        });
      } catch (error) {
        logger.warn('QA assessment failed', { orderId: order.id, error: error.message });
      }
    }
    
    // A2A call to CMO for supply chain validation
    let supplyAssessment = null;
    if (a2a && basicAssessment.missing?.length > 0) {
      try {
        supplyAssessment = await a2a('cmo.check_supply_availability', {
          materials: basicAssessment.missing.map(m => m.component),
          requiredBy: order.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });
      } catch (error) {
        logger.warn('Supply assessment failed', { orderId: order.id, error: error.message });
      }
    }
    
    const finalAssessment = {
      ...basicAssessment,
      qa: qaAssessment,
      supply: supplyAssessment,
      finalOk: basicAssessment.ok && (qaAssessment?.ok !== false)
    };
    
    assessments.push({
      orderId: order.id,
      material: order.material,
      qty: order.qty,
      dueDate: order.dueDate,
      assessment: finalAssessment
    });
    
    // Publish events for blocked orders
    if (!finalAssessment.finalOk && eventBus) {
      await eventBus.publish('order.assessment.blocked', {
        orderId: order.id,
        material: order.material,
        blockingReasons: getBlockingReasons(finalAssessment)
      });
    }
  }
  
  const releasable = assessments.filter(a => a.assessment.finalOk);
  const blocked = assessments.filter(a => !a.assessment.finalOk);
  
  // Publish assessment completed event
  if (eventBus) {
    await eventBus.publish('order.assessment.completed', {
      totalOrders: assessments.length,
      releasable: releasable.length,
      blocked: blocked.length,
      timestamp: new Date().toISOString()
    });
  }
  
  // Generate intelligent recommendations using LLM if available
  let recommendations = [];
  if (llm && blocked.length > 0) {
    try {
      const blockedSummary = blocked.map(b => ({
        order: b.orderId,
        material: b.material,
        issues: getBlockingReasons(b.assessment)
      }));
      
      const recommendationPrompt = `Analyze these blocked production orders and provide actionable recommendations:

${JSON.stringify(blockedSummary, null, 2)}

Provide 3-5 specific, actionable recommendations to resolve the blocking issues. Focus on:
- Material procurement priorities
- Quality issue resolution
- Process improvements
- Timeline adjustments

Format as bullet points, max 50 words each.`;

      const response = await llm.chat([
        { role: 'user', content: recommendationPrompt }
      ], { temperature: 0.3, max_tokens: 500 });
      
      recommendations = response.text.split('\n')
        .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
        .map(line => line.trim().replace(/^[-•]\s*/, ''))
        .filter(Boolean);
        
    } catch (error) {
      logger.warn('Failed to generate LLM recommendations', { error: error.message });
    }
  }
  
  return {
    ok: true,
    summary: `${releasable.length}/${assessments.length} orders ready for release`,
    total: assessments.length,
    releasable: releasable.map(r => ({
      orderId: r.orderId,
      material: r.material,
      qty: r.qty,
      dueDate: r.dueDate
    })),
    blocked: blocked.map(b => ({
      orderId: b.orderId,
      material: b.material,
      issues: getBlockingReasons(b.assessment)
    })),
    recommendations,
    actions: releasable.length > 0 ? [
      { 
        id: 'batch_release', 
        label: `Release ${releasable.length} orders`,
        payload: { intent: 'mar.batch_release', confirm: true }
      },
      {
        id: 'workflow_batch_release',
        label: `Complete Workflow Release (${releasable.length} orders)`,
        payload: { workflowId: 'batch_release_complete' }
      }
    ] : [],
    timestamp: new Date().toISOString(),
    phase2Features: {
      eventDriven: !!eventBus,
      qaIntegration: !!qaAssessment,
      supplyChainValidation: !!supplyAssessment
    }
  };
}

/**
 * Enhanced batch release with comprehensive event publishing
 */
async function batchReleaseEnhanced(data, context, a2a, eventBus) {
  const { confirm = false, dryRun = false, validated = false } = context;
  
  const releasableOrders = data.orders.filter(o => 
    (!o.status || o.status === 'pending') && 
    assessSingleOrder(o, data).ok
  );
  
  if (!confirm && !dryRun) {
    return {
      ok: true,
      summary: `${releasableOrders.length} orders ready for batch release`,
      orders: releasableOrders.map(o => ({ 
        id: o.id, 
        material: o.material, 
        qty: o.qty,
        line: o.line || 'PCK-01'
      })),
      requiresConfirmation: true,
      estimatedDuration: Math.ceil(releasableOrders.length / 5) + ' hours',
      phase2Ready: !!eventBus
    };
  }
  
  if (dryRun) {
    return {
      ok: true,
      type: 'dry_run',
      summary: `Dry run: ${releasableOrders.length} orders would be released`,
      orders: releasableOrders.map(o => ({ 
        id: o.id, 
        material: o.material, 
        qty: o.qty 
      })),
      estimatedImpact: {
        linesAffected: [...new Set(releasableOrders.map(o => o.line || 'PCK-01'))],
        totalQuantity: releasableOrders.reduce((sum, o) => sum + (o.qty || 0), 0),
        estimatedCompletionTime: new Date(Date.now() + Math.ceil(releasableOrders.length / 5) * 60 * 60 * 1000).toISOString()
      }
    };
  }
  
  // Execute actual release
  const batchId = `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const released = [];
  
  // Publish batch started event
  if (eventBus) {
    await eventBus.publishBatchStarted(batchId, releasableOrders, 'PCK-01');
  }
  
  for (const order of releasableOrders) {
    order.status = 'released';
    order.releasedAt = new Date().toISOString();
    order.batch = batchId;
    order.releaseAgent = 'MAR';
    order.validated = validated;
    
    released.push({
      orderId: order.id,
      material: order.material,
      qty: order.qty,
      batch: order.batch,
      line: order.line || 'PCK-01'
    });
  }
  
  // A2A notifications for downstream processes
  if (a2a) {
    // Notify MPC for production scheduling
    try {
      await a2a('mpc.schedule_batch', {
        batchId,
        orders: released,
        priority: 'normal'
      });
    } catch (error) {
      logger.warn('MPC scheduling notification failed', { batchId, error: error.message });
    }
    
    // Notify QA for inspection planning
    try {
      await a2a('qa.plan_batch_inspection', {
        batchId,
        materials: [...new Set(released.map(r => r.material))],
        totalQty: released.reduce((sum, r) => sum + (r.qty || 0), 0),
        priority: 'normal'
      });
    } catch (error) {
      logger.warn('QA inspection planning failed', { batchId, error: error.message });
    }
  }
  
  // Publish batch completion event
  if (eventBus) {
    await eventBus.publishBatchCompleted(batchId, {
      releasedOrders: released.length,
      totalQuantity: released.reduce((sum, r) => sum + (r.qty || 0), 0)
    });
  }
  
  return {
    ok: true,
    summary: `Batch release completed: ${released.length} orders released`,
    batchId,
    released,
    releaseTime: new Date().toISOString(),
    nextSteps: [
      'MPC scheduling initiated',
      'QA inspection planning notified',
      'Production lines will be updated',
      'Event notifications sent to all stakeholders'
    ],
    phase2Features: {
      eventPublished: !!eventBus,
      downstreamNotified: !!a2a
    }
  };
}

/**
 * Enhanced line scheduling with capacity optimization
 */
async function scheduleLineEnhanced(context, data, a2a) {
  const { material, qty, line, date, priority = 'normal' } = context;
  
  const targetLine = line || 'PCK-01';
  const targetQty = qty || 1000;
  const scheduledDate = date || new Date().toISOString().split('T')[0];
  
  // A2A call to MPC for optimized scheduling
  let optimizedSchedule = null;
  if (a2a) {
    try {
      optimizedSchedule = await a2a('mpc.optimize_schedule', {
        orders: [{
          material: material || 'FG-123',
          qty: targetQty,
          line: targetLine,
          dueDate: scheduledDate,
          priority
        }],
        constraints: {
          maxLines: 3,
          workingHours: { start: 6, end: 22 },
          maintenance: []
        }
      });
    } catch (error) {
      logger.warn('MPC optimization failed, using basic scheduling', { error: error.message });
    }
  }
  
  const schedule = optimizedSchedule?.schedule || {
    material: material || 'FG-123',
    qty: targetQty,
    line: targetLine,
    scheduledDate,
    estimatedDuration: Math.ceil(targetQty / 100), // Basic rate: 100 units/hour
    startTime: '06:00',
    endTime: `${6 + Math.ceil(targetQty / 100)}:00`,
    scheduleId: `SCH-${Date.now()}`
  };
  
  return {
    ok: true,
    schedule,
    optimization: optimizedSchedule ? 'mpc' : 'basic',
    confidence: optimizedSchedule ? 0.9 : 0.7,
    recommendations: [
      targetQty > 5000 && 'Consider splitting into multiple batches',
      priority === 'urgent' && 'Alert production supervisor',
      !optimizedSchedule && 'Run MPC optimization for better results'
    ].filter(Boolean)
  };
}

/**
 * Generate comprehensive morning briefing with Phase 2 insights
 */
async function generateMorningBriefing(data, a2a, llm, eventBus) {
  const briefingData = {
    timestamp: new Date().toISOString(),
    orders: {
      pending: data.orders.filter(o => !o.status || o.status === 'pending').length,
      released: data.orders.filter(o => o.status === 'released').length,
      completed: data.orders.filter(o => o.status === 'completed').length
    },
    inventory: {
      totalItems: data.inventory.length,
      lowStock: data.inventory.filter(i => i.qty < (i.minStock || 100)).length
    }
  };
  
  // Get recent event history for context
  if (eventBus) {
    const recentEvents = eventBus.getEventHistory({
      since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      limit: 20
    });
    
    briefingData.recentActivity = {
      totalEvents: recentEvents.length,
      qualityAlerts: recentEvents.filter(e => e.type.includes('quality')).length,
      batchEvents: recentEvents.filter(e => e.type.includes('batch')).length,
      supplyEvents: recentEvents.filter(e => e.type.includes('material')).length
    };
  }
  
  // A2A calls for comprehensive status
  if (a2a) {
    try {
      briefingData.qa = await a2a('qa.get_daily_status', {
        date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      logger.warn('QA status retrieval failed', { error: error.message });
    }
    
    try {
      briefingData.supply = await a2a('cmo.get_supply_alerts', {
        lookAhead: 7 // days
      });
    } catch (error) {
      logger.warn('Supply chain alerts retrieval failed', { error: error.message });
    }
  }
  
  return {
    ok: true,
    briefing: {
      ...briefingData,
      keyMetrics: {
        productionReadiness: Math.round((briefingData.orders.released / (briefingData.orders.pending + briefingData.orders.released || 1)) * 100),
        inventoryHealth: Math.round(((briefingData.inventory.totalItems - briefingData.inventory.lowStock) / briefingData.inventory.totalItems || 1) * 100),
        qaBacklog: briefingData.qa?.pendingInspections || 0,
        eventActivity: briefingData.recentActivity?.totalEvents || 0
      },
      priorities: [
        briefingData.orders.pending > 10 && 'High pending order volume',
        briefingData.inventory.lowStock > 5 && 'Multiple low stock items',
        briefingData.qa?.pendingInspections > 3 && 'QA inspection backlog',
        briefingData.supply?.criticalAlerts?.length > 0 && 'Supply chain disruptions',
        briefingData.recentActivity?.qualityAlerts > 2 && 'Elevated quality alerts'
      ].filter(Boolean)
    },
    phase2Insights: !!eventBus,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Find batches affected by quality issues
 */
async function findAffectedBatches(context, data) {
  const { material, timeframe, issue } = context;
  const cutoffTime = timeframe ? new Date(timeframe).getTime() : Date.now() - (24 * 60 * 60 * 1000);
  
  const affectedBatches = data.orders.filter(order => {
    if (order.material !== material) return false;
    if (!order.releasedAt) return false;
    
    const releaseTime = new Date(order.releasedAt).getTime();
    return releaseTime >= cutoffTime;
  });
  
  return {
    ok: true,
    material,
    issue,
    timeframe: new Date(cutoffTime).toISOString(),
    batches: affectedBatches.map(batch => ({
      orderId: batch.id,
      batchId: batch.batch,
      qty: batch.qty,
      releasedAt: batch.releasedAt,
      status: batch.status
    })),
    totalAffected: affectedBatches.length,
    recommendedActions: affectedBatches.length > 0 ? [
      'Hold affected batches pending investigation',
      'Notify QA for immediate inspection',
      'Contact customers if product shipped'
    ] : ['No recent batches affected']
  };
}

/**
 * Check production line availability
 */
async function checkLineAvailability(context, data) {
  const { date, line } = context;
  const targetDate = date || new Date().toISOString().split('T')[0];
  const targetLine = line || 'PCK-01';
  
  // Simple availability check based on current orders
  const scheduledOrders = data.orders.filter(order => {
    return order.line === targetLine && 
           order.status === 'released' &&
           order.scheduledDate === targetDate;
  });
  
  const totalScheduledHours = scheduledOrders.reduce((total, order) => {
    return total + Math.ceil((order.qty || 0) / 100); // 100 units/hour rate
  }, 0);
  
  const availableHours = 16; // 6 AM to 10 PM
  const utilizationPercent = Math.round((totalScheduledHours / availableHours) * 100);
  
  return {
    ok: true,
    line: targetLine,
    date: targetDate,
    availability: {
      totalCapacity: availableHours,
      scheduled: totalScheduledHours,
      available: Math.max(0, availableHours - totalScheduledHours),
      utilization: utilizationPercent
    },
    scheduledOrders: scheduledOrders.length,
    status: utilizationPercent > 90 ? 'fully_booked' : 
            utilizationPercent > 70 ? 'busy' : 'available'
  };
}

// Helper functions
function assessSingleOrder(order, data) {
  const material = order.material;
  const qty = order.qty || 0;
  
  const bom = data.bom[material] || [];
  const needs = bom.map(b => ({
    component: b.component,
    need: qty * (b.perFG || 0)
  }));
  
  const missing = needs.filter(n => {
    const stock = data.inventory.find(i => i.material === n.component)?.qty || 0;
    return stock < n.need;
  });
  
  const rules = data.rules.filter(r => 
    r.material === material && 
    r.country === (order.country || 'EU')
  );
  const tricOk = rules.every(r => r.status !== 'notallowed');
  
  const rmslRule = rules.find(r => r.type === 'RMSL');
  const bulkId = `BULK-${material.split('-')[1] || ''}`;
  const bulk = data.inventory.find(i => i.material === bulkId);
  const rmslOk = !rmslRule || (bulk?.rmslPct || 100) >= (rmslRule.minPct || 0);
  
  const md = data.masterdata[material];
  const mdOk = md?.status === 'Active';
  
  const ok = tricOk && rmslOk && mdOk && missing.length === 0;
  
  return { ok, tricOk, rmslOk, mdOk, missing, needs, bomCount: bom.length };
}

function getBlockingReasons(assessment) {
  const reasons = [];
  if (!assessment.tricOk) reasons.push('TRIC compliance violation');
  if (!assessment.mdOk) reasons.push('Master data inactive');
  if (!assessment.rmslOk) reasons.push('RMSL requirements not met');
  if (assessment.missing?.length > 0) {
    reasons.push(`Missing materials: ${assessment.missing.map(m => m.component).slice(0, 3).join(', ')}`);
  }
  if (assessment.qa?.ok === false) reasons.push('Quality concerns identified');
  return reasons;
}