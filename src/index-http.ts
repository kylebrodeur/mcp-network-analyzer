import express from 'express';
import { createRequire } from 'node:module';
import process from 'node:process';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

import { captureNetworkRequests } from './tools/capture.js';

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

  // MCP endpoint using Streamable HTTP transport
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

  // SSE endpoint for streaming (required for MCP Inspector)
  app.get('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    res.on('close', () => {
      transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  const httpServer = app.listen(PORT, HOST, () => {
    console.error(`[HTTP] MCP Network Analyzer listening on http://${HOST}:${PORT}/mcp`);
    console.error(`[HTTP] Health check: http://${HOST}:${PORT}/health`);
    console.error(`[HTTP] Blaxel endpoint format: https://run.blaxel.ai/{workspace}/functions/{server-name}/mcp`);
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

  // Register other tools with placeholder implementations
  server.registerTool(
    'analyze_captured_data',
    {
      title: 'Analyze Captured Data',
      description:
        'Parses captured JSON files to extract request groups, authentication hints, and response metadata.',
      inputSchema: analyzeCapturedDataSchema.shape
    },
    async () => ({
      content: [
        {
          type: 'text' as const,
          text: 'The analyze_captured_data tool is not implemented yet in HTTP mode. Use stdio mode or follow the roadmap in docs/PLAN.md.'
        }
      ],
      isError: true
    })
  );

  server.registerTool(
    'discover_api_patterns',
    {
      title: 'Discover API Patterns',
      description:
        'Performs deeper analysis against previous analyze results to infer REST patterns, pagination, and data models.',
      inputSchema: discoverApiPatternsSchema.shape
    },
    async () => ({
      content: [
        {
          type: 'text' as const,
          text: 'The discover_api_patterns tool is not implemented yet in HTTP mode. Use stdio mode or follow the roadmap in docs/PLAN.md.'
        }
      ],
      isError: true
    })
  );
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
