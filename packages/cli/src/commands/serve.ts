import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';

import { CliContext } from '@mcp-network-analyzer/core';
import { startServer } from '../index.js';

type ServeMode = 'auto' | 'stdio' | 'http';

function parseServeMode(args: string[]): ServeMode {
  const idx = args.findIndex(arg => arg === '--mode' || arg === '-m');
  if (idx !== -1) {
    const value = args[idx + 1];
    if (value === 'auto' || value === 'stdio' || value === 'http') {
      return value;
    }
    throw new Error('Invalid --mode value. Use one of: auto, stdio, http');
  }
  return 'auto';
}

function resolveProEntry(projectRoot: string): string | null {
  const localWorkspacePath = join(projectRoot, '..', 'pro', 'dist', 'index.js');
  if (existsSync(localWorkspacePath)) {
    return localWorkspacePath;
  }

  try {
    const require = createRequire(import.meta.url);
    return require.resolve('mcp-network-analyzer-pro');
  } catch {
    return null;
  }
}

async function runProHttpServer(projectRoot: string): Promise<void> {
  const proEntry = resolveProEntry(projectRoot);
  if (!proEntry) {
    throw new Error(
      'HTTP mode requires mcp-network-analyzer-pro. Install/build pro or use `netcap serve --mode stdio`.'
    );
  }

  const proModule = (await import(pathToFileURL(proEntry).href)) as {
    startServer?: (projectRoot?: string) => Promise<void>;
  };

  if (typeof proModule.startServer !== 'function') {
    throw new Error(`Could not load startServer() from ${proEntry}`);
  }

  await proModule.startServer(projectRoot);
}

export async function runServeCommand(context: CliContext, args: string[] = []): Promise<void> {
  const mode = parseServeMode(args);

  if (mode === 'stdio') {
    await startServer(context.projectRoot);
    return;
  }

  if (mode === 'http') {
    await runProHttpServer(context.projectRoot);
    return;
  }

  // auto mode: default to stdio unless explicitly requested through env.
  if (process.env.MCP_TRANSPORT === 'http' || process.env.NETCAP_TRANSPORT === 'http') {
    try {
      await runProHttpServer(context.projectRoot);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`⚠️  ${message}`);
      console.error('ℹ️  Falling back to stdio mode.');
    }
  }

  await startServer(context.projectRoot);
}
