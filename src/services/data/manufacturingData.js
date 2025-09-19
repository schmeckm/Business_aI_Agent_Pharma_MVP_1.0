// src/data/manufacturingData.js - Complete Realistic Manufacturing Dataset

// ===========================================
// REALISTIC PHARMACEUTICAL MANUFACTURING DATA  
// ===========================================

export const realisticManufacturingData = {
  // Current Production Orders with Real Scenarios
  orders: [
    {
      id: "PO-2025-001",
      productName: "Paracetamol 500mg Tablets",
      batchSize: 250000,
      plannedStartDate: "2025-01-22",
      priority: "high",
      targetMarket: ["Germany", "Netherlands", "Belgium"],
      status: "awaiting_material_release",
      qualityRequirements: {
        contentUniformity: "±5%",
        dissolution: ">85% in 30min",
        hardness: "80-120N"
      },
      regulatoryStatus: "approved_eu_gmp",
      estimatedDuration: "72 hours",
      costTarget: "€0.02"
    },
    {
      id: "PO-2025-002", 
      productName: "Ibuprofen 400mg Tablets",
      batchSize: 150000,
      plannedStartDate: "2025-01-25",
      priority: "critical",
      targetMarket: ["USA", "Canada"],
      status: "quality_hold",
      issueDescription: "API supplier change requires additional qualification",
      qualityRequirements: {
        contentUniformity: "±7.5%",
        dissolution: ">80% in 45min",
        hardness: "60-100N"
      },
      regulatoryStatus: "fda_review_pending",
      estimatedDuration: "96 hours",
      costTarget: "€0.035"
    },
    {
      id: "PO-2025-003",
      productName: "Amoxicillin 250mg Capsules", 
      batchSize: 500000,
      plannedStartDate: "2025-01-28",
      priority: "normal",
      targetMarket: ["UK", "Ireland"],
      status: "scheduling",
      qualityRequirements: {
        contentUniformity: "±10%",
        dissolution: ">75% in 30min",
        microbial: "<10 CFU/g"
      },
      regulatoryStatus: "mhra_approved",
      estimatedDuration: "48 hours", 
      costTarget: "€0.05"
    }
  ],

  // Real Material Inventory with Quality Data
  inventory: [
    {
      materialId: "API-PARA-001",
      materialName: "Paracetamol API",
      supplier: "Granules India Ltd",
      batchNumber: "GTX-2024-4521",
      quantity: 2500,
      unitOfMeasure: "kg",
      expiryDate: "2026-03-15",
      qualityStatus: "released",
      qualityData: {
        purity: 99.7,
        moistureContent: 0.3,
        particleSize: "d50: 45µm",
        heavyMetals: "<10ppm",
        testDate: "2024-12-15",
        analyst: "Sarah Johnson"
      },
      storageLocation: "Warehouse-A-Zone-2",
      costPerKg: 28.50,
      reorderLevel: 500,
      leadTime: "14 days"
    },
    {
      materialId: "API-IBU-002", 
      materialName: "Ibuprofen API",
      supplier: "SI Group Inc",
      batchNumber: "SIG-2024-8832",
      quantity: 1200,
      unitOfMeasure: "kg", 
      expiryDate: "2025-11-20",
      qualityStatus: "quarantine",
      qualityData: {
        purity: 98.9,
        moistureContent: 0.8,
        particleSize: "d50: 52µm", 
        impurityProfile: "within_limits",
        testDate: "2025-01-18",
        analyst: "Dr. Michael Chen",
        deviationRef: "DEV-2025-007"
      },
      storageLocation: "Warehouse-B-Zone-1",
      costPerKg: 45.20,
      reorderLevel: 300,
      leadTime: "21 days",
      qualityIssue: "Slightly elevated moisture - investigating root cause"
    },
    {
      materialId: "EXC-LAC-003",
      materialName: "Lactose Monohydrate 200M",
      supplier: "DFE Pharma",
      batchNumber: "DFE-24-L9876", 
      quantity: 5000,
      unitOfMeasure: "kg",
      expiryDate: "2027-08-10",
      qualityStatus: "released",
      qualityData: {
        flowability: "excellent",
        moistureContent: 4.8,
        particleSize: "d50: 65µm",
        microbial: "<100 CFU/g",
        testDate: "2024-11-22",
        analyst: "Emma Wilson"
      },
      storageLocation: "Warehouse-A-Zone-5", 
      costPerKg: 3.20,
      reorderLevel: 1000,
      leadTime: "7 days"
    }
  ],

  // Equipment with Real Performance Data
  equipment: [
    {
      equipmentId: "MIX-001",
      name: "High Shear Mixer Granulator",
      manufacturer: "Collette",
      model: "Gral 75",
      location: "Production Line A",
      capacity: "75L working volume",
      status: "operational",
      currentEfficiency: 94.2,
      plannedMaintenance: "2025-02-15",
      lastCalibration: "2024-12-10",
      performanceMetrics: {
        avgBatchTime: 18.5,
        qualityConsistency: 97.8,
        energyConsumption: 12.4,
        uptimeLastMonth: 98.1
      },
      maintenanceHistory: [
        {
          date: "2024-11-15",
          type: "preventive",
          description: "Replaced impeller seals, calibrated sensors",
          downtime: "4 hours",
          cost: 1250
        }
      ]
    },
    {
      equipmentId: "TAB-002",
      name: "Rotary Tablet Press", 
      manufacturer: "Fette Compacting",
      model: "P2100",
      location: "Production Line A",
      capacity: "400,000 tablets/hour",
      status: "maintenance_required",
      currentEfficiency: 87.3,
      plannedMaintenance: "2025-01-20",
      lastCalibration: "2024-12-18", 
      performanceMetrics: {
        avgTabletWeight: 624.8,
        hardnessVariation: 3.2,
        rejectionRate: 0.8,
        uptimeLastMonth: 92.4
      },
      maintenanceHistory: [
        {
          date: "2025-01-10", 
          type: "corrective",
          description: "Punch sticking issues - requires cleaning cycle",
          downtime: "6 hours",
          cost: 850
        }
      ],
      currentIssue: "Punch wear detected - replacement scheduled"
    },
    {
      equipmentId: "COT-003",
      name: "Perforated Pan Coater",
      manufacturer: "O'Hara Technologies", 
      model: "Labcoat II",
      location: "Production Line B",
      capacity: "50kg batch size",
      status: "operational",
      currentEfficiency: 91.7,
      plannedMaintenance: "2025-03-05",
      lastCalibration: "2024-12-28",
      performanceMetrics: {
        coatingUniformity: 94.5,
        processTime: 145,
        solventEfficiency: 89.2,
        uptimeLastMonth: 96.8
      }
    }
  ],

  // Real Quality Control Data
  qualityControl: [
    {
      testId: "QC-2025-0089",
      productName: "Paracetamol 500mg Tablets",
      batchNumber: "PAR-500-250124",
      testDate: "2025-01-19",
      analyst: "Dr. Sarah Martinez",
      testResults: {
        appearance: "white, round, biconvex tablets - PASS",
        averageWeight: 625.4,
        weightVariation: 1.8,
        hardness: 95.2,
        friability: 0.15,
        disintegration: 8.5,
        dissolution: 89.7,
        assay: 99.2,
        contentUniformity: 2.1
      },
      overallResult: "PASS",
      releaseDate: "2025-01-20",
      releaseBy: "John Smith, QP",
      shelfLife: "36 months",
      storageConditions: "Store below 25°C, protect from moisture"
    },
    {
      testId: "QC-2025-0087",
      productName: "Ibuprofen 400mg Tablets", 
      batchNumber: "IBU-400-180125",
      testDate: "2025-01-18",
      analyst: "Lisa Thompson",
      testResults: {
        appearance: "white, oval, film-coated tablets - PASS",
        averageWeight: 520.8,
        weightVariation: 2.3,
        hardness: 78.1,
        friability: 0.22,
        disintegration: 12.8,
        dissolution: 91.4,
        assay: 101.3,
        contentUniformity: 3.7