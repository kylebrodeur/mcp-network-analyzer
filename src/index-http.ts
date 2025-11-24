import express from 'express';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

async function loadEnvFile() {
  try {
    const envPath = join(PROJECT_ROOT, '.env');
    const envContent = await readFile(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      if (line.includes('=') && !line.trim().startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        if (key.trim() && !process.env[key.trim()]) {
          process.env[key.trim()] = value;
        }
      }
    }
  } catch (error) {
    // .env file not found or not readable - that's ok
  }
}

// Load environment variables before anything else
await loadEnvFile();

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

import { DatabaseService } from './lib/database.js';
import { Storage } from './lib/storage.js';
import { analyzeCapturedData } from './tools/analyze.js';
import { captureNetworkRequests } from './tools/capture.js';
import { discoverApiPatterns } from './tools/discover.js';
import { generateExportTool } from './tools/generate.js';
import { getDatabaseStats, listAnalyses, listDiscoveries } from './tools/query.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version?: string };

// Blaxel injects these environment variables during deployment
const PORT = parseInt(process.env.BL_SERVER_PORT || process.env.PORT || '3000', 10);
const HOST = process.env.BL_SERVER_HOST || '0.0.0.0';

function buildUsageInstructions(): string {
  return [
    'Workflow overview:',
    '1. capture_network_requests → 2. analyze_captured_data → 3. discover_api_patterns → 4. generate_export_tool → 5. search_exported_data.',
    'All captured artifacts live under data/. Keep STDOUT clean; use tool responses or STDERR logs for diagnostics.'
  ].join('\n');
}

