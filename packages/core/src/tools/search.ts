/**
 * Search exported data tool - queries captured traffic and analysis results
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { DatabaseService } from '../lib/database.js';
import { Storage } from '../lib/storage.js';
import type { CapturedRequest, CapturedResponse } from '../lib/types.js';

interface SearchFilters {
  query: string;
  captureId?: string;
  statusCode?: number | number[] | null;
  limit?: number;
  includeResponses?: boolean;
}

interface SearchMatch {
  id: string;
  type: 'request' | 'response' | 'analysis';
  captureId: string;
  timestamp: string;
  url?: string;
  method?: string;
  status?: number;
  matchedFields: string[];
  content: {
    request?: CapturedRequest;
    response?: CapturedResponse;
    snippet?: string;
  };
}

interface SearchResults {
  matches: SearchMatch[];
  totalCount: number;
  searchQuery: string;
  executionTime: number;
  aggregations?: {
    byStatus: Record<number, number>;
    byDomain: Record<string, number>;
    byMethod: Record<string, number>;
  };
}

export class SearchService {
  private db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Search across all exported data
   */
  public async searchExportedData(filters: SearchFilters): Promise<SearchResults> {
    const startTime = Date.now();
    
    await this.db.initialize();

    const matches: SearchMatch[] = [];
    const statusCodes = this.normalizeStatusCodes(filters.statusCode);
    
    // Search captured data
    const captureMatches = await this.searchCapturedData(filters, statusCodes);
    matches.push(...captureMatches);

    // Search analysis results
    const analysisMatches = await this.searchAnalysisData(filters, statusCodes);
    matches.push(...analysisMatches);

    // Sort by timestamp (newest first) and apply limit
    matches.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const limitedMatches = matches.slice(0, filters.limit || 100);

    const results: SearchResults = {
      matches: limitedMatches,
      totalCount: matches.length,
      searchQuery: filters.query,
      executionTime: Date.now() - startTime
    };

    // Add aggregations if we have matches
    if (matches.length > 0) {
      results.aggregations = this.generateAggregations(matches);
    }

    return results;
  }

  /**
   * Search captured network data
   */
  private async searchCapturedData(filters: SearchFilters, statusCodes?: number[]): Promise<SearchMatch[]> {
    const matches: SearchMatch[] = [];
    const dataDir = Storage.getDataDirectory();
    const capturesDir = join(dataDir, 'captures');

    if (!existsSync(capturesDir)) {
      return matches;
    }

    // Get capture IDs either from filter or from database records
    let captureIds: string[] = [];
    
    if (filters.captureId) {
      captureIds = [filters.captureId];
    } else {
      // Get all captures from database and check for session directories
      const captures = this.db.listCaptures();
      const analyses = this.db.listAnalyses();
      
      // Include capture sessionIds
      captureIds = captures.map(c => c.sessionId);
      // Include analysis captureIds  
      captureIds.push(...analyses.map(a => a.captureId));
      // Remove duplicates
      captureIds = Array.from(new Set(captureIds));
    }

    for (const captureId of captureIds) {
      try {
        const sessionDir = await this.findSessionDirectory(capturesDir, captureId);
        if (!sessionDir) continue;

        // Search requests
        const requestMatches = await this.searchRequestFile(sessionDir, captureId, filters);
        matches.push(...requestMatches);

        // Search responses if requested
        if (filters.includeResponses) {
          const responseMatches = await this.searchResponseFile(sessionDir, captureId, filters, statusCodes);
          matches.push(...responseMatches);
        }
      } catch (error) {
        console.error(`Error searching capture ${captureId}:`, error);
      }
    }

    return matches;
  }

  /**
   * Search request data file
   */
  private async searchRequestFile(sessionDir: string, captureId: string, filters: SearchFilters): Promise<SearchMatch[]> {
    const requestsFile = join(sessionDir, 'requests.json');
    if (!existsSync(requestsFile)) return [];

    try {
      const requestsData = await readFile(requestsFile, 'utf-8');
      const requests: CapturedRequest[] = JSON.parse(requestsData);

      return requests
        .filter(req => this.matchesQuery(filters.query, req))
        .map(req => ({
          id: req.id,
          type: 'request' as const,
          captureId,
          timestamp: req.timestamp,
          url: req.url,
          method: req.method,
          matchedFields: this.getMatchedFields(filters.query, req),
          content: { request: req }
        }));
    } catch (error) {
      console.error(`Error reading requests file ${requestsFile}:`, error);
      return [];
    }
  }

  /**
   * Search response data file
   */
  private async searchResponseFile(sessionDir: string, captureId: string, filters: SearchFilters, statusCodes?: number[]): Promise<SearchMatch[]> {
    const responsesFile = join(sessionDir, 'responses.json');
    if (!existsSync(responsesFile)) return [];

    try {
      const responsesData = await readFile(responsesFile, 'utf-8');
      const responses: CapturedResponse[] = JSON.parse(responsesData);

      return responses
        .filter(resp => {
          if (statusCodes && !statusCodes.includes(resp.status)) return false;
          return this.matchesQuery(filters.query, resp);
        })
        .map(resp => ({
          id: resp.id,
          type: 'response' as const,
          captureId,
          timestamp: resp.timestamp,
          status: resp.status,
          matchedFields: this.getMatchedFields(filters.query, resp),
          content: { response: resp }
        }));
    } catch (error) {
      console.error(`Error reading responses file ${responsesFile}:`, error);
      return [];
    }
  }

  /**
   * Search analysis results
   */
  private async searchAnalysisData(filters: SearchFilters, statusCodes?: number[]): Promise<SearchMatch[]> {
    const matches: SearchMatch[] = [];
    const dataDir = Storage.getDataDirectory();
    const analysesDir = join(dataDir, 'analyses');

    if (!existsSync(analysesDir)) {
      return matches;
    }

    const analyses = this.db.listAnalyses();
    
    for (const analysis of analyses) {
      if (filters.captureId && analysis.captureId !== filters.captureId) continue;

      try {
        const analysisDir = join(analysesDir, analysis.id);
        const analysisFile = join(analysisDir, 'analysis.json');
        
        if (!existsSync(analysisFile)) continue;

        const analysisData = await readFile(analysisFile, 'utf-8');
        const analysisResult = JSON.parse(analysisData);

        if (this.matchesQuery(filters.query, analysisResult)) {
          matches.push({
            id: analysis.id,
            type: 'analysis',
            captureId: analysis.captureId,
            timestamp: analysis.timestamp,
            matchedFields: this.getMatchedFields(filters.query, analysisResult),
            content: {
              snippet: this.extractSnippet(filters.query, analysisResult)
            }
          });
        }
      } catch (error) {
        console.error(`Error searching analysis ${analysis.id}:`, error);
      }
    }

    return matches;
  }

  /**
   * Find session directory for a capture ID
   */
  private async findSessionDirectory(capturesDir: string, captureId: string): Promise<string | null> {
    // Try direct session ID match first
    const directPath = join(capturesDir, captureId);
    if (existsSync(directPath)) return directPath;

    // Search for directories containing the capture ID
    try {
      const { readdir } = await import('node:fs/promises');
      const entries = await readdir(capturesDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.includes(captureId)) {
          return join(capturesDir, entry.name);
        }
      }
    } catch (error) {
      console.error('Error searching for session directory:', error);
    }

    return null;
  }

  /**
   * Check if a record matches the search query
   */
  private matchesQuery(query: string, record: any): boolean {
    const searchText = query.toLowerCase();
    const recordText = JSON.stringify(record).toLowerCase();
    return recordText.includes(searchText);
  }

  /**
   * Get fields that matched the query
   */
  private getMatchedFields(query: string, record: any): string[] {
    const searchText = query.toLowerCase();
    const matchedFields: string[] = [];

    const checkField = (obj: any, path: string = ''): void => {
      if (typeof obj === 'string' && obj.toLowerCase().includes(searchText)) {
        matchedFields.push(path || 'value');
      } else if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          const newPath = path ? `${path}.${key}` : key;
          checkField(value, newPath);
        }
      }
    };

    checkField(record);
    return matchedFields;
  }

  /**
   * Extract a snippet around the matched query
   */
  private extractSnippet(query: string, record: any): string {
    const text = JSON.stringify(record, null, 2);
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    
    if (index === -1) return text.substring(0, 200) + '...';
    
    const start = Math.max(0, index - 100);
    const end = Math.min(text.length, index + query.length + 100);
    
    return text.substring(start, end);
  }

  /**
   * Normalize status codes to array
   */
  private normalizeStatusCodes(statusCode?: number | number[] | null): number[] | undefined {
    if (statusCode === null || statusCode === undefined) return undefined;
    if (typeof statusCode === 'number') return [statusCode];
    return statusCode;
  }

  /**
   * Check if query looks like it might match generated code
   */
  private isCodeQuery(query: string): boolean {
    const codeKeywords = [
      'function', 'const', 'let', 'var', 'class', 'interface', 'type',
      'import', 'export', 'async', 'await', 'fetch', 'axios', 'request',
      'response', 'headers', 'body', 'json', 'stringify', 'parse'
    ];
    
    return codeKeywords.some(keyword => query.toLowerCase().includes(keyword));
  }

  /**
   * Generate aggregations from search results
   */
  private generateAggregations(matches: SearchMatch[]): SearchResults['aggregations'] {
    const byStatus: Record<number, number> = {};
    const byDomain: Record<string, number> = {};
    const byMethod: Record<string, number> = {};

    for (const match of matches) {
      // Status aggregation
      if (match.status) {
        byStatus[match.status] = (byStatus[match.status] || 0) + 1;
      }

      // Domain aggregation
      if (match.url) {
        try {
          const domain = new URL(match.url).hostname;
          byDomain[domain] = (byDomain[domain] || 0) + 1;
        } catch (error) {
          // Invalid URL, skip
        }
      }

      // Method aggregation
      if (match.method) {
        byMethod[match.method] = (byMethod[match.method] || 0) + 1;
      }
    }

    return { byStatus, byDomain, byMethod };
  }
}

