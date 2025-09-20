// NEXT AGENTIC AI BUSINESS FEATURES FOR MANUFACTURING
// ===================================================

// 1. INTELLIGENT PRODUCTION PLANNING AGENT
// ----------------------------------------
// src/agents/planning.agent.js
export async function handle({ intent, context }) {
  const { data, llm, a2a } = context;
  
  switch (intent) {
    case 'planning.optimize_weekly':
      return await optimizeWeeklyPlan(data, llm, a2a);
    
    case 'planning.suggest_schedule':
      return await suggestOptimalSchedule(context, data, llm);
    
    case 'planning.analyze_bottlenecks':
      return await analyzeBottlenecks(data, llm, a2a);
    
    default:
      return { ok: false, error: `Unknown planning intent: ${intent}` };
  }
}

async function optimizeWeeklyPlan(data, llm, a2a) {
  // Get current orders and constraints
  const orders = await data.listOrders({ status: 'pending' });
  const equipment = await data.getEquipment({ status: 'operational' });
  const inventory = await data.getInventory();
  
  // AI-powered analysis using LLM
  const analysisPrompt = `Analyze this pharmaceutical production situation and create an optimal weekly plan:

ORDERS TO SCHEDULE:
${orders.map(o => `- ${o.material}: ${o.qty} units, Due: ${o.dueDate}, Priority: ${o.priority}`).join('\n')}

AVAILABLE EQUIPMENT:
${equipment.map(e => `- ${e.name}: Capacity ${e.capacity}, Efficiency ${e.currentEfficiency}%`).join('\n')}

CONSTRAINTS:
- GMP compliance required
- Quality testing time: 4-6 hours per batch
- Changeover time between products: 2-4 hours
- Maximum 16 hours production per day

Create a production plan that:
1. Maximizes equipment utilization
2. Meets all due dates
3. Minimizes changeovers
4. Balances workload across the week

Format as structured plan with reasoning.`;

  const llmResponse = await llm.chat([
    { role: 'user', content: analysisPrompt }
  ], { temperature: 0.3 });

  // Use MAR agent to validate feasibility
  const validationResult = await a2a('mar.validate_plan', {
    proposedPlan: llmResponse.text,
    orders,
    equipment
  });

  // Use QA agent to check quality requirements
  const qaCheck = await a2a('qa.validate_schedule', {
    materials: orders.map(o => o.material),
    timeline: 'weekly'
  });

  return {
    ok: true,
    optimizedPlan: {
      llmSuggestion: llmResponse.text,
      validation: validationResult,
      qualityCheck: qaCheck,
      confidence: validationResult.feasible && qaCheck.ok ? 0.9 : 0.6
    },
    nextActions: [
      'Review with production manager',
      'Validate material availability',
      'Schedule quality inspections'
    ]
  };
}

async function suggestOptimalSchedule(context, data, llm) {
  const { urgentOrders, constraints } = context;
  
  // AI agent suggests best scheduling approach
  const prompt = `As a pharmaceutical production scheduling expert, suggest the optimal approach for these urgent orders:

URGENT ORDERS:
${urgentOrders.map(o => `${o.material} - ${o.qty} units - Due: ${o.dueDate}`).join('\n')}

CURRENT CONSTRAINTS:
${JSON.stringify(constraints, null, 2)}

Consider:
- Regulatory requirements
- Equipment capabilities  
- Quality testing time
- Material availability
- Batch size optimization

Provide specific scheduling recommendations with business justification.`;

  const suggestion = await llm.chat([
    { role: 'user', content: prompt }
  ], { temperature: 0.2 });

  return {
    ok: true,
    aiSuggestion: suggestion.text,
    confidence: 0.85,
    businessImpact: 'High - Addresses urgent customer demands'
  };
}

// 2. INTELLIGENT QUALITY DECISION AGENT
// -------------------------------------
// src/agents/quality-intelligence.agent.js
export async function handle({ intent, context }) {
  const { data, llm, a2a, eventBus } = context;
  
  switch (intent) {
    case 'qa.intelligent_assessment':
      return await intelligentQualityAssessment(context, llm, a2a);
    
    case 'qa.predict_quality_risk':
      return await predictQualityRisk(context, data, llm);
    
    case 'qa.auto_deviation_investigation':
      return await autoDeviationInvestigation(context, llm, a2a);
    
    case 'qa.recommend_action':
      return await recommendQualityAction(context, llm);
    
    default:
      return { ok: false, error: `Unknown QA intelligence intent: ${intent}` };
  }
}

