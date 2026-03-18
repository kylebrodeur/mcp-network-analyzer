import { copyFileSync, existsSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import { CliContext, getEnvPath, getProfilesPath } from './common.js';

function getClaudeConfigPath(): string {
  const os = platform();
  if (os === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  }
  if (os === 'linux') {
    return join(homedir(), '.config', 'Claude', 'claude_desktop_config.json');
  }
  if (os === 'win32') {
    const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
    return join(appData, 'Claude', 'claude_desktop_config.json');
  }
  return '';
}

async function askConfirmation(prompt: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise<string>(resolve => rl.question(prompt, resolve));
    return answer.trim().toLowerCase() !== 'n';
  } finally {
    rl.close();
  }
}

function removeClaudeEntry(configPath: string): boolean {
  if (!existsSync(configPath)) {
    return false;
  }

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
    if (!parsed.mcpServers?.['network-analyzer']) {
      return false;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    copyFileSync(configPath, `${configPath}.backup.${timestamp}`);

    delete parsed.mcpServers['network-analyzer'];
    writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

export async function runResetCommand(context: CliContext, args: string[]): Promise<void> {
  const force = args.includes('--force') || args.includes('-f');
  const scopeConfig = args.includes('--config');
  const scopeData = args.includes('--data');
  const scopeClaude = args.includes('--claude');
  const hasScope = scopeConfig || scopeData || scopeClaude;

  const envPath = getEnvPath(context.projectRoot);
  const profilesPath = getProfilesPath(context.projectRoot);
  const dataPaths = [join(context.projectRoot, 'mcp-network-data'), join(context.projectRoot, 'data')];
  const claudeConfigPath = getClaudeConfigPath();

  const clearConfig = hasScope
    ? scopeConfig
    : force || await askConfirmation('Clear .env and profile data? [Y/n]: ');
  const clearData = hasScope
    ? scopeData
    : force || await askConfirmation('Delete data directory contents? [y/N]: ');
  const clearClaude = hasScope
    ? scopeClaude
    : force || await askConfirmation('Remove Claude Desktop MCP entry? [y/N]: ');

  if (!force) {
    const proceed = await askConfirmation('This cannot be undone. Continue? [y/N]: ');
    if (!proceed) {
      console.log('Reset cancelled.');
      return;
    }
  }

  if (clearConfig) {
    if (existsSync(envPath)) {
      unlinkSync(envPath);
      console.log('✓ Removed .env file');
    }
    if (existsSync(profilesPath)) {
      unlinkSync(profilesPath);
      console.log('✓ Removed saved profiles');
    }
  }

  if (clearData) {
    let any = false;
    for (const dataPath of dataPaths) {
      if (existsSync(dataPath)) {
        rmSync(dataPath, { recursive: true, force: true });
        console.log(`✓ Removed data directory: ${dataPath}`);
        any = true;
      }
    }
    if (!any) {
      console.log('ℹ No data directory found to remove');
    }
  }

  if (clearClaude && claudeConfigPath) {
    const removed = removeClaudeEntry(claudeConfigPath);
    if (removed) {
      console.log('✓ Removed Claude Desktop network-analyzer entry');
    } else {
      console.log('ℹ No Claude Desktop network-analyzer entry found');
    }
  }

  console.log('✅ Reset complete.');
}