/**
 * Search exported data tool handler
 */
export async function handleSearchExportedData(input: SearchFilters) {
  const searchService = new SearchService();
  const results = await searchService.searchExportedData(input);

  // Format response for MCP client
  return {
    content: [
      {
        type: 'text' as const,
        text: formatSearchResults(results)
      }
    ]
  };
}

/**
 * Format search results for display
 */
function formatSearchResults(results: SearchResults): string {
  const { matches, totalCount, searchQuery, executionTime, aggregations } = results;

  let output = `## Search Results\n\n`;
  output += `**Query:** "${searchQuery}"\n`;
  output += `**Found:** ${totalCount} matches (showing first ${matches.length})\n`;
  output += `**Execution time:** ${executionTime}ms\n\n`;

  if (aggregations) {
    output += `### Aggregations\n\n`;
    
    if (Object.keys(aggregations.byStatus).length > 0) {
      output += `**By Status Code:**\n`;
      for (const [status, count] of Object.entries(aggregations.byStatus)) {
        output += `- ${status}: ${count} matches\n`;
      }
      output += `\n`;
    }

    if (Object.keys(aggregations.byDomain).length > 0) {
      output += `**By Domain:**\n`;
      const sortedDomains = Object.entries(aggregations.byDomain)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10); // Top 10 domains
      
      for (const [domain, count] of sortedDomains) {
        output += `- ${domain}: ${count} matches\n`;
      }
      output += `\n`;
    }

    if (Object.keys(aggregations.byMethod).length > 0) {
      output += `**By HTTP Method:**\n`;
      for (const [method, count] of Object.entries(aggregations.byMethod)) {
        output += `- ${method}: ${count} matches\n`;
      }
      output += `\n`;
    }
  }

  if (matches.length === 0) {
    output += `### No matches found\n\n`;
    output += `Try:\n`;
    output += `- Using different keywords\n`;
    output += `- Broadening your search terms\n`;
    output += `- Checking if data exists for the specified captureId\n`;
    return output;
  }

  output += `### Matches\n\n`;

  for (const [index, match] of matches.entries()) {
    output += `#### ${index + 1}. ${match.type.charAt(0).toUpperCase() + match.type.slice(1)} Match\n\n`;
    output += `- **ID:** ${match.id}\n`;
    output += `- **Capture:** ${match.captureId}\n`;
    output += `- **Timestamp:** ${new Date(match.timestamp).toISOString()}\n`;
    
    if (match.url) {
      output += `- **URL:** ${match.url}\n`;
    }
    
    if (match.method) {
      output += `- **Method:** ${match.method}\n`;
    }
    
    if (match.status) {
      output += `- **Status:** ${match.status}\n`;
    }
    
    output += `- **Matched fields:** ${match.matchedFields.join(', ')}\n`;
    
    if (match.content.snippet) {
      output += `- **Snippet:**\n\`\`\`\n${match.content.snippet}\n\`\`\`\n`;
    }
    
    output += `\n`;
  }

  if (totalCount > matches.length) {
    output += `*... and ${totalCount - matches.length} more matches. Use a higher limit to see more results.*\n`;
  }

  return output;
}

export function registerSearchTool(server: McpServer): void {
  server.registerTool(
    'search_exported_data',
    {
      title: 'Search Exported Data',
      description:
        'Queries captured or generated artifacts via filters (status codes, domains, time ranges, and free-text search).',
      inputSchema: z.object({
        query: z.string().min(1),
        captureId: z.string().nullable().optional(),
        statusCode: z.union([z.number().int(), z.array(z.number().int())]).nullable().optional(),
        limit: z.number().int().positive().max(1000).default(100).optional(),
        includeResponses: z.boolean().optional()
      }).shape
    },
    async (params) => {
      return handleSearchExportedData({
        ...params,
        captureId: params.captureId ?? undefined
      });
    }
  );
}