async function main() {
  // Initialize storage and database
  await Storage.ensureDirectories();
  await DatabaseService.getInstance().initialize();
  
  const server = new McpServer(
    {
      name: 'mcp-network-analyzer',
      version: packageJson.version ?? '0.0.0'
    },
    {
      capabilities: {
        logging: {},
        tools: { listChanged: true },
        resources: { listChanged: true },
        prompts: { listChanged: true }
      },
      instructions: buildUsageInstructions()
    }
  );

  // Register all tools (same as stdio version)
  await registerTools(server);

  // Set up Express app for HTTP transport
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: packageJson.version });
  });

  // MCP endpoint using Streamable HTTP transport (POST only)
  app.post('/mcp', async (req, res) => {
    // Create a new transport for each request to prevent request ID collisions
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    res.on('close', () => {
      transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const httpServer = app.listen(PORT, HOST, () => {
    console.error(`[HTTP] MCP Network Analyzer listening on http://${HOST}:${PORT}/mcp (Streamable HTTP)`);
    console.error(`[HTTP] Health check: http://${HOST}:${PORT}/health`);
    console.error(`[HTTP] Blaxel endpoint: https://run.blaxel.ai/{workspace}/functions/{server-name}/mcp`);
    console.error(`[HTTP] Transport: Streamable HTTP (POST requests with JSON)`);
  });

  httpServer.on('error', (error) => {
    console.error('[HTTP] Server error:', error);
    process.exit(1);
  });

  process.once('SIGINT', () => {
    console.error('[HTTP] Shutting down...');
    httpServer.close();
    process.exit(0);
  });

  process.once('SIGTERM', () => {
    console.error('[HTTP] Shutting down...');
    httpServer.close();
    process.exit(0);
  });

  // Define schemas for query tools
  const listAnalysesSchema = z.object({
    limit: z.number().optional(),
    status: z.enum(['processing', 'complete', 'failed']).optional()
  });

  const listDiscoveriesSchema = z.object({
    limit: z.number().optional(),
    analysisId: z.string().optional(),
    status: z.enum(['processing', 'complete', 'failed']).optional()
  });

  // Register query tools for database access
  server.registerTool(
    'list_analyses',
    {
      title: 'List Analyses',
      description: 'List all analyses with optional filtering by status',
      inputSchema: listAnalysesSchema.shape
    },
    async ({ limit, status }: { limit?: number; status?: 'processing' | 'complete' | 'failed' }) => {
      try {
        const result = await listAnalyses({ limit, status });
        
        if (!result.success) {
          return {
            content: [{ type: 'text' as const, text: `Error: ${result.error}` }],
            isError: true
          };
        }
        
        return {
          content: [
            {
              type: 'text' as const,
              text: [
                '# Analyses List',
                '',
                `**Total:** ${result.data.total}`,
                `**Filtered:** ${result.data.filtered}`,
                '',
                '## Analyses',
                ...result.data.analyses.map((a: any) => 
                  `- **${a.id}** (${a.status}) - Capture: ${a.captureId} - Requests: ${a.totalRequests}`
                ),
                '',
                '## Raw Data (JSON)',
                '```json',
                JSON.stringify(result.data, null, 2),
                '```'
              ].join('\\n')
            }
          ]
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    'list_discoveries',
    {
      title: 'List Discoveries',
      description: 'List all discoveries with optional filtering',
      inputSchema: listDiscoveriesSchema.shape
    },
    async ({ limit, analysisId, status }: { limit?: number; analysisId?: string; status?: 'processing' | 'complete' | 'failed' }) => {
      try {
        const result = await listDiscoveries({ limit, analysisId, status });
        
        if (!result.success) {
          return {
            content: [{ type: 'text' as const, text: `Error: ${result.error}` }],
            isError: true
          };
        }
        
        return {
          content: [
            {
              type: 'text' as const,
              text: [
                '# Discoveries List',
                '',
                `**Total:** ${result.data.total}`,
                `**Filtered:** ${result.data.filtered}`,
                '',
                '## Discoveries',
                ...result.data.discoveries.map((d: any) => 
                  `- **${d.id}** (${d.status}) - Analysis: ${d.analysisId} - Patterns: ${d.patternsFound}`
                ),
                '',
                '## Raw Data (JSON)',
                '```json',
                JSON.stringify(result.data, null, 2),
                '```'
              ].join('\\n')
            }
          ]
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true
        };
      }
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
      try {
        const result = await getDatabaseStats();
        
        if (!result.success) {
          return {
            content: [{ type: 'text' as const, text: `Error: ${result.error}` }],
            isError: true
          };
        }
        
        return {
          content: [
            {
              type: 'text' as const,
              text: [
                '# Database Statistics',
                '',
                `**Captures:** ${result.data.captures}`,
                `**Analyses:** ${result.data.analyses}`,
                `**Discoveries:** ${result.data.discoveries}`,
                `**Generations:** ${result.data.generations}`,
                '',
                '## Raw Data (JSON)',
                '```json',
                JSON.stringify(result.data, null, 2),
                '```'
              ].join('\\n')
            }
          ]
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${error}` }],
          isError: true
        };
      }
    }
  );
}

// Tool registration function (extracted from index.ts logic)
async function registerTools(server: McpServer) {
  // Import schemas from index.ts
  const captureNetworkRequestsSchema = z.object({
    url: z.string().url(),
    waitForNetworkIdleMs: z.number().int().positive().max(120000).optional(),
    sessionId: z.string().min(1).optional(),
    includeResourceTypes: z.array(z.string()).optional(),
    excludeResourceTypes: z.array(z.string()).optional(),
    ignoreStaticAssets: z.boolean().optional()
  });

  const analyzeCapturedDataSchema = z.object({
    captureId: z.string().min(1),
    includeStaticAssets: z.boolean().default(false).optional(),
    outputPath: z.string().optional()
  });

  const discoverApiPatternsSchema = z.object({
    analysisId: z.string().min(1),
    minConfidence: z.number().min(0).max(1).default(0.5).optional(),
    includeAuthInsights: z.boolean().optional()
  });

  const generateExportToolSchema = z.object({
    discoveryId: z.string().min(1),
    toolName: z.string().min(1),
    description: z.string().min(1).describe('Description of what the tool does and what data it extracts. This helps the LLM generate better, more contextual code.').optional(),
    model: z.string().min(1).default('Qwen/Qwen3-Coder-30B-A3B-Instruct').describe('Model to use via HuggingFace + Nebius provider. Configure Nebius API key at https://huggingface.co/settings/inference-providers').optional(),
    targetUrl: z.string().url().optional(),
    outputDirectory: z.string().optional(),
    outputFormat: z.enum(['json', 'csv', 'sqlite']).default('json').optional(),
    incremental: z.boolean().optional(),
    language: z.enum(['typescript', 'python', 'javascript', 'go']).default('typescript').optional()
  });

  // Register capture_network_requests tool
  server.registerTool(
    'capture_network_requests',
    {
      title: 'Capture Network Requests',
      description:
        'Launches a Playwright/Puppeteer session, persists auth if requested, and records HTTP traffic into data/captures/.',
      inputSchema: captureNetworkRequestsSchema.shape
    },
    async ({ url, waitForNetworkIdleMs, sessionId, includeResourceTypes, excludeResourceTypes, ignoreStaticAssets }) => {
      try {
        const result = await captureNetworkRequests({
          url,
          waitForNetworkIdleMs,
          sessionId,
          includeResourceTypes,
          excludeResourceTypes,
          ignoreStaticAssets
        });

        if (!result.success) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Failed to capture network requests: ${result.error}`
              }
            ],
            isError: true
          };
        }

        const { analysis } = result;
        
        return {
          content: [
            {
              type: 'text' as const,
              text: [
                '# Network Capture Complete',
                '',
                `**Capture ID:** ${result.captureId}`,
                `**Target URL:** ${url}`,
                `**Total Requests:** ${result.totalRequests}`,
                `**Total Responses:** ${result.totalResponses}`,
                '',
                '## 📊 Request Type Breakdown',
                ...Object.entries(analysis.requestTypeBreakdown).map(
                  ([type, count]) => `- ${type}: ${count}`
                ),
                '',
                '## 🌐 Domains Accessed',
                ...result.domains.map(domain => `- ${domain}`),
                '',
                '## 🔌 API Endpoints Discovered',
                analysis.apiEndpoints.length > 0
                  ? analysis.apiEndpoints
                      .map(
                        ep =>
                          `- ${ep.method} ${ep.url}${ep.hasBody ? ' (with body)' : ''}`
                      )
                      .join('\\n')
                  : '- No API endpoints detected (only static resources)',
                '',
                '## 🔐 Authentication Analysis',
                `**Cookie-based:** ${analysis.authenticationHints.cookieBased ? 'Yes' : 'No'}`,
                analysis.authenticationHints.cookies.length > 0
                  ? `**Cookies detected:** ${analysis.authenticationHints.cookies.slice(0, 5).join(', ')}${analysis.authenticationHints.cookies.length > 5 ? ` (+${analysis.authenticationHints.cookies.length - 5} more)` : ''}`
                  : '',
                analysis.authenticationHints.customHeaders.length > 0
                  ? `**Custom headers:** ${analysis.authenticationHints.customHeaders.join(', ')}`
                  : '',
                `**Bearer token:** ${analysis.authenticationHints.bearerToken ? 'Yes' : 'No'}`,
                '',
                '## 📁 Data Saved',
                `- Complete session: ${result.sessionPath}/session.json`,
                `- Requests: ${result.sessionPath}/requests.json`,
                `- Responses: ${result.sessionPath}/responses.json`,
                `- Metadata: ${result.sessionPath}/metadata.json`,
                '',
                '## 🎯 Recommended Next Steps',
                ...analysis.suggestedNextSteps.map((step, i) => `${i + 1}. ${step}`)
              ]
                .filter(line => line !== '')
                .join('\\n')
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error capturing network requests: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Register analyze_captured_data tool
  server.registerTool(
    'analyze_captured_data',
    {
      title: 'Analyze Captured Data',
      description:
        'Parses captured JSON files to extract request groups, authentication hints, and response metadata.',
      inputSchema: analyzeCapturedDataSchema.shape
    },
    async ({ captureId, includeStaticAssets, outputPath }) => {
      try {
        const result = await analyzeCapturedData({
          captureId,
          includeStaticAssets,
          outputPath
        });

        if (!result.success) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Failed to analyze captured data: ${result.error}`
              }
            ],
            isError: true
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: [
                '# Network Analysis Complete',
                '',
                `**Analysis ID:** ${result.analysisId}`,
                `**Capture ID:** ${captureId}`,
                '',
                '## 📊 Summary',
                `- Total Requests: ${result.summary.totalRequests}`,
                `- Total Responses: ${result.summary.totalResponses}`,
                `- API Endpoints: ${result.summary.apiEndpoints}`,
                `- Static Assets: ${result.summary.staticAssets}`,
                `- Errors (4xx/5xx): ${result.summary.errorCount}`,
                '',
                '## 🌐 Domains',
                ...result.summary.domains.map(domain => `- ${domain}`),
                '',
                '## 🔌 Endpoint Groups',
                result.endpointGroups.length > 0
                  ? result.endpointGroups
                      .slice(0, 10)
                      .map(
                        group =>
                          `- ${group.method} ${group.pathPattern} (${group.count} calls)\\n  Example: ${group.exampleUrl}`
                      )
                      .join('\\n')
                  : '- No API endpoints detected',
                result.endpointGroups.length > 10
                  ? `\\n... and ${result.endpointGroups.length - 10} more groups`
                  : '',
                '',
                '## 🔐 Authentication',
                `- Method: ${result.authentication.method}`,
                `- Confidence: ${Math.round(result.authentication.confidence * 100)}%`,
                result.authentication.headers.length > 0
                  ? `- Auth Headers: ${result.authentication.headers.join(', ')}`
                  : '',
                `- Has Cookies: ${result.authentication.hasCookies ? 'Yes' : 'No'}`,
                '',
                '## 📦 Content Types',
                ...Object.entries(result.contentTypes)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 5)
                  .map(([type, count]) => `- ${type}: ${count}`),
                '',
                '## 📈 Status Codes',
                ...Object.entries(result.statusCodes)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([code, count]) => `- ${code}: ${count}`),
                '',
                '## 💡 Recommendations',
                ...result.recommendations.map((rec, i) => `${i + 1}. ${rec}`),
                '',
                '## 📁 Analysis Saved',
                `Path: ${result.analysisPath}`,
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
          content: [
            {
              type: 'text' as const,
              text: `Error analyzing captured data: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    'discover_api_patterns',
    {
      title: 'Discover API Patterns',
      description:
        'Performs deeper analysis against previous analyze results to infer REST patterns, pagination, and data models.',
      inputSchema: discoverApiPatternsSchema.shape
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
            content: [
              {
                type: 'text' as const,
                text: `Failed to discover API patterns: ${result.error}`
              }
            ],
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
                  ? result.patterns.map(
                      pattern =>
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
                          .join('\\n')
                    )
                  : ['- No patterns discovered (confidence threshold not met)'],
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
                      ...result.relationships.map(
                        rel => `- ${rel.from} → ${rel.to} (${rel.type})`
                      ),
                      ''
                    ].join('\\n')
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
                .join('\\n')
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error discovering API patterns: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    'generate_export_tool',
    {
      title: 'Generate Export Tool',
      description:
        'Generates runnable export scripts from discovered API patterns. Include a description field to provide context for better code generation. LLMs should provide both toolName and description to help the code generation model create more relevant, contextual code.',
      inputSchema: generateExportToolSchema.shape
    },
    async ({ discoveryId, toolName, description, model, targetUrl, outputDirectory, outputFormat, incremental, language }) => {
      try {
        const result = await generateExportTool({
          discoveryId,
          toolName,
          description,
          model,
          targetUrl,
          outputDirectory,
          outputFormat,
          incremental,
          language
        });

        if (!result.success) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Failed to generate export tool: ${result.error}`
              }
            ],
            isError: true
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: [
                '# 🎉 Export Tool Generated Successfully',
                '',
                `**File:** ${result.fileName}`,
                `**Language:** ${result.language}`,
                `**Path:** ${result.generatedPath}`,
                `**Lines of Code:** ${result.linesOfCode}`,
                result.tokensUsed ? `**Tokens Used:** ${result.tokensUsed}` : '',
                '',
                '## 📖 Usage Instructions',
                '',
                result.instructions || 'See the generated file for usage instructions.',
                '',
                '## ⚠️ Important Notes',
                '',
                '1. **Review the code** before running it',
                '2. **Test with small datasets** first',
                '3. **Monitor rate limits** to avoid being blocked',
                '4. **Customize as needed** for your specific use case',
                '',
                '## 🚀 Next Steps',
                '',
                '1. Review and test the generated export tool',
                '2. Run it to export data from the target API',
                '3. Use search_exported_data to query the exported data'
              ]
                .filter(line => line !== '')
                .join('\\n')
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error generating export tool: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
