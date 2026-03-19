import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

async function loadEnvFile(projectRoot: string) {
  try {
    const envPath = join(projectRoot, '.env');
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

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
    DatabaseService,
    Storage,
    registerAnalyzeTool,
    registerCaptureTool,
    registerConfigTools,
    registerDiscoverTool,
    registerHelpTools,
    registerIdManagementTools,
    registerSearchTool
} from '@mcp-network-analyzer/core';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version?: string };

type LogLevel = 'info' | 'warn' | 'error';

function buildUsageInstructions(): string {
  return [
    'Workflow overview:',
    '1. capture_network_requests → 2. analyze_captured_data → 3. discover_api_patterns → 4. search_exported_data.',
    'All captured artifacts live under data/. Keep STDOUT clean; use tool responses or STDERR logs for diagnostics.'
  ].join('\n');
}

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
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

function registerQueryTools(server: McpServer): void {
  server.registerTool(
    'list_analyses',
    {
      title: 'List Analyses',
      description: 'List all analyses with optional filtering by status',
      inputSchema: z.object({
        limit: z.number().optional(),
        status: z.enum(['processing', 'complete', 'failed']).optional(),
      }).shape,
    },
    async ({ limit, status }) => {
      try {
        const db = DatabaseService.getInstance();
        const analyses = db.listAnalyses();
        let filtered = analyses;

        if (status) {
          filtered = filtered.filter(a => a.status === status);
        }

        if (limit) {
          filtered = filtered.slice(0, limit);
        }

        const payload = {
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
            errorCount: a.errorCount,
          })),
        };

        return {
          content: [{
            type: 'text' as const,
            text: `# Analyses\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``,
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
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
        status: z.enum(['processing', 'complete', 'failed']).optional(),
      }).shape,
    },
    async ({ limit, analysisId, status }) => {
      try {
        const db = DatabaseService.getInstance();
        const discoveries = db.listDiscoveries();
        let filtered = discoveries;

        if (analysisId) {
          filtered = filtered.filter(d => d.analysisId === analysisId);
        }

        if (status) {
          filtered = filtered.filter(d => d.status === status);
        }

        if (limit) {
          filtered = filtered.slice(0, limit);
        }

        const payload = {
          total: discoveries.length,
          filtered: filtered.length,
          discoveries: filtered.map(d => ({
            id: d.id,
            analysisId: d.analysisId,
            status: d.status,
            timestamp: d.timestamp,
            patternsFound: d.patternsFound,
            paginationDetected: d.paginationDetected,
            rateLimitingDetected: d.rateLimitingDetected,
          })),
        };

        return {
          content: [{
            type: 'text' as const,
            text: `# Discoveries\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``,
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'get_database_stats',
    {
      title: 'Get Database Statistics',
      description: 'Get overall statistics about the MCP database',
      inputSchema: {},
    },
    async () => {
      try {
        const db = DatabaseService.getInstance();
        const stats = db.getStats();
        return {
          content: [{
            type: 'text' as const,
            text: `# Database Statistics\n\n\`\`\`json\n${JSON.stringify(stats, null, 2)}\n\`\`\``,
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}

function createServer() {
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

  return { server, transport };
}

export async function startServer(projectRoot = PROJECT_ROOT): Promise<void> {
  await loadEnvFile(projectRoot);
  const { server, transport } = createServer();
  let isShuttingDown = false;

  const shutdown = async (signal?: NodeJS.Signals) => {
    if (isShuttingDown) return;
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

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', error => {
    log('error', 'Uncaught exception.', { error: serializeError(error) });
    void shutdown();
  });
  process.on('unhandledRejection', reason => {
    log('error', 'Unhandled promise rejection.', { error: serializeError(reason) });
  });

  await Storage.ensureDirectories();
  await DatabaseService.getInstance().initialize();

  registerCaptureTool(server);
  registerAnalyzeTool(server);
  registerDiscoverTool(server);
  registerSearchTool(server);
  registerQueryTools(server);
  registerHelpTools(server);
  registerIdManagementTools(server);
  registerConfigTools(server);

  await server.connect(transport);
  log('info', 'MCP Network Analyzer server is ready for connections.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer().catch(error => {
    log('error', 'Fatal error during MCP server startup.', { error: serializeError(error) });
    process.exit(1);
  });
}
