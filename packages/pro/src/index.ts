import express from 'express';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import {
  DatabaseService,
  Storage,
  loadEnvFile,
  registerAnalyzeTool,
  registerCaptureTool,
  registerConfigTools,
  registerDiscoverTool,
  registerHelpTools,
  registerIdManagementTools,
  registerSearchTool
} from '@mcp-network-analyzer/core';
import { registerQueryTools } from './tools/query.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version?: string };
const DEFAULT_PROJECT_ROOT = join(__dirname, '..');function buildUsageInstructions(): string {
  return [
    'Workflow overview:',
    '1. capture_network_requests → 2. analyze_captured_data → 3. discover_api_patterns → 4. search_exported_data.',
    'All captured artifacts live under data/. Keep STDOUT clean; use tool responses or STDERR logs for diagnostics.'
  ].join('\n');
}

export async function startServer(projectRoot = DEFAULT_PROJECT_ROOT): Promise<void> {
  const env = await loadEnvFile(projectRoot);
  for (const [key, value] of Object.entries(env)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0';

  await Storage.ensureDirectories();
  await DatabaseService.getInstance().initialize();

  const server = new McpServer(
    {
      name: 'mcp-network-analyzer-pro',
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

  registerCaptureTool(server);
  registerAnalyzeTool(server);
  registerDiscoverTool(server);
  registerSearchTool(server);
  registerHelpTools(server);
  registerIdManagementTools(server);
  registerConfigTools(server);
  registerQueryTools(server);

  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: packageJson.version });
  });

  app.post('/mcp', async (req, res) => {
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

  const httpServer = app.listen(port, host, () => {
    console.error(`[HTTP] MCP Network Analyzer Pro listening on http://${host}:${port}/mcp (Streamable HTTP)`);
    console.error(`[HTTP] Health check: http://${host}:${port}/health`);
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

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
