#!/usr/bin/env node
/**
 * Install MCP Network Analyzer to Claude Desktop (cross-platform)
 * Supports macOS, Linux, and Windows
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

function getClaudeConfigDir() {
  const os = platform();
  if (os === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Claude');
  } else if (os === 'linux') {
    return join(homedir(), '.config', 'Claude');
  } else if (os === 'win32') {
    const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
    return join(appData, 'Claude');
  } else {
    console.error(`❌ Unsupported operating system: ${os}`);
    process.exit(1);
  }
}

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

// Backup existing config
if (existsSync(configFile)) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const backupFile = `${configFile}.backup.${timestamp}`;
  console.log(`📋 Backing up existing config to:\n   ${backupFile}\n`);
  copyFileSync(configFile, backupFile);
}

// Read existing config or start fresh
let config = { mcpServers: {} };
if (existsSync(configFile)) {
  try {
    config = JSON.parse(readFileSync(configFile, 'utf-8'));
    if (!config.mcpServers) config.mcpServers = {};
  } catch {
    // Keep defaults
  }
}

// Load env vars from .env if present
const env = {};
const envPath = join(PROJECT_ROOT, '.env');
if (existsSync(envPath)) {
  console.log('📦 Loading configuration from .env file...\n');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  }
}

config.mcpServers['network-analyzer'] = {
  command: 'node',
  args: [join(PROJECT_ROOT, 'dist', 'index.js')],
  ...(Object.keys(env).length > 0 ? { env } : {})
};

writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf-8');

console.log('✅ Installation complete!\n');
console.log(`📍 Configuration saved to:\n   ${configFile}\n`);
console.log('🔄 Next steps:');
console.log('1. Restart Claude Desktop');
console.log("2. Look for 'network-analyzer' in available MCP servers");
console.log("3. Try: 'Capture network traffic from https://example.com'\n");
console.log("💡 Tip: Run 'pnpm run status' to check your setup\n");
