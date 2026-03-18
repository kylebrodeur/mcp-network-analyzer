import { CliContext } from '@mcp-network-analyzer/core';
import { startServer } from '../index.js';

export async function runServeCommand(context: CliContext): Promise<void> {
  await startServer(context.projectRoot);
}
