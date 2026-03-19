#!/usr/bin/env node
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createCli } from '@mcp-network-analyzer/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

createCli({
  binName: 'netcap',
  getVersion: () => version,
  projectRoot: process.env.MCP_CLI_PROJECT_ROOT ?? join(__dirname, '..'),
  extensions: [
    {
      command: 'setup',
      description: 'Run setup wizard and profile management',
      run: async (context, args) => {
        const { runSetupCommand } = await import('./commands/setup.js');
        await runSetupCommand(context, args);
      },
    },
    {
      command: 'serve',
      description: 'Start MCP server (stdio by default, optional HTTP via pro)',
      helpLines: [
        '  --mode, -m <mode>      Transport mode: auto | stdio | http',
        '                         auto defaults to stdio unless MCP_TRANSPORT=http',
      ],
      run: async (context, args) => {
        const { runServeCommand } = await import('./commands/serve.js');
        await runServeCommand(context, args);
      },
    },
  ],
}).run(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
