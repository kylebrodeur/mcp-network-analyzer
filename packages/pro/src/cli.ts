#!/usr/bin/env node
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createCli } from '@mcp-network-analyzer/core';
import { runServeCommand } from './commands/serve.js';
import { runSetupCommand } from './commands/setup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

createCli({
  binName: 'mcp-network-analyzer-pro',
  getVersion: () => version,
  projectRoot: process.env.MCP_CLI_PROJECT_ROOT ?? join(__dirname, '..'),
  extensions: [
    { command: 'setup', description: 'Run setup wizard and profile management', run: runSetupCommand },
    { command: 'serve',  description: 'Start MCP HTTP server',                   run: runServeCommand  },
  ],
}).run(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
