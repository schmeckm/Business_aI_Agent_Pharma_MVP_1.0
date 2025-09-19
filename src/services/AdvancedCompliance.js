// src/services/AdvancedCompliance.js - Phase 3D Advanced Pharmaceutical Compliance
import logger from "./logger.js";
import { v4 as uuidv4 } from "uuid";

/**
 * AdvancedCompliance - Comprehensive pharmaceutical compliance automation
 * Covers GMP, GDP, GCP, and other regulatory requirements with automated audit trails
 */
export class AdvancedCompliance {
  constructor({ knowledgeGraph, eventBus, llm }) {
    this.knowledgeGraph = knowledgeGraph;
    this.eventBus = eventBus;
    this.llm = llm;
    
    // Regulatory frameworks and their rules
    this.regulatoryFrameworks = new Map();
    this.complianceRules = new Map();
    this.auditTrails = new Map();
    
    // Compliance monitoring
    this.activeMonitors = new Map();
    this.complianceAlerts = [];
    this.riskAssessments = new Map();
    
    // Document management
    this.documentTemplates = new Map();
    this.generatedDocuments = new Map();
    
    this.metrics = {
      complianceChecks: 0,
      violationsDetected: 0,
      violationsPrevented: 0,
      documentsGenerated: 0,
      auditTrailsCreated: 0,
      complianceScore: 100
    };
    
    this.initializeRegulatoryFrameworks();
    this.initializeComplianceRules();
    this.initializeDocumentTemplates();
    
    logger.info('AdvancedCompliance engine initialized');
  }

  /**
   * Main compliance validation for decisions and actions
   */
  async validateCompliance(action, context, frameworks = ['GMP', 'GDP']) {
    const validationId = uuidv4();
    
    try {
      logger.info('Starting compliance validation', { validationId, action: action.type, frameworks });
      
      // Create audit trail entry
      const auditTrail = this.createAuditTrailEntry(validationId, action, context);
      
      // Check against each regulatory framework
      const frameworkResults = await Promise.all(
        frameworks.map(framework => this.validateAgainstFramework(action, context, framework))
      );
      
      // Aggregate results
      const aggregatedResult = this.aggregateComplianceResults(frameworkResults);
      
      // Risk assessment
      const riskAssessment = await this.performRiskAssessment(action, context, aggregatedResult);
      
      // Generate recommendations if non-compliant
      let recommendations = [];
      if (!aggregatedResult.compliant) {
        recommendations = await this.generateComplianceRecommendations(action, aggregatedResult);
      }
      
      // Update audit trail
      auditTrail.result = aggregatedResult;
      auditTrail.riskAssessment = riskAssessment;
      auditTrail.recommendations = recommendations;
      auditTrail.completedAt = Date.now();
      
      this.auditTrails.set(validationId, auditTrail);
      this.metrics.complianceChecks++;
      
      if (!aggregatedResult.compliant) {
        this.metrics.violationsDetected++;
        this.handleComplianceViolation(validationId, aggregatedResult);
      }
      
      return {
        validationId,
        compliant: aggregatedResult.compliant,
        score: aggregatedResult.score,
        violations: aggregatedResult.violations,
        recommendations,
        riskLevel: riskAssessment.level,
        auditTrailId: validationId
      };
      
    } catch (error) {
      logger.error('Compliance validation failed', { validationId, error: error.message });
      throw error;
    }
  }

  /**
   * Validate action against specific regulatory framework
   */
  async validateAgainstFramework(action, context, frameworkName) {
    const framework = this.regulatoryFrameworks.get(frameworkName);
    if (!framework) {
      throw new Error(`Unknown regulatory framework: ${frameworkName}`);
    }
    
    const violations = [];
    const warnings = [];
    let score = 100;
    
    // Check each applicable rule
    for (const ruleCategory of framework.ruleCategories) {
      const categoryRules = this.complianceRules.get(`${frameworkName}_${ruleCategory}`);
      if (!categoryRules) continue;
      
      for (const rule of categoryRules) {
        if (this.isRuleApplicable(rule, action, context)) {
          const ruleResult = await this.evaluateRule(rule, action, context);
          
          if (ruleResult.violated) {
            violations.push({
              rule: rule.id,
              description: rule.description,
              severity: rule.severity,
              details: ruleResult.details
            });
            
            score -= rule.penaltyPoints || 10;
          }
          
          if (ruleResult.warning) {
            warnings.push({
              rule: rule.id,
              description: rule.description,
              warning: ruleResult.warning
            });
            
            score -= 2;
          }
        }
      }
    }
    
    return {
      framework: frameworkName,
      compliant: violations.length === 0,
      score: Math.max(0, score),
      violations,
      warnings,
      evaluatedAt: Date.now()
    };
  }

