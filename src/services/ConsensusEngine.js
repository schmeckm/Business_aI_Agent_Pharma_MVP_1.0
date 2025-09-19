// src/services/ConsensusEngine.js - Phase 3 Consensus-Based Decision Making
import { v4 as uuidv4 } from "uuid";

/**
 * ConsensusEngine - Advanced multi-agent decision making for manufacturing
 * Implements voting mechanisms, conflict resolution, and weighted consensus
 */
export class ConsensusEngine {
  constructor({ router, eventBus, knowledgeGraph = null }) {
    this.router = router;
    this.eventBus = eventBus;
    this.knowledgeGraph = knowledgeGraph;
    
    this.decisions = new Map(); // Active decisions
    this.decisionHistory = [];
    
    // Voting mechanisms
    this.votingMethods = {
      majority: this.majorityVoting.bind(this),
      weighted: this.weightedVoting.bind(this),
      unanimous: this.unanimousVoting.bind(this),
      expertise: this.expertiseBasedVoting.bind(this)
    };
    
    // Agent expertise weights for different decision types
    this.expertiseWeights = {
      'quality_decision': { 'qa': 0.5, 'mar': 0.3, 'cmo': 0.2 },
      'production_decision': { 'mar': 0.6, 'qa': 0.2, 'cmo': 0.2 },
      'supply_decision': { 'cmo': 0.6, 'mar': 0.3, 'qa': 0.1 },
      'compliance_decision': { 'qa': 0.4, 'mar': 0.3, 'cmo': 0.2, 'regulatory': 0.1 },
      'emergency_decision': { 'mar': 0.4, 'qa': 0.4, 'cmo': 0.2 }
    };
    
    this.metrics = {
      decisionsProcessed: 0,
      consensusReached: 0,
      conflictsResolved: 0,
      averageDecisionTime: 0
    };
    
    console.log('ConsensusEngine initialized for Phase 3');
  }

  /**
   * Main decision making orchestrator
   */
  async makeDecision(decisionRequest) {
    const decisionId = uuidv4();
    const startTime = Date.now();
    
    try {
      console.log('Starting consensus decision', { decisionId, type: decisionRequest.type });
      
      // Create decision context
      const decision = {
        id: decisionId,
        type: decisionRequest.type,
        context: decisionRequest.context || {},
        stakeholders: decisionRequest.stakeholders || ['mar', 'qa', 'cmo'],
        votingMethod: decisionRequest.votingMethod || 'weighted',
        priority: decisionRequest.priority || 'normal',
        timeout: decisionRequest.timeout || 30000,
        startTime,
        status: 'gathering_input',
        votes: new Map(),
        result: null
      };
      
      this.decisions.set(decisionId, decision);
      
      // Step 1: Gather input from stakeholders
      await this.gatherStakeholderInput(decision);
      
      // Step 2: Apply voting mechanism
      const votingResult = await this.applyVotingMechanism(decision);
      
      // Step 3: Check for conflicts and resolve if necessary
      if (votingResult.hasConflict) {
        const conflictResolution = await this.resolveConflicts(decision, votingResult);
        votingResult.finalDecision = conflictResolution;
        this.metrics.conflictsResolved++;
      }
      
      // Step 4: Finalize decision
      decision.result = votingResult.finalDecision;
      decision.status = 'completed';
      decision.duration = Date.now() - startTime;
      
      // Update metrics
      this.updateMetrics(decision);
      
      // Store in history
      this.decisionHistory.push({
        ...decision,
        completedAt: Date.now()
      });
      
      // Emit decision made event
      if (this.eventBus) {
        this.eventBus.emit('consensus.decision_made', {
          decisionId,
          type: decision.type,
          result: decision.result,
          significance: decision.priority === 'high' ? 'high' : 'normal'
        });
      }
      
      console.log('Consensus decision completed', { decisionId, result: decision.result.decision });
      
      return {
        success: true,
        decisionId,
        decision: decision.result.decision,
        confidence: decision.result.confidence,
        stakeholderVotes: Array.from(decision.votes.entries()),
        duration: decision.duration,
        votingMethod: decision.votingMethod
      };
      
    } catch (error) {
      console.error('Consensus decision failed', { decisionId, error: error.message });
      
      // Update decision status
      if (this.decisions.has(decisionId)) {
        const decision = this.decisions.get(decisionId);
        decision.status = 'failed';
        decision.error = error.message;
      }
      
      throw error;
    } finally {
      // Clean up active decision
      this.decisions.delete(decisionId);
    }
  }

