/**
 * Advanced API pattern discovery tool
 * Performs deep analysis to identify REST patterns, pagination, and data models
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from 'zod';
import { DatabaseService } from "../lib/database.js";
import {
    APIPattern,
    PatternDiscoveryResult,
    PatternMatcher,
} from "../lib/pattern-matcher.js";
import { Storage } from "../lib/storage.js";
import type { CaptureSession } from "../lib/types.js";

export interface DiscoverOptions {
  analysisId: string;
  includeAuthInsights?: boolean;
  minConfidence?: number;
}

export interface DiscoverResult {
  success: boolean;
  discoveryId: string;
  discoveryPath?: string;
  patterns: Array<{
    type: string;
    method: string;
    pathPattern: string;
    confidence: number;
    authRequired: boolean;
    responseType: string;
    exampleUrl: string;
    dataModel?: {
      name: string;
      propertyCount: number;
      hasNestedObjects: boolean;
    };
  }>;
  pagination: {
    type: string;
    detected: boolean;
    confidence: number;
    params?: Record<string, string>;
  };
  rateLimiting: {
    detected: boolean;
    headers?: string[];
  };
  relationships: Array<{
    from: string;
    to: string;
    type: string;
  }>;
  recommendations: string[];
  error?: string;
}

/**
 * Discover API patterns from captured and analyzed data
 */
