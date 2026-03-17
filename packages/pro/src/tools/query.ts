/**
 * Database query tool - Get information about analyses, discoveries, and their relationships
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DatabaseService } from '@mcp-network-analyzer/core';

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
  data?: unknown;
  error?: string;
}

export async function listAnalyses(options: ListAnalysesOptions = {}): Promise<QueryResult> {
  try {
    const db = DatabaseService.getInstance();
    const analyses = db.listAnalyses();

    let filtered = analyses;

    if (options.status) {
      filtered = filtered.filter(a => a.status === options.status);
    }

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

export async function listDiscoveries(options: ListDiscoveriesOptions = {}): Promise<QueryResult> {
  try {
    const db = DatabaseService.getInstance();
    const discoveries = db.listDiscoveries();

    let filtered = discoveries;

    if (options.analysisId) {
      filtered = filtered.filter(d => d.analysisId === options.analysisId);
    }

    if (options.status) {
      filtered = filtered.filter(d => d.status === options.status);
    }

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

export async function getDatabaseStats(): Promise<QueryResult> {
  try {
    const db = DatabaseService.getInstance();
    const stats = db.getStats();
    return { success: true, data: stats };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function registerQueryTools(server: McpServer): void {
  server.registerTool(
    'list_analyses',
    {
      title: 'List Analyses',
      description: 'List all analyses with optional filtering by status',
      inputSchema: z.object({
        limit: z.number().optional(),
        status: z.enum(['processing', 'complete', 'failed']).optional()
      }).shape
    },
    async ({ limit, status }) => {
      const result = await listAnalyses({ limit, status });
      if (!result.success) {
        return { content: [{ type: 'text' as const, text: `Error: ${result.error}` }], isError: true };
      }
      return {
        content: [{
          type: 'text' as const,
          text: `# Analyses\n\n\`\`\`json\n${JSON.stringify(result.data, null, 2)}\n\`\`\``
        }]
      };
    }
  );

  server.registerTool(
    'list_discoveries',
    {
      title: 'List Discoveries',
      description: 'List all discoveries with optional filtering',
      inputSchema: z.object({
        limit: z.number().optional(),
        analysisId: z.string().optional(),
        status: z.enum(['processing', 'complete', 'failed']).optional()
      }).shape
    },
    async ({ limit, analysisId, status }) => {
      const result = await listDiscoveries({ limit, analysisId, status });
      if (!result.success) {
        return { content: [{ type: 'text' as const, text: `Error: ${result.error}` }], isError: true };
      }
      return {
        content: [{
          type: 'text' as const,
          text: `# Discoveries\n\n\`\`\`json\n${JSON.stringify(result.data, null, 2)}\n\`\`\``
        }]
      };
    }
  );

  server.registerTool(
    'get_database_stats',
    {
      title: 'Get Database Statistics',
      description: 'Get overall statistics about the MCP database',
      inputSchema: {}
    },
    async () => {
      const result = await getDatabaseStats();
      if (!result.success) {
        return { content: [{ type: 'text' as const, text: `Error: ${result.error}` }], isError: true };
      }
      return {
        content: [{
          type: 'text' as const,
          text: `# Database Statistics\n\n\`\`\`json\n${JSON.stringify(result.data, null, 2)}\n\`\`\``
        }]
      };
    }
  );
}
