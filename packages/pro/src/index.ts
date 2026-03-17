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
import { registerQueryTools } from './tools/query.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version?: string };

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

function buildUsageInstructions(): string {
  return [
    'Workflow overview:',
    '1. capture_network_requests → 2. analyze_captured_data → 3. discover_api_patterns → 4. search_exported_data.',
    'All captured artifacts live under data/. Keep STDOUT clean; use tool responses or STDERR logs for diagnostics.'
  ].join('\n');
}

async function main() {
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

  const httpServer = app.listen(PORT, HOST, () => {
    console.error(`[HTTP] MCP Network Analyzer Pro listening on http://${HOST}:${PORT}/mcp (Streamable HTTP)`);
    console.error(`[HTTP] Health check: http://${HOST}:${PORT}/health`);
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

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