export async function discoverApiPatterns(
  options: DiscoverOptions
): Promise<DiscoverResult> {
  const db = DatabaseService.getInstance();
  let discoveryId: string | null = null;
  
  try {
    // Generate discovery ID first
    discoveryId = await db.createDiscovery(options.analysisId);
    
    // Load analysis results to get the capture ID
    const dataDir = Storage.getDataDirectory();
    const analysisFile = join(
      dataDir,
      "analyses",
      options.analysisId,
      "analysis.json"
    );

    const analysisData = await readFile(analysisFile, "utf-8");
    const analysis = JSON.parse(analysisData);

    // Load the original capture session
    const sessionPath = Storage.getSessionPath(analysis.captureId);
    const sessionFile = join(sessionPath, "session.json");
    const sessionData = await readFile(sessionFile, "utf-8");
    const session: CaptureSession = JSON.parse(sessionData);

    // Perform pattern discovery
    const matcher = new PatternMatcher();
    const discovery: PatternDiscoveryResult = await matcher.discover(
      session.requests,
      session.responses
    );

    // Filter by confidence threshold
    const minConfidence = options.minConfidence ?? 0.5;
    const filteredPatterns = discovery.patterns.filter(
      (p) => p.confidence >= minConfidence
    );

    // Save discovery results
    const discoveryPath = join(dataDir, "analyses", discoveryId);
    await mkdir(discoveryPath, { recursive: true });

    const discoveryFile = join(discoveryPath, "discovery.json");
    await writeFile(
      discoveryFile,
      JSON.stringify(
        {
          discoveryId,
          analysisId: options.analysisId,
          captureId: analysis.captureId,
          timestamp: new Date().toISOString(),
          ...discovery,
        },
        null,
        2
      ),
      "utf-8"
    );
    
    // Update database record with results
    await db.updateDiscovery(discoveryId, {
      status: 'complete',
      filePath: discoveryFile,
      patternsFound: filteredPatterns.length,
      paginationDetected: discovery.pagination.type !== 'none',
      rateLimitingDetected: discovery.rateLimiting?.detected || false
    });

    // Generate recommendations
    const recommendations = generateDiscoveryRecommendations(discovery, discoveryId);

    // Format result
    return {
      success: true,
      discoveryId,
      discoveryPath,
      patterns: filteredPatterns.map((p) => formatPattern(p)),
      pagination: {
        type: discovery.pagination.type,
        detected: discovery.pagination.type !== "none",
        confidence: discovery.pagination.confidence,
        params: discovery.pagination.params as Record<string, string>,
      },
      rateLimiting: discovery.rateLimiting || { detected: false },
      relationships: discovery.relationships,
      recommendations,
    };
  } catch (error) {
    // Update database record if we have a discovery ID
    if (discoveryId) {
      await db.updateDiscovery(discoveryId, { status: 'failed' });
    }
    
    return {
      success: false,
      discoveryId: discoveryId || "",
      patterns: [],
      pagination: {
        type: "none",
        detected: false,
        confidence: 0,
      },
      rateLimiting: { detected: false },
      relationships: [],
      recommendations: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Format pattern for result output
 */
function formatPattern(pattern: APIPattern) {
  return {
    type: pattern.type,
    method: pattern.method,
    pathPattern: pattern.pathPattern,
    confidence: Math.round(pattern.confidence * 100) / 100,
    authRequired: pattern.authMethod !== "none",
    responseType: pattern.responseType,
    exampleUrl: pattern.examples[0] || "",
    dataModel: pattern.dataModel
      ? {
          name: pattern.dataModel.name,
          propertyCount: Object.keys(pattern.dataModel.properties).length,
          hasNestedObjects: Object.values(pattern.dataModel.properties).some(
            (p) => p.nested
          ),
        }
      : undefined,
  };
}

/**
 * Generate recommendations based on discovery
 */
function generateDiscoveryRecommendations(
  discovery: PatternDiscoveryResult,
  discoveryId: string
): string[] {
  const recommendations: string[] = [];

  // Pattern-based recommendations
  const listPatterns = discovery.patterns.filter((p) => p.type === "list");
  const detailPatterns = discovery.patterns.filter((p) => p.type === "detail");

  if (listPatterns.length > 0 && detailPatterns.length > 0) {
    recommendations.push(
      `Found ${listPatterns.length} list endpoint(s) and ${detailPatterns.length} detail endpoint(s). Consider fetching list first, then details for complete data.`
    );
  }

  // Pagination recommendations
  if (discovery.pagination.type !== "none") {
    recommendations.push(
      `Pagination detected (${discovery.pagination.type}). Generated export tools should iterate through all pages. Confidence: ${Math.round(discovery.pagination.confidence * 100)}%`
    );
  } else if (listPatterns.length > 0) {
    recommendations.push(
      "No pagination detected. List endpoints may return all data in single response, or pagination may use a pattern not yet recognized."
    );
  }

  // Rate limiting recommendations
  if (discovery.rateLimiting?.detected) {
    recommendations.push(
      `Rate limiting detected via headers: ${discovery.rateLimiting.headers?.join(", ")}. Implement delays and respect rate limits in export tools.`
    );
  }

  // Authentication recommendations
  const authPatterns = discovery.patterns.filter(
    (p) => p.authMethod !== "none"
  );
  if (authPatterns.length > 0) {
    const authMethods = new Set(authPatterns.map((p) => p.authMethod));
    recommendations.push(
      `Authentication required: ${Array.from(authMethods).join(", ")}. Ensure credentials are included in export tools.`
    );
  }

  // Data model recommendations
  const patternsWithModels = discovery.patterns.filter((p) => p.dataModel);
  if (patternsWithModels.length > 0) {
    recommendations.push(
      `Data models inferred for ${patternsWithModels.length} endpoint(s). TypeScript types can be generated for type-safe export tools.`
    );
  }

  // Relationship recommendations
  if (discovery.relationships.length > 0) {
    recommendations.push(
      `${discovery.relationships.length} relationship(s) detected between endpoints. Consider fetching related data in sequence.`
    );
    discovery.relationships.forEach((rel) => {
      recommendations.push(`  - ${rel.from} → ${rel.to} (${rel.type})`);
    });
  }

  // Next steps
  if (discovery.patterns.length > 0) {
    recommendations.push(
      "Ready to generate export tools. Use generate_export_tool with this discovery ID to create automated data extraction scripts."
    );
  } else {
    recommendations.push(
      "No clear API patterns detected. The site may use GraphQL, WebSockets, or non-standard APIs. Manual analysis may be required."
    );
  }

  // Always add the discovery ID for next steps
  recommendations.push(`✅ Discovery Complete! Use this ID for next steps:`);
  recommendations.push(`📋 Discovery ID: ${discoveryId}`);
  recommendations.push(`🔧 Next: Run generate_export_tool with discoveryId: ${discoveryId}`);
  recommendations.push(`💡 Tip: Include a meaningful toolName and description when generating export tools for better code quality`);
  recommendations.push(`📊 Or use 'get_next_available_ids' to see all available IDs`);

  return recommendations;
}

export function registerDiscoverTool(server: McpServer): void {
  server.registerTool(
    'discover_api_patterns',
    {
      title: 'Discover API Patterns',
      description:
        'Performs deeper analysis against previous analyze results to infer REST patterns, pagination, and data models.',
      inputSchema: z.object({
        analysisId: z.string().min(1),
        minConfidence: z.number().min(0).max(1).default(0.5).optional(),
        includeAuthInsights: z.boolean().optional()
      }).shape
    },
    async ({ analysisId, minConfidence, includeAuthInsights }) => {
      try {
        const result = await discoverApiPatterns({
          analysisId,
          minConfidence,
          includeAuthInsights
        });

        if (!result.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to discover API patterns: ${result.error}` }],
            isError: true
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: [
                '# API Pattern Discovery Complete',
                '',
                `**Discovery ID:** ${result.discoveryId}`,
                `**Analysis ID:** ${analysisId}`,
                `**Patterns Found:** ${result.patterns.length}`,
                '',
                '## 🎯 Discovered Patterns',
                result.patterns.length > 0
                  ? result.patterns
                      .map(pattern =>
                        [
                          `### ${pattern.method} ${pattern.pathPattern}`,
                          `- Type: ${pattern.type}`,
                          `- Confidence: ${pattern.confidence * 100}%`,
                          `- Auth Required: ${pattern.authRequired ? 'Yes' : 'No'}`,
                          `- Response Type: ${pattern.responseType}`,
                          pattern.dataModel
                            ? `- Data Model: ${pattern.dataModel.name} (${pattern.dataModel.propertyCount} properties${pattern.dataModel.hasNestedObjects ? ', with nested objects' : ''})`
                            : '',
                          `- Example: ${pattern.exampleUrl}`,
                          ''
                        ]
                          .filter(line => line !== '')
                          .join('\n')
                      )
                      .join('\n')
                  : '- No patterns discovered (confidence threshold not met)',
                '',
                '## 📄 Pagination',
                `- Type: ${result.pagination.type}`,
                `- Detected: ${result.pagination.detected ? 'Yes' : 'No'}`,
                result.pagination.detected
                  ? `- Confidence: ${Math.round(result.pagination.confidence * 100)}%`
                  : '',
                result.pagination.params && Object.keys(result.pagination.params).length > 0
                  ? `- Parameters: ${JSON.stringify(result.pagination.params)}`
                  : '',
                '',
                '## ⚡ Rate Limiting',
                `- Detected: ${result.rateLimiting.detected ? 'Yes' : 'No'}`,
                result.rateLimiting.headers
                  ? `- Headers: ${result.rateLimiting.headers.join(', ')}`
                  : '',
                '',
                result.relationships.length > 0
                  ? [
                      '## 🔗 Endpoint Relationships',
                      ...result.relationships.map(rel => `- ${rel.from} → ${rel.to} (${rel.type})`),
                      ''
                    ].join('\n')
                  : '',
                '## 💡 Recommendations',
                ...result.recommendations.map((rec, i) => `${i + 1}. ${rec}`),
                '',
                '## 📁 Discovery Saved',
                `Path: ${result.discoveryPath}`,
                '',
                '## 📊 Raw Data (JSON)',
                '```json',
                JSON.stringify(result, null, 2),
                '```'
              ]
                .filter(line => line !== '')
                .join('\n')
            }
          ]
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error discovering API patterns: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true
        };
      }
    }
  );
}