  /**
   * Advanced document generation with compliance integration
   */
  async generateComplianceDocument(documentType, context, templateOverrides = {}) {
    const documentId = uuidv4();
    
    try {
      logger.info('Generating compliance document', { documentId, documentType });
      
      // Get document template
      const template = this.documentTemplates.get(documentType);
      if (!template) {
        throw new Error(`Unknown document template: ${documentType}`);
      }
      
      // Apply template overrides
      const finalTemplate = { ...template, ...templateOverrides };
      
      // Generate document content
      const documentContent = await this.generateDocumentContent(finalTemplate, context);
      
      // Validate document compliance
      const complianceValidation = await this.validateDocumentCompliance(
        documentContent, 
        finalTemplate.requiredFrameworks || ['GMP']
      );
      
      // Create document record
      const document = {
        id: documentId,
        type: documentType,
        template: finalTemplate.name,
        content: documentContent,
        complianceValidation,
        metadata: {
          generatedAt: Date.now(),
          generatedBy: 'AdvancedCompliance',
          version: finalTemplate.version,
          context: context.summary || 'Automated generation'
        },
        signatures: [],
        approvals: []
      };
      
      this.generatedDocuments.set(documentId, document);
      this.metrics.documentsGenerated++;
      
      // Create audit trail for document generation
      const auditTrail = this.createDocumentAuditTrail(document);
      this.auditTrails.set(`doc_${documentId}`, auditTrail);
      
      return {
        documentId,
        document,
        complianceScore: complianceValidation.score,
        requiresApproval: finalTemplate.requiresApproval,
        nextSteps: this.getDocumentNextSteps(document)
      };
      
    } catch (error) {
      logger.error('Document generation failed', { documentId, documentType, error: error.message });
      throw error;
    }
  }

  /**
   * Continuous compliance monitoring
   */
  async startComplianceMonitoring(scope, frameworks = ['GMP'], monitoringConfig = {}) {
    const monitorId = uuidv4();
    
    const monitor = {
      id: monitorId,
      scope,
      frameworks,
      config: {
        interval: monitoringConfig.interval || 3600000, // 1 hour default
        alertThreshold: monitoringConfig.alertThreshold || 0.8,
        autoRemediation: monitoringConfig.autoRemediation || false,
        ...monitoringConfig
      },
      status: 'active',
      startedAt: Date.now(),
      lastCheck: null,
      violations: [],
      trends: []
    };
    
    this.activeMonitors.set(monitorId, monitor);
    
    // Start monitoring loop
    const monitoringInterval = setInterval(async () => {
      await this.performMonitoringCheck(monitorId);
    }, monitor.config.interval);
    
    monitor.intervalId = monitoringInterval;
    
    logger.info('Compliance monitoring started', { monitorId, scope, frameworks });
    
    return monitorId;
  }

  /**
   * Perform periodic monitoring check
   */
  async performMonitoringCheck(monitorId) {
    const monitor = this.activeMonitors.get(monitorId);
    if (!monitor || monitor.status !== 'active') return;
    
    try {
      // Get current state for monitored scope
      const currentState = await this.getCurrentComplianceState(monitor.scope);
      
      // Check compliance for each framework
      const complianceResults = await Promise.all(
        monitor.frameworks.map(framework => 
          this.assessCurrentCompliance(currentState, framework)
        )
      );
      
      // Analyze results
      const overallCompliance = this.aggregateComplianceResults(complianceResults);
      const alerts = this.detectComplianceAlerts(overallCompliance, monitor.config.alertThreshold);
      
      // Update monitor
      monitor.lastCheck = Date.now();
      monitor.lastResult = overallCompliance;
      
      // Handle alerts
      if (alerts.length > 0) {
        await this.handleMonitoringAlerts(monitorId, alerts);
        
        if (monitor.config.autoRemediation) {
          await this.attemptAutoRemediation(monitorId, alerts);
        }
      }
      
      // Update trends
      this.updateComplianceTrends(monitor, overallCompliance);
      
    } catch (error) {
      logger.error('Monitoring check failed', { monitorId, error: error.message });
      monitor.lastError = error.message;
    }
  }