async function intelligentQualityAssessment(context, llm, a2a) {
  const { batchId, testResults, historicalData } = context;
  
  // AI analyzes quality data patterns
  const analysisPrompt = `Analyze these pharmaceutical quality test results for Batch ${batchId}:

CURRENT TEST RESULTS:
${JSON.stringify(testResults, null, 2)}

HISTORICAL PERFORMANCE (last 10 batches):
${JSON.stringify(historicalData, null, 2)}

As a pharmaceutical quality expert:
1. Assess if results are within acceptable limits
2. Identify any concerning trends
3. Recommend immediate actions
4. Suggest preventive measures
5. Estimate release probability

Consider GMP requirements and patient safety as top priorities.`;

  const aiAssessment = await llm.chat([
    { role: 'user', content: analysisPrompt }
  ], { temperature: 0.1 }); // Low temperature for consistent quality decisions

  // Get regulatory compliance check
  const complianceCheck = await a2a('regulatory.validate_release', {
    batchId,
    testResults,
    assessment: aiAssessment.text
  });

  return {
    ok: true,
    aiAssessment: aiAssessment.text,
    complianceStatus: complianceCheck,
    recommendation: extractRecommendation(aiAssessment.text),
    confidence: calculateConfidence(testResults, historicalData),
    businessImpact: assessBusinessImpact(testResults)
  };
}

async function predictQualityRisk(context, data, llm) {
  const { materialId, processParameters, environmentalData } = context;
  
  // Get historical quality data
  const historicalQuality = await data.getQcLots({ 
    material: materialId,
    limit: 50 
  });
  
  const riskPrompt = `Predict quality risks for manufacturing ${materialId} based on:

PROCESS PARAMETERS:
${JSON.stringify(processParameters, null, 2)}

ENVIRONMENTAL CONDITIONS:
${JSON.stringify(environmentalData, null, 2)}

HISTORICAL QUALITY TRENDS:
${historicalQuality.map(q => `${q.testDate}: ${q.overallResult} - Key issues: ${q.deviations || 'None'}`).join('\n')}

Predict:
1. Probability of quality issues (0-100%)
2. Most likely failure modes
3. Preventive actions to reduce risk
4. Critical control points to monitor

Focus on actionable insights for production team.`;

  const prediction = await llm.chat([
    { role: 'user', content: riskPrompt }
  ], { temperature: 0.2 });

  return {
    ok: true,
    riskPrediction: prediction.text,
    riskScore: extractRiskScore(prediction.text),
    preventiveActions: extractActions(prediction.text),
    monitoringPoints: extractControlPoints(prediction.text)
  };
}

// 3. SUPPLY CHAIN INTELLIGENCE AGENT
// ----------------------------------
// src/agents/supply-intelligence.agent.js
export async function handle({ intent, context }) {
  const { data, llm, a2a } = context;
  
  switch (intent) {
    case 'supply.predict_shortage':
      return await predictMaterialShortage(context, data, llm);
    
    case 'supply.optimize_procurement':
      return await optimizeProcurement(context, llm, a2a);
    
    case 'supply.supplier_risk_analysis':
      return await analyzeSupplierRisk(context, llm);
    
    case 'supply.demand_forecast':
      return await forecastDemand(context, data, llm);
    
    default:
      return { ok: false, error: `Unknown supply intelligence intent: ${intent}` };
  }
}

async function predictMaterialShortage(context, data, llm) {
  const { timeframe = '30d' } = context;
  
  // Get current inventory and consumption patterns
  const inventory = await data.getInventory();
  const orders = await data.listOrders({ 
    status: ['pending', 'released'],
    limit: 100 
  });
  
  const forecastPrompt = `Analyze material consumption and predict potential shortages:

CURRENT INVENTORY:
${inventory.map(i => `${i.material}: ${i.qty} ${i.unitOfMeasure} (Reorder level: ${i.reorderLevel})`).join('\n')}

UPCOMING PRODUCTION ORDERS:
${orders.map(o => `${o.material}: ${o.qty} units planned`).join('\n')}

TIMEFRAME: ${timeframe}

Predict:
1. Materials at risk of shortage
2. Estimated shortage dates
3. Business impact of each shortage
4. Recommended procurement actions
5. Alternative sourcing options

Prioritize by business criticality and lead times.`;

  const forecast = await llm.chat([
    { role: 'user', content: forecastPrompt }
  ], { temperature: 0.2 });

  return {
    ok: true,
    shortageForecast: forecast.text,
    criticalMaterials: extractCriticalMaterials(forecast.text),
    recommendedActions: extractProcurementActions(forecast.text),
    businessImpact: 'Prevents production delays and customer issues'
  };
}