  /**
   * Gather input from all stakeholders
   */
  async gatherStakeholderInput(decision) {
    const inputPromises = decision.stakeholders.map(async (stakeholder) => {
      try {
        console.log(`Gathering input from ${stakeholder}`);
        
        // Route to specific agent for input
        const agentInput = await this.router.routeToAgent(stakeholder, 'provide_input', {
          decision: decision.type,
          context: decision.context,
          priority: decision.priority
        });
        
        return {
          stakeholder,
          input: agentInput,
          timestamp: Date.now(),
          success: true
        };
        
      } catch (error) {
        console.warn(`Failed to get input from ${stakeholder}:`, error.message);
        
        // Provide default input if agent unavailable
        return {
          stakeholder,
          input: this.getDefaultInput(stakeholder, decision),
          timestamp: Date.now(),
          success: false,
          error: error.message
        };
      }
    });
    
    const inputs = await Promise.all(inputPromises);
    
    // Store votes from inputs
    inputs.forEach(input => {
      decision.votes.set(input.stakeholder, {
        vote: input.input.recommendation || 'abstain',
        confidence: input.input.confidence || 0.5,
        reasoning: input.input.reasoning || 'No reasoning provided',
        timestamp: input.timestamp,
        success: input.success
      });
    });
    
    decision.status = 'voting';
  }

  /**
   * Apply the specified voting mechanism
   */
  async applyVotingMechanism(decision) {
    const votingMethod = this.votingMethods[decision.votingMethod];
    if (!votingMethod) {
      throw new Error(`Unknown voting method: ${decision.votingMethod}`);
    }
    
    return await votingMethod(decision);
  }

  /**
   * Majority voting implementation
   */
  async majorityVoting(decision) {
    const votes = Array.from(decision.votes.values());
    const voteCounts = {};
    
    votes.forEach(vote => {
      const decision_vote = vote.vote;
      voteCounts[decision_vote] = (voteCounts[decision_vote] || 0) + 1;
    });
    
    const sortedVotes = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
    const winningVote = sortedVotes[0];
    
    const hasConflict = sortedVotes.length > 1 && sortedVotes[0][1] === sortedVotes[1][1];
    
    return {
      finalDecision: {
        decision: winningVote[0],
        confidence: winningVote[1] / votes.length,
        votingMethod: 'majority',
        voteDistribution: voteCounts
      },
      hasConflict
    };
  }

  /**
   * Weighted voting based on expertise
   */
  async weightedVoting(decision) {
    const weights = this.getExpertiseWeights(decision);
    let totalWeight = 0;
    const weightedVotes = {};
    
    for (const [stakeholder, vote] of decision.votes.entries()) {
      const weight = weights[stakeholder] || 0.1; // Default minimal weight
      totalWeight += weight;
      
      const decision_vote = vote.vote;
      weightedVotes[decision_vote] = (weightedVotes[decision_vote] || 0) + (weight * vote.confidence);
    }
    
    const sortedWeightedVotes = Object.entries(weightedVotes).sort((a, b) => b[1] - a[1]);
    const winningVote = sortedWeightedVotes[0];
    
    const hasConflict = sortedWeightedVotes.length > 1 && 
                       Math.abs(sortedWeightedVotes[0][1] - sortedWeightedVotes[1][1]) < 0.1;
    
    return {
      finalDecision: {
        decision: winningVote[0],
        confidence: winningVote[1] / totalWeight,
        votingMethod: 'weighted',
        weightedScores: weightedVotes
      },
      hasConflict
    };
  }

  /**
   * Unanimous voting - requires all stakeholders to agree
   */
  async unanimousVoting(decision) {
    const votes = Array.from(decision.votes.values());
    const uniqueVotes = new Set(votes.map(v => v.vote));
    
    if (uniqueVotes.size === 1) {
      const unanimousDecision = votes[0].vote;
      const averageConfidence = votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;
      
      return {
        finalDecision: {
          decision: unanimousDecision,
          confidence: averageConfidence,
          votingMethod: 'unanimous',
          unanimous: true
        },
        hasConflict: false
      };
    }
    
    return {
      finalDecision: {
        decision: 'no_consensus',
        confidence: 0,
        votingMethod: 'unanimous',
        unanimous: false,
        reason: 'No unanimous agreement reached'
      },
      hasConflict: true
    };
  }

  /**
   * Expertise-based voting - weight votes by agent expertise
   */
  async expertiseBasedVoting(decision) {
    // Similar to weighted but uses dynamic expertise calculation
    const expertiseScores = await this.calculateDynamicExpertise(decision);
    
    let totalExpertise = 0;
    const expertiseWeightedVotes = {};
    
    for (const [stakeholder, vote] of decision.votes.entries()) {
      const expertise = expertiseScores[stakeholder] || 0.1;
      totalExpertise += expertise;
      
      const decision_vote = vote.vote;
      expertiseWeightedVotes[decision_vote] = 
        (expertiseWeightedVotes[decision_vote] || 0) + (expertise * vote.confidence);
    }
    
    const sortedExpertiseVotes = Object.entries(expertiseWeightedVotes).sort((a, b) => b[1] - a[1]);
    const winningVote = sortedExpertiseVotes[0];
    
    return {
      finalDecision: {
        decision: winningVote[0],
        confidence: winningVote[1] / totalExpertise,
        votingMethod: 'expertise',
        expertiseScores,
        weightedScores: expertiseWeightedVotes
      },
      hasConflict: false
    };
  }

