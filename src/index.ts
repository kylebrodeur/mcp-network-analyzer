import { createRequire } from 'node:module';
import process from 'node:process';

import { McpServer, type ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version?: string };

type ToolName =
  | 'capture_network_requests'
  | 'analyze_captured_data'
  | 'discover_api_patterns'
  | 'generate_export_tool'
  | 'search_exported_data';

type LogLevel = 'info' | 'warn' | 'error';

function buildUsageInstructions(): string {
  return [
    'Workflow overview:',
    '1. capture_network_requests → 2. analyze_captured_data → 3. discover_api_patterns → 4. generate_export_tool → 5. search_exported_data.',
    'All captured artifacts live under data/. Keep STDOUT clean; use tool responses or STDERR logs for diagnostics.'
  ].join('\n');
}

const transport = new StdioServerTransport();

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
  analysisId: z.string().min(1),
  toolName: z.string().min(1),
  targetUrl: z.string().url().optional(),
  outputDirectory: z.string().optional(),
  outputFormat: z.enum(['json', 'csv', 'sqlite']).default('json').optional(),
  incremental: z.boolean().optional()
});

const searchExportedDataSchema = z.object({
  query: z.string().min(1),
  captureId: z.string().optional(),
  statusCode: z.union([z.number().int(), z.array(z.number().int())]).optional(),
  limit: z.number().int().positive().max(1000).default(100).optional(),
  includeResponses: z.boolean().optional()
});

const registerPlaceholderTools = () => {
  server.registerTool(
    'capture_network_requests',
    {
      title: 'Capture Network Requests',
      description:
        'Launches a Playwright/Puppeteer session, persists auth if requested, and records HTTP traffic into data/captures/.',
      inputSchema: captureNetworkRequestsSchema.shape
    },
    makeNotImplementedHandler('capture_network_requests') as ToolCallback<typeof captureNetworkRequestsSchema.shape>
  );

  server.registerTool(
    'analyze_captured_data',
    {
      title: 'Analyze Captured Data',
      description:
        'Parses captured JSON files to extract request groups, authentication hints, and response metadata.',
      inputSchema: analyzeCapturedDataSchema.shape
    },
    makeNotImplementedHandler('analyze_captured_data') as ToolCallback<typeof analyzeCapturedDataSchema.shape>
  );

  server.registerTool(
    'discover_api_patterns',
    {
      title: 'Discover API Patterns',
      description:
        'Performs deeper analysis against previous analyze results to infer REST patterns, pagination, and data models.',
      inputSchema: discoverApiPatternsSchema.shape
    },
    makeNotImplementedHandler('discover_api_patterns') as ToolCallback<typeof discoverApiPatternsSchema.shape>
  );

  server.registerTool(
    'generate_export_tool',
    {
      title: 'Generate Export Tool',
      description:
        'Renders a Handlebars template to build a reusable export script that replays discovered API calls.',
      inputSchema: generateExportToolSchema.shape
    },
    makeNotImplementedHandler('generate_export_tool') as ToolCallback<typeof generateExportToolSchema.shape>
  );

  server.registerTool(
    'search_exported_data',
    {
      title: 'Search Exported Data',
      description:
        'Queries captured or generated artifacts via filters (status codes, domains, time ranges, and free-text search).',
      inputSchema: searchExportedDataSchema.shape
    },
    makeNotImplementedHandler('search_exported_data') as ToolCallback<typeof searchExportedDataSchema.shape>
  );
};

const makeNotImplementedHandler = (name: ToolName): ToolCallback<any> => {
  return async (..._unused: unknown[]) => ({
    content: [
      {
        type: 'text' as const,
        text: `The ${name} tool is not available yet. Follow the roadmap in docs/PLAN.md to implement it.`
      }
    ],
    isError: true
  });
};

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return { message: String(error) };
};

const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
  const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
  if (meta) {
    console.error(prefix, JSON.stringify(meta));
    return;
  }

  console.error(prefix);
};

let isShuttingDown = false;

const shutdown = async (signal?: NodeJS.Signals) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  log('info', 'Shutting down MCP server.', signal ? { signal } : undefined);

  try {
    if (server.isConnected()) {
      await server.close();
    }
  } catch (error) {
    log('error', 'Error while closing server.', { error: serializeError(error) });
  }

  try {
    await transport.close();
  } catch (error) {
    log('warn', 'Error while closing stdio transport.', { error: serializeError(error) });
  }

  if (signal) {
    process.exit(0);
  }
};

const main = async () => {
  registerPlaceholderTools();
  await server.connect(transport);
  log('info', 'MCP Network Analyzer server is ready for connections.');
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', error => {
  log('error', 'Uncaught exception.', { error: serializeError(error) });
  void shutdown();
});
process.on('unhandledRejection', reason => {
  log('error', 'Unhandled promise rejection.', { error: serializeError(reason) });
});

main().catch(error => {
  log('error', 'Fatal error during MCP server startup.', { error: serializeError(error) });
  void shutdown();
});