  /**
   * Generate comprehensive audit trail
   */
  createAuditTrailEntry(id, action, context) {
    const auditTrail = {
      id,
      type: 'compliance_validation',
      action: {
        type: action.type,
        description: action.description || 'No description provided',
        initiatedBy: action.initiatedBy || 'system',
        timestamp: action.timestamp || Date.now()
      },
      context: {
        workflowId: context.workflowId,
        batchId: context.batchId,
        productId: context.productId,
        facility: context.facility,
        department: context.department,
        personnel: context.personnel || [],
        equipment: context.equipment || [],
        materials: context.materials || []
      },
      createdAt: Date.now(),
      completedAt: null,
      result: null,
      riskAssessment: null,
      recommendations: [],
      digitalSignatures: [],
      reviewHistory: []
    };
    
    this.metrics.auditTrailsCreated++;
    
    return auditTrail;
  }

  /**
   * Initialize regulatory frameworks
   */
  initializeRegulatoryFrameworks() {
    // Good Manufacturing Practice (GMP)
    this.regulatoryFrameworks.set('GMP', {
      name: 'Good Manufacturing Practice',
      region: 'global',
      version: '2023',
      ruleCategories: [
        'personnel',
        'premises_equipment',
        'documentation',
        'production',
        'quality_control',
        'complaints_recalls',
        'self_inspection'
      ],
      criticalRequirements: [
        'batch_record_integrity',
        'quality_control_testing',
        'change_control',
        'deviation_management',
        'qualified_person_release'
      ]
    });

    // Good Distribution Practice (GDP)
    this.regulatoryFrameworks.set('GDP', {
      name: 'Good Distribution Practice',
      region: 'global',
      version: '2023',
      ruleCategories: [
        'quality_management',
        'personnel',
        'premises_equipment',
        'documentation',
        'operations',
        'complaints_returns',
        'outsourced_activities',
        'self_inspections',
        'transportation',
        'specific_provisions'
      ],
      criticalRequirements: [
        'temperature_control',
        'product_integrity',
        'supply_chain_security',
        'serialization_compliance',
        'distribution_records'
      ]
    });

    // Good Clinical Practice (GCP)
    this.regulatoryFrameworks.set('GCP', {
      name: 'Good Clinical Practice',
      region: 'global',
      version: '2023',
      ruleCategories: [
        'protocol_development',
        'investigator_responsibilities',
        'sponsor_responsibilities',
        'clinical_trial_monitoring',
        'adverse_event_reporting',
        'data_integrity',
        'informed_consent'
      ],
      criticalRequirements: [
        'patient_safety',
        'data_integrity',
        'informed_consent',
        'protocol_compliance',
        'investigator_qualifications'
      ]
    });

    // FDA 21 CFR Part 11 (Electronic Records)
    this.regulatoryFrameworks.set('CFR21_PART11', {
      name: 'FDA 21 CFR Part 11',
      region: 'USA',
      version: '2023',
      ruleCategories: [
        'electronic_records',
        'electronic_signatures',
        'controls',
        'signature_manifestations',
        'controls_closed_systems',
        'controls_open_systems'
      ],
      criticalRequirements: [
        'data_integrity',
        'audit_trails',
        'electronic_signatures',
        'access_controls',
        'system_validation'
      ]
    });
  }

