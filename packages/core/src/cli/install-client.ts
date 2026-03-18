/**
 * Multi-client MCP installer.
 *
 * Detects installed MCP clients and installs the network-analyzer server
 * using the client's native interface where available (CLI commands), or
 * by editing the client's config file directly.
 *
 * Supported clients:
 *   • Claude Desktop   — config file  (claude_desktop_config.json)
 *   • VS Code          — config file  (.vscode/mcp.json or user mcp.json)
 *   • Claude Code CLI  — native CLI   (claude mcp add ...)
 *   • Gemini CLI       — native CLI   (gemini mcp add ...)
 *   • OpenAI Codex CLI — native CLI   (codex mcp add ...)
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import { CliContext, loadEnvFile } from './common.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface McpClientInfo {
  id: string;
  name: string;
  detected: boolean;
  detectionHint: string;
}

interface InstallTarget {
  id: string;
  label: string;
  clientId: string;
}

// ── Path helpers ──────────────────────────────────────────────────────────────

function getClaudeDesktopConfigDir(): string {
  const os = platform();
  if (os === 'darwin') return join(homedir(), 'Library', 'Application Support', 'Claude');
  if (os === 'linux') return join(homedir(), '.config', 'Claude');
  if (os === 'win32') {
    const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
    return join(appData, 'Claude');
  }
  return '';
}

function getVsCodeUserConfigDir(): string {
  const os = platform();
  if (os === 'darwin') return join(homedir(), 'Library', 'Application Support', 'Code', 'User');
  if (os === 'linux') return join(homedir(), '.config', 'Code', 'User');
  if (os === 'win32') {
    const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
    return join(appData, 'Code', 'User');
  }
  return '';
}

// ── Detection ─────────────────────────────────────────────────────────────────

function commandExists(cmd: string): string | null {
  const which = platform() === 'win32' ? 'where' : 'which';
  const result = spawnSync(which, [cmd], { stdio: 'pipe', encoding: 'utf-8' });
  if (result.status === 0) {
    const path = (result.stdout as string).trim().split('\n')[0];
    return path || cmd;
  }
  return null;
}

export function detectMcpClients(): McpClientInfo[] {
  const claudeDir = getClaudeDesktopConfigDir();
  const vsCodeDir = getVsCodeUserConfigDir();

  // Claude Desktop — check if config directory exists
  const claudeDesktopDetected = claudeDir !== '' && existsSync(claudeDir);

  // VS Code — check user data dir OR `code` in PATH OR macOS .app bundle
  let vsCodeHint = 'not found';
  let vsCodeDetected = false;
  const codePath = commandExists('code');
  if (codePath) {
    vsCodeDetected = true;
    vsCodeHint = codePath;
  } else if (platform() === 'darwin' && existsSync('/Applications/Visual Studio Code.app')) {
    vsCodeDetected = true;
    vsCodeHint = '/Applications/Visual Studio Code.app';
  } else if (vsCodeDir && existsSync(vsCodeDir)) {
    vsCodeDetected = true;
    vsCodeHint = vsCodeDir;
  }

  // CLI-based clients
  const claudePath = commandExists('claude');
  const geminiPath = commandExists('gemini');
  const codexPath = commandExists('codex');

  return [
    {
      id: 'claude-desktop',
      name: 'Claude Desktop',
      detected: claudeDesktopDetected,
      detectionHint: claudeDesktopDetected ? claudeDir : 'config dir not found',
    },
    {
      id: 'vscode',
      name: 'VS Code (GitHub Copilot)',
      detected: vsCodeDetected,
      detectionHint: vsCodeHint,
    },
    {
      id: 'claude-code',
      name: 'Claude Code',
      detected: claudePath !== null,
      detectionHint: claudePath ?? 'not found',
    },
    {
      id: 'gemini',
      name: 'Gemini CLI',
      detected: geminiPath !== null,
      detectionHint: geminiPath ?? 'not found',
    },
    {
      id: 'codex',
      name: 'OpenAI Codex CLI',
      detected: codexPath !== null,
      detectionHint: codexPath ?? 'not found',
    },
  ];
}

// ── Install target builder ────────────────────────────────────────────────────

function buildInstallTargets(clients: McpClientInfo[]): InstallTarget[] {
  const targets: InstallTarget[] = [];

  for (const client of clients.filter(c => c.detected)) {
    switch (client.id) {
      case 'claude-desktop':
        targets.push({ id: 'claude-desktop', label: 'Claude Desktop  (config file)', clientId: client.id });
        break;
      case 'vscode':
        targets.push({ id: 'vscode-user', label: 'VS Code — user profile  (global)', clientId: client.id });
        targets.push({ id: 'vscode-workspace', label: 'VS Code — workspace  (.vscode/mcp.json)', clientId: client.id });
        break;
      case 'claude-code':
        targets.push({ id: 'claude-code-user', label: 'Claude Code — user scope  (claude mcp add --scope user)', clientId: client.id });
        targets.push({ id: 'claude-code-project', label: 'Claude Code — project scope  (.mcp.json)', clientId: client.id });
        break;
      case 'gemini':
        targets.push({ id: 'gemini-user', label: 'Gemini CLI — user scope  (gemini mcp add --scope user)', clientId: client.id });
        targets.push({ id: 'gemini-project', label: 'Gemini CLI — project scope  (.gemini/settings.json)', clientId: client.id });
        break;
      case 'codex':
        targets.push({ id: 'codex-user', label: 'OpenAI Codex — user scope  (codex mcp add)', clientId: client.id });
        break;
    }
  }

  return targets;
}

// ── Per-client installers ─────────────────────────────────────────────────────

// Shared config type for Claude Desktop
interface ClaudeDesktopConfig {
  mcpServers?: Record<string, { command: string; args: string[]; env?: Record<string, string> }>;
}

async function installToClaudeDesktop(context: CliContext): Promise<void> {
  const configDir = getClaudeDesktopConfigDir();
  const configFile = join(configDir, 'claude_desktop_config.json');

  console.log('\n🔧 Installing to Claude Desktop...');

  if (!existsSync(configDir)) {
    console.error(`❌ Claude Desktop not found at: ${configDir}`);
    console.error('   Install it from: https://claude.ai/download');
    return;
  }

  mkdirSync(configDir, { recursive: true });

  if (existsSync(configFile)) {
    const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const backup = `${configFile}.backup.${ts}`;
    copyFileSync(configFile, backup);
    console.log(`   📋 Backup saved to: ${backup}`);
  }

  let config: ClaudeDesktopConfig = { mcpServers: {} };
  if (existsSync(configFile)) {
    try {
      const parsed = JSON.parse(readFileSync(configFile, 'utf-8')) as ClaudeDesktopConfig;
      config = parsed;
      if (!config.mcpServers) config.mcpServers = {};
    } catch {
      config = { mcpServers: {} };
    }
  }

  const env = await loadEnvFile(context.projectRoot);
  const serverEntry = join(context.projectRoot, 'dist', 'index.js');

  config.mcpServers!['network-analyzer'] = {
    command: process.execPath,
    args: [serverEntry],
    ...(Object.keys(env).length > 0 ? { env } : {}),
  };

  writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf-8');

  console.log(`✅ Done!  Config: ${configFile}`);
  console.log('   → Restart Claude Desktop to pick up the new server.');
}

// Shared VS Code mcp.json format (uses "servers" not "mcpServers")
interface VsCodeMcpConfig {
  servers?: Record<string, { type: string; command: string; args: string[]; env?: Record<string, string> }>;
}

async function writeVsCodeConfig(mcpFile: string, context: CliContext): Promise<void> {
  let config: VsCodeMcpConfig = { servers: {} };
  if (existsSync(mcpFile)) {
    try {
      const parsed = JSON.parse(readFileSync(mcpFile, 'utf-8')) as VsCodeMcpConfig;
      config = parsed;
      if (!config.servers) config.servers = {};
    } catch {
      config = { servers: {} };
    }
  }

  const env = await loadEnvFile(context.projectRoot);
  const serverEntry = join(context.projectRoot, 'dist', 'index.js');

  config.servers!['network-analyzer'] = {
    type: 'stdio',
    command: process.execPath,
    args: [serverEntry],
    ...(Object.keys(env).length > 0 ? { env } : {}),
  };

  mkdirSync(join(mcpFile, '..'), { recursive: true });
  writeFileSync(mcpFile, JSON.stringify(config, null, 2), 'utf-8');
}

async function installToVsCodeUser(context: CliContext): Promise<void> {
  console.log('\n🔧 Installing to VS Code (user profile)...');

  const configDir = getVsCodeUserConfigDir();
  if (!configDir || !existsSync(configDir)) {
    console.error('❌ VS Code user config directory not found. Is VS Code installed?');
    return;
  }

  const mcpFile = join(configDir, 'mcp.json');
  await writeVsCodeConfig(mcpFile, context);

  console.log(`✅ Done!  Config: ${mcpFile}`);
  console.log('   → Reload VS Code or run "MCP: List Servers" from the Command Palette.');
}

async function installToVsCodeWorkspace(context: CliContext): Promise<void> {
  console.log('\n🔧 Installing to VS Code workspace (.vscode/mcp.json)...');

  const vscodeDir = join(process.cwd(), '.vscode');
  const mcpFile = join(vscodeDir, 'mcp.json');
  await writeVsCodeConfig(mcpFile, context);

  console.log(`✅ Done!  Config: ${mcpFile}`);
  console.log('   → This file can be committed to share the server config with your team.');
  console.log('   → Reload VS Code window to pick up the new server.');
}

function buildEnvArgs(env: Record<string, string>, flag: string): string[] {
  return Object.entries(env).flatMap(([k, v]) => [flag, `${k}=${v}`]);
}

async function installViaClaudeCode(context: CliContext, scope: 'user' | 'project'): Promise<void> {
  console.log(`\n🔧 Installing to Claude Code (${scope} scope)...`);

  const env = await loadEnvFile(context.projectRoot);
  const serverEntry = join(context.projectRoot, 'dist', 'index.js');

  const args = [
    'mcp', 'add',
    '--scope', scope,
    ...buildEnvArgs(env, '--env'),
    'network-analyzer',
    '--',
    process.execPath,
    serverEntry,
  ];

  console.log(`   $ claude ${args.join(' ')}`);
  const result = spawnSync('claude', args, { stdio: 'inherit', encoding: 'utf-8' });

  if (result.status !== 0) {
    console.error('❌ claude mcp add failed.');
    return;
  }

  console.log('\n✅ Done!');
  if (scope === 'user') {
    console.log('   → Server available across all projects in Claude Code.');
  } else {
    console.log('   → Server config saved to .mcp.json in the current directory.');
  }
}

async function installViaGeminiCli(context: CliContext, scope: 'user' | 'project'): Promise<void> {
  console.log(`\n🔧 Installing to Gemini CLI (${scope} scope)...`);

  const env = await loadEnvFile(context.projectRoot);
  const serverEntry = join(context.projectRoot, 'dist', 'index.js');

  const args = [
    'mcp', 'add',
    '--scope', scope,
    ...buildEnvArgs(env, '-e'),
    'network-analyzer',
    process.execPath,
    serverEntry,
  ];

  console.log(`   $ gemini ${args.join(' ')}`);
  const result = spawnSync('gemini', args, { stdio: 'inherit', encoding: 'utf-8' });

  if (result.status !== 0) {
    console.error('❌ gemini mcp add failed.');
    return;
  }

  console.log('\n✅ Done!');
  if (scope === 'user') {
    console.log('   → Server saved to ~/.gemini/settings.json');
  } else {
    console.log('   → Server saved to .gemini/settings.json in the current directory.');
  }
}

async function installViaCodex(context: CliContext): Promise<void> {
  console.log('\n🔧 Installing to OpenAI Codex CLI...');

  const env = await loadEnvFile(context.projectRoot);
  const serverEntry = join(context.projectRoot, 'dist', 'index.js');

  const args = [
    'mcp', 'add',
    ...buildEnvArgs(env, '--env'),
    'network-analyzer',
    '--',
    process.execPath,
    serverEntry,
  ];

  console.log(`   $ codex ${args.join(' ')}`);
  const result = spawnSync('codex', args, { stdio: 'inherit', encoding: 'utf-8' });

  if (result.status !== 0) {
    console.error('❌ codex mcp add failed.');
    return;
  }

  console.log('\n✅ Done!  Server saved to ~/.codex/config.toml');
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

async function installToTarget(targetId: string, context: CliContext): Promise<void> {
  switch (targetId) {
    case 'claude-desktop':   return installToClaudeDesktop(context);
    case 'vscode-user':      return installToVsCodeUser(context);
    case 'vscode-workspace': return installToVsCodeWorkspace(context);
    case 'claude-code-user': return installViaClaudeCode(context, 'user');
    case 'claude-code-project': return installViaClaudeCode(context, 'project');
    case 'gemini-user':      return installViaGeminiCli(context, 'user');
    case 'gemini-project':   return installViaGeminiCli(context, 'project');
    case 'codex-user':       return installViaCodex(context);
    default:
      console.error(`❌ Unknown install target: ${targetId}`);
  }
}

// ── Main command ──────────────────────────────────────────────────────────────

function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve));
}

export async function runInstallCommand(context: CliContext, args: string[]): Promise<void> {
  // Support --client <id> for non-interactive use
  const clientFlagIdx = args.indexOf('--client');
  const specificClient = clientFlagIdx >= 0 ? args[clientFlagIdx + 1] : undefined;

  console.log('🔍 Scanning for MCP clients...\n');

  const clients = detectMcpClients();
  const maxNameLen = Math.max(...clients.map(c => c.name.length));

  for (const c of clients) {
    const icon = c.detected ? '✅' : '❌';
    const hint = c.detected ? `— ${c.detectionHint}` : '— not detected';
    console.log(`  ${icon}  ${c.name.padEnd(maxNameLen)}  ${hint}`);
  }
  console.log('');

  const targets = buildInstallTargets(clients);

  if (targets.length === 0) {
    console.log('No supported MCP clients detected.\n');
    console.log('Install one of:');
    console.log('  • Claude Desktop  https://claude.ai/download');
    console.log('  • VS Code         https://code.visualstudio.com');
    console.log('  • Claude Code     npm install -g @anthropic-ai/claude-code');
    console.log('  • Gemini CLI      npm install -g @google/gemini-cli');
    console.log('  • OpenAI Codex    npm install -g @openai/codex');
    return;
  }

  // Non-interactive: --client flag
  if (specificClient) {
    const matching = targets.filter(t => t.id === specificClient || t.clientId === specificClient);
    if (matching.length === 0) {
      console.error(`❌ Client "${specificClient}" not detected or not supported.`);
      process.stderr.write(`Available targets: ${targets.map(t => t.id).join(', ')}\n`);
      process.exit(1);
    }
    for (const t of matching) {
      await installToTarget(t.id, context);
    }
    return;
  }

  // Interactive selection
  console.log('Available install targets:\n');
  targets.forEach((t, i) => console.log(`  ${i + 1}. ${t.label}`));
  console.log(`  A. All detected clients (user/global scope where applicable)`);
  console.log('');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await ask(rl, 'Install to (number or A): ')).trim().toLowerCase();
  rl.close();

  if (answer === 'a' || answer === 'all') {
    // Pick the first (user-scope) target for each client
    const seenClient = new Set<string>();
    for (const t of targets) {
      if (!seenClient.has(t.clientId)) {
        seenClient.add(t.clientId);
        await installToTarget(t.id, context);
      }
    }
    return;
  }

  const idx = parseInt(answer, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= targets.length) {
    console.error('❌ Invalid selection.');
    process.exit(1);
  }

  await installToTarget(targets[idx].id, context);
}
