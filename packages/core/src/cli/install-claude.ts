import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

import { CliContext, loadEnvFile } from './common.js';

interface ClaudeConfig {
  mcpServers?: Record<string, { command: string; args: string[]; env?: Record<string, string> }>;
}

function getClaudeConfigDir(): string {
  const os = platform();
  if (os === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Claude');
  }
  if (os === 'linux') {
    return join(homedir(), '.config', 'Claude');
  }
  if (os === 'win32') {
    const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
    return join(appData, 'Claude');
  }

  throw new Error(`Unsupported operating system: ${os}`);
}

export async function runInstallClaudeCommand(context: CliContext): Promise<void> {
  const configDir = getClaudeConfigDir();
  const configFile = join(configDir, 'claude_desktop_config.json');

  console.log('🔧 Installing MCP Network Analyzer to Claude Desktop...\n');

  if (!existsSync(configDir)) {
    console.error(`❌ Claude Desktop not found at: ${configDir}`);
    console.error('\nPlease install Claude Desktop first:');
    console.error('https://claude.ai/download');
    process.exit(1);
  }

  mkdirSync(configDir, { recursive: true });

  if (existsSync(configFile)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const backupFile = `${configFile}.backup.${timestamp}`;
    console.log(`📋 Backing up existing config to:\n   ${backupFile}\n`);
    copyFileSync(configFile, backupFile);
  }

  let config: ClaudeConfig = { mcpServers: {} };
  if (existsSync(configFile)) {
    try {
      const parsed = JSON.parse(readFileSync(configFile, 'utf-8')) as ClaudeConfig;
      config = parsed;
      if (!config.mcpServers) {
        config.mcpServers = {};
      }
    } catch {
      config = { mcpServers: {} };
    }
  }

  const env = await loadEnvFile(context.projectRoot);
  // Always use absolute node path + absolute server entry to survive GUI app environment.
  const serverEntry = join(context.projectRoot, 'dist', 'index.js');

  config.mcpServers = config.mcpServers ?? {};
  config.mcpServers['network-analyzer'] = {
    command: process.execPath,
    args: [serverEntry],
    ...(Object.keys(env).length > 0 ? { env } : {})
  };

  writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf-8');

  console.log('✅ Installation complete!\n');
  console.log(`📍 Configuration saved to:\n   ${configFile}\n`);
  console.log('🔄 Next steps:');
  console.log('1. Restart Claude Desktop');
  console.log("2. Look for 'network-analyzer' in available MCP servers");
  console.log("3. Try: 'Capture network traffic from https://example.com'\n");
}