  /**
   * Resolve conflicts when voting results are ambiguous
   */
  async resolveConflicts(decision, votingResult) {
    console.log('Resolving decision conflict', { decisionId: decision.id });
    
    // Strategy 1: Check if knowledge graph can provide additional context
    if (this.knowledgeGraph) {
      const additionalContext = await this.knowledgeGraph.queryContext(
        `How to resolve conflict in ${decision.type}?`,
        Object.keys(decision.context)
      );
      
      if (additionalContext.confidence > 0.8) {
        // Use knowledge graph recommendation
        return {
          decision: additionalContext.synthesizedAnswer || votingResult.finalDecision.decision,
          confidence: additionalContext.confidence,
          resolutionMethod: 'knowledge_graph',
          originalResult: votingResult.finalDecision
        };
      }
    }
    
    // Strategy 2: Use expertise weights as tiebreaker
    const expertiseWeights = this.getExpertiseWeights(decision);
    let highestExpertiseVote = null;
    let highestExpertise = 0;
    
    for (const [stakeholder, vote] of decision.votes.entries()) {
      const expertise = expertiseWeights[stakeholder] || 0;
      if (expertise > highestExpertise) {
        highestExpertise = expertise;
        highestExpertiseVote = vote.vote;
      }
    }
    
    if (highestExpertiseVote) {
      return {
        decision: highestExpertiseVote,
        confidence: 0.7, // Moderate confidence for conflict resolution
        resolutionMethod: 'expertise_tiebreaker',
        originalResult: votingResult.finalDecision
      };
    }
    
    // Strategy 3: Find compromise solution
    const compromise = await this.findCompromise(decision);
    if (compromise) {
      return compromise;
    }
    
    // Strategy 4: Default to safety-first approach
    return {
      decision: 'hold_for_review',
      confidence: 0.5,
      resolutionMethod: 'safety_first',
      reason: 'Conflict could not be resolved automatically',
      originalResult: votingResult.finalDecision
    };
  }

  /**
   * Get default input when agent is unavailable
   */
  getDefaultInput(stakeholder, decision) {
    const defaults = {
      'qa': {
        recommendation: 'hold_for_review',
        confidence: 0.3,
        reasoning: 'QA agent unavailable - defaulting to safety'
      },
      'mar': {
        recommendation: 'proceed',
        confidence: 0.4,
        reasoning: 'MAR agent unavailable - production continuity focus'
      },
      'cmo': {
        recommendation: 'evaluate_cost',
        confidence: 0.4,
        reasoning: 'CMO agent unavailable - cost consideration needed'
      }
    };
    
    return defaults[stakeholder] || {
      recommendation: 'abstain',
      confidence: 0.2,
      reasoning: 'Agent unavailable - no input'
    };
  }

  /**
   * Calculate dynamic expertise based on recent performance
   */
  async calculateDynamicExpertise(decision) {
    // Simplified implementation - in production, this would analyze historical accuracy
    const baseExpertise = this.getExpertiseWeights(decision);
    
    // Adjust based on recent decision accuracy (simplified)
    const adjustedExpertise = {};
    for (const [agent, baseScore] of Object.entries(baseExpertise)) {
      adjustedExpertise[agent] = baseScore * (0.8 + Math.random() * 0.4); // Mock adjustment
    }
    
    return adjustedExpertise;
  }

  /**
   * Get expertise weights for decision type
   */
  getExpertiseWeights(decision) {
    return this.expertiseWeights[decision.type] || {};
  }

  /**
   * Find compromise proposal generation
   */
  async findCompromise(decision) {
    // Simplified compromise logic
    const votes = Array.from(decision.votes.values());
    const commonElements = this.findCommonElements(votes);
    
    if (commonElements.length > 0) {
      return {
        decision: `compromise_${commonElements[0]}`,
        confidence: 0.6,
        resolutionMethod: 'compromise',
        commonElements
      };
    }
    
    return null;
  }

  /**
   * Find common elements in stakeholder reasoning
   */
  findCommonElements(votes) {
    // Simplified - would use NLP in production
    const keywords = [];
    votes.forEach(vote => {
      const words = (vote.reasoning || '').toLowerCase().split(' ');
      keywords.push(...words.filter(w => w.length > 3));
    });
    
    const frequency = {};
    keywords.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .filter(([word, count]) => count > 1)
      .map(([word]) => word)
      .slice(0, 3);
  }

  /**
   * Update consensus engine metrics
   */
  updateMetrics(decision) {
    this.metrics.decisionsProcessed++;
    
    if (decision.result && decision.result.decision !== 'no_consensus') {
      this.metrics.consensusReached++;
    }
    
    this.metrics.averageDecisionTime = 
      (this.metrics.averageDecisionTime + decision.duration) / 2;
  }

  /**
   * Get consensus engine metrics and performance data
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeDecisions: this.decisions.size,
      decisionHistory: this.decisionHistory.length,
      successRate: this.metrics.decisionsProcessed > 0 
        ? (this.metrics.consensusReached + this.metrics.conflictsResolved) / this.metrics.decisionsProcessed 
        : 0,
      avgDecisionTime: this.metrics.averageDecisionTime
    };
  }
}

export default ConsensusEngine;