#!/usr/bin/env node
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
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

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

const main = async () => {
  await Storage.ensureDirectories();
  await DatabaseService.getInstance().initialize();

  registerCaptureTool(server);
  registerAnalyzeTool(server);
  registerDiscoverTool(server);
  registerSearchTool(server);
  registerHelpTools(server);
  registerIdManagementTools(server);
  registerConfigTools(server);

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