async function optimizeProcurement(context, llm, a2a) {
  const { materials, budget, urgency } = context;
  
  const optimizationPrompt = `Optimize procurement strategy for these materials:

MATERIALS NEEDED:
${materials.map(m => `${m.id}: ${m.quantity} ${m.unit} - Urgency: ${m.urgency}`).join('\n')}

BUDGET CONSTRAINT: ${budget}
URGENCY LEVEL: ${urgency}

Consider:
- Supplier lead times and reliability
- Cost optimization vs speed
- Quality requirements
- Regulatory approvals
- Market conditions

Provide optimized procurement plan with:
1. Supplier recommendations
2. Order quantities and timing
3. Cost-benefit analysis
4. Risk mitigation strategies`;

  const optimization = await llm.chat([
    { role: 'user', content: optimizationPrompt }
  ], { temperature: 0.3 });

  // Validate with CMO agent
  const cmoValidation = await a2a('cmo.validate_procurement_plan', {
    materials,
    plan: optimization.text,
    budget
  });

  return {
    ok: true,
    optimizedPlan: optimization.text,
    validation: cmoValidation,
    estimatedSavings: calculateSavings(optimization.text),
    riskLevel: assessProcurementRisk(materials, urgency)
  };
}

// 4. INTELLIGENT CHATBOT INTERFACE
// --------------------------------
// src/services/IntelligentChatbot.js
export class IntelligentChatbot {
  constructor({ router, llm, eventBus }) {
    this.router = router;
    this.llm = llm;
    this.eventBus = eventBus;
    this.conversationMemory = new Map();
  }

  async handleNaturalLanguageQuery(userMessage, userId) {
    // Maintain conversation context
    const conversation = this.conversationMemory.get(userId) || [];
    
    // AI intent detection and context understanding
    const intentPrompt = `Analyze this pharmaceutical manufacturing query and determine the best agent to handle it:

USER MESSAGE: "${userMessage}"

CONVERSATION HISTORY:
${conversation.slice(-3).map(c => `${c.role}: ${c.message}`).join('\n')}

Available agent capabilities:
- MAR: Production planning, batch release, scheduling
- QA: Quality assessment, compliance checks, testing
- CMO: Supply chain, procurement, logistics
- PLANNING: Weekly optimization, bottleneck analysis
- SUPPLY-INTEL: Shortage prediction, demand forecasting

Respond with:
1. Best agent intent (e.g., "planning.optimize_weekly")
2. Extracted parameters
3. Confidence level
4. User-friendly explanation

Format as JSON.`;

    const intentAnalysis = await this.llm.chat([
      { role: 'user', content: intentPrompt }
    ], { temperature: 0.1 });

    let parsedIntent;
    try {
      parsedIntent = JSON.parse(intentAnalysis.text);
    } catch {
      // Fallback to simple intent detection
      parsedIntent = this.fallbackIntentDetection(userMessage);
    }

    // Route to appropriate agent
    const agentResponse = await this.router.route({
      intent: parsedIntent.intent,
      context: {
        ...parsedIntent.parameters,
        userMessage,
        conversationHistory: conversation
      }
    });

    // Generate human-friendly response
    const responsePrompt = `Convert this technical agent response into a friendly, business-focused answer:

USER ASKED: "${userMessage}"
AGENT RESPONSE: ${JSON.stringify(agentResponse.result, null, 2)}

Create a response that:
1. Directly answers the user's question
2. Highlights key business insights
3. Suggests next actions
4. Uses simple, professional language
5. Shows the AI's reasoning

Keep it concise but informative.`;

    const friendlyResponse = await this.llm.chat([
      { role: 'user', content: responsePrompt }
    ], { temperature: 0.4 });

    // Update conversation memory
    conversation.push(
      { role: 'user', message: userMessage, timestamp: new Date() },
      { role: 'assistant', message: friendlyResponse.text, timestamp: new Date() }
    );
    this.conversationMemory.set(userId, conversation.slice(-10)); // Keep last 10 exchanges

    return {
      response: friendlyResponse.text,
      agentUsed: parsedIntent.intent,
      confidence: parsedIntent.confidence,
      suggestedActions: extractSuggestedActions(agentResponse.result),
      technicalDetails: agentResponse.result
    };
  }