  /**
   * Initialize detailed compliance rules
   */
  initializeComplianceRules() {
    // GMP Personnel Rules
    this.complianceRules.set('GMP_personnel', [
      {
        id: 'GMP_PERS_001',
        description: 'Personnel must be qualified for their assigned tasks',
        severity: 'critical',
        penaltyPoints: 20,
        evaluation: (action, context) => {
          if (context.personnel && context.personnel.length > 0) {
            return context.personnel.every(person => 
              person.qualifications && person.qualifications.length > 0
            );
          }
          return true;
        }
      },
      {
        id: 'GMP_PERS_002',
        description: 'Personnel must receive appropriate training',
        severity: 'major',
        penaltyPoints: 15,
        evaluation: (action, context) => {
          if (context.personnel && context.personnel.length > 0) {
            return context.personnel.every(person => 
              person.training && person.training.current === true
            );
          }
          return true;
        }
      },
      {
        id: 'GMP_PERS_003',
        description: 'Personnel hygiene requirements must be met',
        severity: 'major',
        penaltyPoints: 10,
        evaluation: (action, context) => {
          return !context.hygieneViolations || context.hygieneViolations.length === 0;
        }
      }
    ]);

    // GMP Documentation Rules
    this.complianceRules.set('GMP_documentation', [
      {
        id: 'GMP_DOC_001',
        description: 'All critical operations must be documented',
        severity: 'critical',
        penaltyPoints: 25,
        evaluation: (action, context) => {
          const criticalActions = ['production', 'quality_control', 'release'];
          if (criticalActions.includes(action.type)) {
            return context.documentation && context.documentation.length > 0;
          }
          return true;
        }
      },
      {
        id: 'GMP_DOC_002',
        description: 'Batch records must be complete and accurate',
        severity: 'critical',
        penaltyPoints: 30,
        evaluation: (action, context) => {
          if (context.batchId) {
            return context.batchRecord && 
                   context.batchRecord.complete === true && 
                   context.batchRecord.signatures && 
                   context.batchRecord.signatures.length > 0;
          }
          return true;
        }
      },
      {
        id: 'GMP_DOC_003',
        description: 'Changes must follow change control procedures',
        severity: 'major',
        penaltyPoints: 20,
        evaluation: (action, context) => {
          if (action.type === 'change') {
            return context.changeControl && 
                   context.changeControl.approved === true &&
                   context.changeControl.riskAssessment === true;
          }
          return true;
        }
      }
    ]);

    // GMP Production Rules
    this.complianceRules.set('GMP_production', [
      {
        id: 'GMP_PROD_001',
        description: 'Production must follow approved procedures',
        severity: 'critical',
        penaltyPoints: 25,
        evaluation: (action, context) => {
          if (action.type === 'production') {
            return context.approvedProcedure === true;
          }
          return true;
        }
      },
      {
        id: 'GMP_PROD_002',
        description: 'Equipment must be qualified and calibrated',
        severity: 'critical',
        penaltyPoints: 20,
        evaluation: (action, context) => {
          if (context.equipment && context.equipment.length > 0) {
            return context.equipment.every(eq => 
              eq.qualified === true && eq.calibrationCurrent === true
            );
          }
          return true;
        }
      }
    ]);

    // GDP Transportation Rules
    this.complianceRules.set('GDP_transportation', [
      {
        id: 'GDP_TRANS_001',
        description: 'Temperature-sensitive products must maintain cold chain',
        severity: 'critical',
        penaltyPoints: 30,
        evaluation: (action, context) => {
          if (action.type === 'shipment' && context.temperatureSensitive === true) {
            return context.coldChain && context.coldChain.maintained === true;
          }
          return true;
        }
      },
      {
        id: 'GDP_TRANS_002',
        description: 'Transportation vehicles must be qualified',
        severity: 'major',
        penaltyPoints: 15,
        evaluation: (action, context) => {
          if (action.type === 'shipment') {
            return context.vehicle && context.vehicle.qualified === true;
          }
          return true;
        }
      }
    ]);

    // CFR 21 Part 11 Electronic Records Rules
    this.complianceRules.set('CFR21_PART11_electronic_records', [
      {
        id: 'CFR21_ER_001',
        description: 'Electronic records must have audit trails',
        severity: 'critical',
        penaltyPoints: 25,
        evaluation: (action, context) => {
          if (context.electronicRecord === true) {
            return context.auditTrail === true;
          }
          return true;
        }
      },
      {
        id: 'CFR21_ER_002',
        description: 'Electronic signatures must be validated',
        severity: 'critical',
        penaltyPoints: 20,
        evaluation: (action, context) => {
          if (context.electronicSignature === true) {
            return context.signatureValidated === true;
          }
          return true;
        }
      }
    ]);
  }

