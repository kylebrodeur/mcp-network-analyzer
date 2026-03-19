/**
 * Server configuration tools
 * Allows users to inspect and update the data directory from within Claude
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { Config } from '../lib/config.js';
import { Storage } from '../lib/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ENV_PATH = join(PROJECT_ROOT, '.env');

/**
 * Update or add a single key in the .env file without clobbering other entries
 */
async function updateEnvFile(key: string, value: string): Promise<void> {
  let content = '';
  try {
    content = await readFile(ENV_PATH, 'utf-8');
  } catch {
    // .env may not exist yet — that's fine, we'll create it
  }

  const lines = content.split('\n');
  const idx = lines.findIndex(line => line.trimStart().startsWith(`${key}=`));

  if (idx >= 0) {
    lines[idx] = `${key}=${value}`;
  } else {
    lines.push(`${key}=${value}`);
  }

  await writeFile(ENV_PATH, lines.join('\n'), 'utf-8');
}

/**
 * Count immediate subdirectories (used for capture/analysis totals)
 */
async function countSubdirs(dir: string): Promise<number> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).length;
  } catch {
    return 0;
  }
}

function normalizeDirectoryInput(inputPath: string): string {
  const trimmed = inputPath.trim();
  if (trimmed === '~') {
    return homedir();
  }

  if (trimmed.startsWith('~/')) {
    return resolve(homedir(), trimmed.slice(2));
  }

  if (trimmed.startsWith('~\\')) {
    return resolve(homedir(), trimmed.slice(2));
  }

  return resolve(trimmed);
}

export function registerConfigTools(server: McpServer): void {
  // ── get_server_config ──────────────────────────────────────────────────────

  server.registerTool(
    'get_server_config',
    {
      title: 'Get Server Config',
      description:
        'Returns the current server configuration: active data directory, storage mode, and data statistics (capture and analysis counts).',
      inputSchema: {}
    },
    async () => {
      const dataDir = Storage.getDataDirectory();
      const mode = Storage.getMode();
      const captureCount = await countSubdirs(join(dataDir, 'captures'));
      const analysisCount = await countSubdirs(join(dataDir, 'analyses'));

      return {
        content: [
          {
            type: 'text' as const,
            text: [
              '# Server Configuration',
              '',
              `**Data Directory:** ${dataDir}`,
              `**Storage Mode:** ${mode}`,
              '',
              '## Data Statistics',
              `- Captures: ${captureCount}`,
              `- Analyses: ${analysisCount}`,
              '',
              '## Change Data Directory',
              'Use `set_data_directory` to change where data is stored.',
              'Or from a terminal: `pnpm run setup -- --data-dir /your/path`'
            ].join('\n')
          }
        ]
      };
    }
  );

  // ── set_data_directory ─────────────────────────────────────────────────────

  server.registerTool(
    'set_data_directory',
    {
      title: 'Set Data Directory',
      description:
        'Updates the directory where captures and analyses are stored. Takes effect immediately for new operations and is persisted to .env for future server restarts. Existing data in the previous directory is not moved.',
      inputSchema: z.object({
        path: z
          .string()
          .min(1)
          .describe('Absolute or relative path to the desired data directory')
      }).shape
    },
    async ({ path: inputPath }) => {
      const resolvedPath = normalizeDirectoryInput(inputPath);
      const previousDir = Storage.getDataDirectory();

      // Validate by attempting to create the directory
      try {
        await mkdir(resolvedPath, { recursive: true });
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to create or access directory "${resolvedPath}": ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }

      // Apply in-memory — next call to Storage.getAdapter() will re-read config
      process.env.MCP_NETWORK_ANALYZER_DATA = resolvedPath;
      Config.getInstance().updateConfig({ localDataDir: resolvedPath });
      Storage.resetAdapter();

      // Ensure subdirectory structure exists in the new location
      await Storage.ensureDirectories();

      // Persist to .env so the change survives a server restart
      await updateEnvFile('MCP_NETWORK_ANALYZER_DATA', resolvedPath);

      return {
        content: [
          {
            type: 'text' as const,
            text: [
              '# Data Directory Updated',
              '',
              `**Previous:** ${previousDir}`,
              `**New:** ${resolvedPath}`,
              '',
              'New captures and analyses will be saved to the new directory.',
              'The change has been persisted to .env and will survive server restarts.',
              '',
              '> Note: existing data in the previous directory is not moved.'
            ].join('\n')
          }
        ]
      };
    }
  );
}