  fallbackIntentDetection(message) {
    const msg = message.toLowerCase();
    
    if (msg.includes('plan') || msg.includes('schedule') || msg.includes('optimize')) {
      return { intent: 'planning.optimize_weekly', parameters: {}, confidence: 0.7 };
    }
    if (msg.includes('quality') || msg.includes('test') || msg.includes('release')) {
      return { intent: 'qa.intelligent_assessment', parameters: {}, confidence: 0.7 };
    }
    if (msg.includes('material') || msg.includes('supply') || msg.includes('shortage')) {
      return { intent: 'supply.predict_shortage', parameters: {}, confidence: 0.7 };
    }
    
    return { intent: 'mar.assess_orders', parameters: {}, confidence: 0.5 };
  }
}

// 5. ENHANCED CHAT ENDPOINT WITH AI CONVERSATION
// ---------------------------------------------
// Enhanced chat controller in app.js
app.post('/api/chat/intelligent', auth, async (req, res) => {
  try {
    const { message, userId = 'anonymous' } = req.body;
    
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message required' });
    }

    // Use intelligent chatbot
    if (!services.intelligentChatbot) {
      services.intelligentChatbot = new IntelligentChatbot({
        router: services.router,
        llm: services.llm,
        eventBus: services.eventBus
      });
    }

    const response = await services.intelligentChatbot.handleNaturalLanguageQuery(
      message, 
      userId
    );

    res.json({
      ok: true,
      ...response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Intelligent chat error:', error);
    res.status(500).json({ 
      error: error.message,
      fallback: 'Try using specific commands or contact support'
    });
  }
});

// 6. BUSINESS INTELLIGENCE DASHBOARD
// ----------------------------------
app.get('/api/intelligence/insights', auth, async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;
    
    // Get AI-powered business insights
    const insights = await Promise.all([
      // Production optimization insights
      services.router.route({
        intent: 'planning.analyze_bottlenecks',
        context: { timeframe, data: appData }
      }),
      
      // Quality trends
      services.router.route({
        intent: 'qa.predict_quality_risk',
        context: { timeframe, data: appData }
      }),
      
      // Supply chain predictions
      services.router.route({
        intent: 'supply.predict_shortage',
        context: { timeframe, data: appData }
      })
    ]);

    res.json({
      ok: true,
      timeframe,
      insights: {
        production: insights[0].result,
        quality: insights[1].result,
        supply: insights[2].result
      },
      generatedAt: new Date().toISOString(),
      aiPowered: true
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
function extractRecommendation(aiText) {
  // Extract key recommendations from AI response
  const lines = aiText.split('\n');
  const recommendations = lines.filter(line => 
    line.includes('recommend') || 
    line.includes('suggest') || 
    line.includes('action')
  );
  return recommendations.slice(0, 3).join('; ');
}

function calculateConfidence(testResults, historicalData) {
  // Simple confidence calculation based on data completeness
  const dataQuality = (testResults ? 0.5 : 0) + (historicalData?.length > 5 ? 0.5 : 0);
  return Math.min(0.95, 0.6 + dataQuality);
}

function extractRiskScore(aiText) {
  const match = aiText.match(/(\d+)%/);
  return match ? parseInt(match[1]) : 50;
}

function extractActions(aiText) {
  const lines = aiText.split('\n');
  return lines
    .filter(line => line.includes('action') || line.includes('prevent'))
    .slice(0, 3);
}

function extractCriticalMaterials(aiText) {
  // Extract material codes mentioned in the AI response
  const materials = aiText.match(/[A-Z]+-\d+/g) || [];
  return [...new Set(materials)];
}

function extractSuggestedActions(agentResult) {
  return agentResult.nextActions || 
         agentResult.recommendedActions || 
         agentResult.actions || 
         ['Review results', 'Take appropriate action'];
}