  /**
   * Initialize document templates for automated generation
   */
  initializeDocumentTemplates() {
    // Deviation Report Template
    this.documentTemplates.set('deviation_report', {
      name: 'Deviation Report',
      version: '2.1',
      requiredFrameworks: ['GMP'],
      requiresApproval: true,
      sections: [
        'deviation_details',
        'immediate_actions',
        'investigation',
        'root_cause_analysis',
        'corrective_actions',
        'preventive_actions',
        'effectiveness_check'
      ],
      requiredFields: [
        'deviation_number',
        'discovery_date',
        'reporter',
        'description',
        'impact_assessment',
        'investigation_findings'
      ],
      approvers: ['qa_manager', 'qualified_person']
    });

    // Change Control Record Template
    this.documentTemplates.set('change_control', {
      name: 'Change Control Record',
      version: '3.0',
      requiredFrameworks: ['GMP', 'GDP'],
      requiresApproval: true,
      sections: [
        'change_description',
        'rationale',
        'risk_assessment',
        'implementation_plan',
        'validation_requirements',
        'training_requirements',
        'effectiveness_review'
      ],
      requiredFields: [
        'change_number',
        'requestor',
        'change_type',
        'description',
        'risk_level',
        'implementation_date'
      ],
      approvers: ['department_head', 'qa_manager', 'qualified_person']
    });

    // Batch Release Certificate Template
    this.documentTemplates.set('batch_release_certificate', {
      name: 'Batch Release Certificate',
      version: '1.5',
      requiredFrameworks: ['GMP'],
      requiresApproval: true,
      sections: [
        'batch_information',
        'manufacturing_summary',
        'quality_control_results',
        'specifications_compliance',
        'stability_data',
        'release_decision'
      ],
      requiredFields: [
        'batch_number',
        'product_name',
        'manufacturing_date',
        'expiry_date',
        'qc_results',
        'release_decision'
      ],
      approvers: ['qualified_person']
    });

    // CAPA (Corrective and Preventive Action) Template
    this.documentTemplates.set('capa_plan', {
      name: 'CAPA Plan',
      version: '2.2',
      requiredFrameworks: ['GMP', 'GCP'],
      requiresApproval: true,
      sections: [
        'problem_statement',
        'immediate_containment',
        'root_cause_investigation',
        'corrective_actions',
        'preventive_actions',
        'effectiveness_verification',
        'closure'
      ],
      requiredFields: [
        'capa_number',
        'initiator',
        'problem_description',
        'root_cause',
        'corrective_actions',
        'target_completion_date'
      ],
      approvers: ['qa_manager', 'department_head']
    });

    // Audit Report Template
    this.documentTemplates.set('audit_report', {
      name: 'Internal Audit Report',
      version: '1.8',
      requiredFrameworks: ['GMP', 'GDP', 'GCP'],
      requiresApproval: true,
      sections: [
        'audit_scope',
        'audit_team',
        'executive_summary',
        'findings',
        'observations',
        'recommendations',
        'follow_up_actions'
      ],
      requiredFields: [
        'audit_number',
        'audit_date',
        'audited_area',
        'lead_auditor',
        'findings_summary',
        'recommendations'
      ],
      approvers: ['qa_director', 'site_head']
    });
  }

  /**
   * Evaluate individual compliance rule
   */
  async evaluateRule(rule, action, context) {
    try {
      let violated = false;
      let warning = null;
      let details = null;

      if (typeof rule.evaluation === 'function') {
        const result = rule.evaluation(action, context);
        violated = !result;
      } else if (rule.llmEvaluation && this.llm) {
        // Use LLM for complex rule evaluation
        const llmResult = await this.evaluateRuleWithLLM(rule, action, context);
        violated = llmResult.violated;
        warning = llmResult.warning;
        details = llmResult.details;
      }

      return { violated, warning, details };

    } catch (error) {
      logger.error('Rule evaluation failed', { ruleId: rule.id, error: error.message });
      return { violated: false, warning: 'Rule evaluation failed', details: error.message };
    }
  }

  /**
   * Generate document content using templates and context
   */
  async generateDocumentContent(template, context) {
    const content = {
      header: {
        title: template.name,
        version: template.version,
        generatedAt: new Date().toISOString(),
        documentId: uuidv4()
      },
      sections: {}
    };

    // Generate each section
    for (const sectionName of template.sections) {
      content.sections[sectionName] = await this.generateDocumentSection(
        sectionName, 
        template, 
        context
      );
    }

    // Ensure all required fields are present
    const missingFields = template.requiredFields.filter(field => 
      !this.hasRequiredField(content, field, context)
    );

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    return content;
  }

