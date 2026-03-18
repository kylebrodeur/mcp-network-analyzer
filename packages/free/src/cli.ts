#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { CliContext, runInstallClaudeCommand, runResetCommand, runStatusCommand } from '@mcp-network-analyzer/core';
import { runServeCommand } from './commands/serve.js';
import { runSetupCommand } from './commands/setup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

function buildContext(): CliContext {
  return {
    projectRoot: process.env.MCP_CLI_PROJECT_ROOT || join(__dirname, '..')
  };
}

function printHelp(): void {
  console.log('mcp-network-analyzer <command> [options]');
  console.log('');
  console.log('Commands:');
  console.log('  setup          Run setup wizard and profile management');
  console.log('  status         Show build and configuration health');
  console.log('  install-claude Install Claude Desktop MCP config entry');
  console.log('  reset          Clear config/data with confirmation prompts');
  console.log('  serve          Start MCP stdio server');
  console.log('');
  console.log('Global options:');
  console.log('  -h, --help     Show help');
  console.log('  -v, --version  Show package version');
}

function printVersion(): void {
  const pkg = require('../package.json') as { version?: string };
  console.log(pkg.version ?? '0.0.0');
}

export async function runCli(argv: string[]): Promise<void> {
  const context = buildContext();
  const [command, ...rest] = argv;

  if (!command) {
    const hasConfig = existsSync(join(context.projectRoot, '.env'));
    if (hasConfig) {
      await runStatusCommand(context);
    } else {
      await runSetupCommand(context, []);
    }
    return;
  }

  if (command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    return;
  }

  if (command === '--version' || command === '-v' || command === 'version') {
    printVersion();
    return;
  }

  switch (command) {
    case 'setup':
      await runSetupCommand(context, rest);
      return;
    case 'status':
      await runStatusCommand(context);
      return;
    case 'install-claude':
      await runInstallClaudeCommand(context);
      return;
    case 'reset':
      await runResetCommand(context, rest);
      return;
    case 'serve':
      await runServeCommand(context);
      return;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCli(process.argv.slice(2)).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
