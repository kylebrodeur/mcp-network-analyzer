/**
 * Database query tool - Get information about analyses, discoveries, and their relationships
 */

import { DatabaseService } from "../lib/database.js";

export interface ListAnalysesOptions {
  limit?: number;
  status?: 'processing' | 'complete' | 'failed';
}

export interface ListDiscoveriesOptions {
  limit?: number;
  analysisId?: string;
  status?: 'processing' | 'complete' | 'failed';
}

export interface QueryResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * List all analyses with optional filtering
 */
export async function listAnalyses(options: ListAnalysesOptions = {}): Promise<QueryResult> {
  try {
    const db = DatabaseService.getInstance();
    const analyses = db.listAnalyses();
    
    let filtered = analyses;
    
    // Apply status filter
    if (options.status) {
      filtered = filtered.filter(a => a.status === options.status);
    }
    
    // Apply limit
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }
    
    return {
      success: true,
      data: {
        total: analyses.length,
        filtered: filtered.length,
        analyses: filtered.map(a => ({
          id: a.id,
          captureId: a.captureId,
          status: a.status,
          timestamp: a.timestamp,
          totalRequests: a.totalRequests,
          totalResponses: a.totalResponses,
          apiEndpoints: a.apiEndpoints,
          staticAssets: a.staticAssets,
          errorCount: a.errorCount
        }))
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * List all discoveries with optional filtering
 */
export async function listDiscoveries(options: ListDiscoveriesOptions = {}): Promise<QueryResult> {
  try {
    const db = DatabaseService.getInstance();
    const discoveries = db.listDiscoveries();
    
    let filtered = discoveries;
    
    // Apply analysis ID filter
    if (options.analysisId) {
      filtered = filtered.filter(d => d.analysisId === options.analysisId);
    }
    
    // Apply status filter
    if (options.status) {
      filtered = filtered.filter(d => d.status === options.status);
    }
    
    // Apply limit
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }
    
    return {
      success: true,
      data: {
        total: discoveries.length,
        filtered: filtered.length,
        discoveries: filtered.map(d => ({
          id: d.id,
          analysisId: d.analysisId,
          status: d.status,
          timestamp: d.timestamp,
          patternsFound: d.patternsFound,
          paginationDetected: d.paginationDetected,
          rateLimitingDetected: d.rateLimitingDetected
        }))
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<QueryResult> {
  try {
    const db = DatabaseService.getInstance();
    const stats = db.getStats();
    
    return {
      success: true,
      data: stats
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Get analysis by ID
 */
export async function getAnalysisById(id: string): Promise<QueryResult> {
  try {
    const db = DatabaseService.getInstance();
    const analysis = db.getAnalysis(id);
    
    if (!analysis) {
      return {
        success: false,
        error: `Analysis with ID ${id} not found`
      };
    }
    
    return {
      success: true,
      data: analysis
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Get discovery by ID
 */
export async function getDiscoveryById(id: string): Promise<QueryResult> {
  try {
    const db = DatabaseService.getInstance();
    const discovery = db.getDiscovery(id);
    
    if (!discovery) {
      return {
        success: false,
        error: `Discovery with ID ${id} not found`
      };
    }
    
    return {
      success: true,
      data: discovery
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}