  /**
   * Generate individual document section
   */
  async generateDocumentSection(sectionName, template, context) {
    const section = {
      name: sectionName,
      generatedAt: Date.now(),
      content: {}
    };

    // Use LLM to generate section content if available
    if (this.llm) {
      const prompt = this.buildSectionPrompt(sectionName, template, context);
      const generatedContent = await this.llm.complete(prompt);
      section.content.generated = generatedContent.trim();
    }

    // Add structured data based on section type
    switch (sectionName) {
      case 'deviation_details':
        section.content.structured = {
          deviationNumber: context.deviationNumber || 'AUTO-GENERATED',
          discoveryDate: context.discoveryDate || new Date().toISOString(),
          reporter: context.reporter || 'System',
          description: context.description || 'Automated detection',
          severity: context.severity || 'medium'
        };
        break;

      case 'risk_assessment':
        section.content.structured = {
          riskLevel: context.riskLevel || 'medium',
          impactAssessment: context.impactAssessment || 'To be determined',
          probabilityScore: context.probabilityScore || 'medium',
          overallRisk: context.overallRisk || 'medium'
        };
        break;

      case 'batch_information':
        section.content.structured = {
          batchNumber: context.batchId || context.batchNumber,
          productName: context.productName || context.productId,
          manufacturingDate: context.manufacturingDate,
          quantity: context.quantity,
          specifications: context.specifications || []
        };
        break;
    }

    return section;
  }

  /**
   * Utility methods for compliance management
   */
  aggregateComplianceResults(frameworkResults) {
    const totalScore = frameworkResults.reduce((sum, result) => sum + result.score, 0);
    const averageScore = frameworkResults.length > 0 ? totalScore / frameworkResults.length : 100;
    
    const allViolations = frameworkResults.flatMap(result => result.violations);
    const allWarnings = frameworkResults.flatMap(result => result.warnings);
    
    return {
      compliant: allViolations.length === 0,
      score: averageScore,
      violations: allViolations,
      warnings: allWarnings,
      frameworkResults,
      evaluatedAt: Date.now()
    };
  }

  isRuleApplicable(rule, action, context) {
    // Basic applicability check - can be extended with more sophisticated logic
    if (rule.applicableActions && !rule.applicableActions.includes(action.type)) {
      return false;
    }
    
    if (rule.applicableContexts) {
      return rule.applicableContexts.some(contextType => 
        context[contextType] !== undefined && context[contextType] !== null
      );
    }
    
    return true;
  }

  async performRiskAssessment(action, context, complianceResult) {
    const riskFactors = {
      complianceViolations: complianceResult.violations.length,
      criticalViolations: complianceResult.violations.filter(v => v.severity === 'critical').length,
      actionCriticality: this.assessActionCriticality(action),
      contextComplexity: this.assessContextComplexity(context)
    };

    const riskScore = this.calculateRiskScore(riskFactors);
    
    return {
      level: this.categorizeRiskLevel(riskScore),
      score: riskScore,
      factors: riskFactors,
      mitigationRequired: riskScore > 0.7,
      assessedAt: Date.now()
    };
  }

  calculateRiskScore(factors) {
    let score = 0;
    
    // Violation-based risk
    score += factors.complianceViolations * 0.15;
    score += factors.criticalViolations * 0.3;
    
    // Action criticality
    score += factors.actionCriticality * 0.25;
    
    // Context complexity
    score += factors.contextComplexity * 0.1;
    
    return Math.min(1.0, score);
  }

  categorizeRiskLevel(score) {
    if (score >= 0.8) return 'critical';
    if (score >= 0.6) return 'high';
    if (score >= 0.4) return 'medium';
    if (score >= 0.2) return 'low';
    return 'minimal';
  }

  /**
   * Get comprehensive compliance metrics and system status
   */
  getMetrics() {
    const activeMonitoringCount = Array.from(this.activeMonitors.values())
      .filter(monitor => monitor.status === 'active').length;
    
    const recentViolations = this.complianceAlerts
      .filter(alert => Date.now() - alert.timestamp < 86400000) // Last 24 hours
      .length;

    return {
      ...this.metrics,
      activeMonitors: activeMonitoringCount,
      totalMonitors: this.activeMonitors.size,
      auditTrails: this.auditTrails.size,
      generatedDocuments: this.generatedDocuments.size,
      recentViolations,
      regulatoryFrameworks: this.regulatoryFrameworks.size,
      complianceRules: Array.from(this.complianceRules.values())
        .reduce((total, rules) => total + rules.length, 0),
      averageComplianceScore: this.calculateAverageComplianceScore()
    };
  }

  calculateAverageComplianceScore() {
    const recentAudits = Array.from(this.auditTrails.values())
      .filter(audit => audit.result && audit.result.score)
      .slice(-50); // Last 50 audits

    if (recentAudits.length === 0) return this.metrics.complianceScore;

    const totalScore = recentAudits.reduce((sum, audit) => sum + audit.result.score, 0);
    return totalScore / recentAudits.length;
  }
}

export default AdvancedCompliance;