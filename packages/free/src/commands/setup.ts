import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';

import { CliContext, loadProfiles, saveProfiles, writeEnvFile, loadEnvFile } from '@mcp-network-analyzer/core';

interface SetupConfig {
  mode: string;
  env: Record<string, string>;
}

function log(message: string, emoji = '✓'): void {
  console.log(`${emoji} ${message}`);
}

function header(title: string): void {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(50)}\n`);
}

export async function activateProfile(context: CliContext, profileName: string): Promise<boolean> {
  const data = await loadProfiles(context.projectRoot);

  if (!data.profiles[profileName]) {
    console.error(`❌ Profile "${profileName}" not found.`);
    return false;
  }

  const profile = data.profiles[profileName];
  await writeEnvFile(context.projectRoot, profile.env);

  data.active = profileName;
  await saveProfiles(context.projectRoot, data);

  log(`Switched to profile: ${profileName} (${profile.mode})`, '✓');
  return true;
}

export async function listProfiles(context: CliContext): Promise<void> {
  const data = await loadProfiles(context.projectRoot);

  if (Object.keys(data.profiles).length === 0) {
    console.log('\n📋 No saved profiles. Run setup to create one.\n');
    return;
  }

  console.log('\n📋 Saved Profiles:\n');

  for (const [name, profile] of Object.entries(data.profiles)) {
    const isActive = name === data.active ? '✓ (active)' : '';
    console.log(`  • ${name} - ${profile.mode} ${isActive}`);
    if (profile.description) {
      console.log(`    ${profile.description}`);
    }
  }

  console.log('\n💡 Switch profiles: mcp-network-analyzer setup --switch <name>\n');
}

async function setupLocal(ask: (prompt: string) => Promise<string>): Promise<SetupConfig> {
  header('💾 Local Storage Setup');

  console.log('Local storage will save data to your computer.');
  console.log('Location: ./data directory\n');

  const customPath = await ask('Custom data directory? (leave empty for ./data): ');

  const config: SetupConfig = { mode: 'local', env: {} };
  if (customPath.trim()) {
    config.env.MCP_NETWORK_ANALYZER_DATA = customPath.trim();
  }

  log('Local storage configured!');
  return config;
}

async function saveConfiguration(
  context: CliContext,
  ask: (prompt: string) => Promise<string>,
  config: SetupConfig,
  profileName: string | null = null
): Promise<boolean> {
  header('💾 Saving Configuration');

  let resolvedProfileName = profileName;
  if (!resolvedProfileName) {
    resolvedProfileName = (await ask('\nProfile name [local]: ')) || 'local';
  }

  const description = await ask('Description (optional): ');
  const saveChoice = await ask(
    '\nSave these settings?\n- Will create .env file (gitignored)\n- Will save profile for easy switching\n\n[Y/n]: '
  );

  if (saveChoice.toLowerCase() === 'n') {
    console.log('\n⚠️  Configuration not saved. You can run setup again anytime.');
    return false;
  }

  await writeEnvFile(context.projectRoot, config.env);
  log('.env file created', '✓');

  const profileData = await loadProfiles(context.projectRoot);
  profileData.profiles[resolvedProfileName] = {
    mode: config.mode,
    env: config.env,
    description: description || undefined,
    createdAt: new Date().toISOString()
  };
  profileData.active = resolvedProfileName;
  await saveProfiles(context.projectRoot, profileData);

  log(`Profile "${resolvedProfileName}" saved`, '✓');

  console.log('\n✓ Configuration saved!');
  console.log('\n💡 Switch profiles anytime: mcp-network-analyzer setup --switch <name>');
  return true;
}

async function showNextSteps(): Promise<void> {
  header('🎉 Setup Complete!');

  console.log('Next steps:\n');
  console.log('1. Build the project:');
  console.log('   pr build\n');
  console.log('2. Test with MCP Inspector:');
  console.log('   npx @modelcontextprotocol/inspector node dist/index.js\n');
  console.log('3. Install to Claude Desktop:');
  console.log('   mcp-network-analyzer install-claude\n');
  console.log('4. Check status anytime:');
  console.log('   mcp-network-analyzer status\n');
}

export async function setDataDir(context: CliContext, inputPath: string): Promise<void> {
  const resolvedPath = resolve(inputPath);

  try {
    await mkdir(resolvedPath, { recursive: true });
  } catch (error) {
    console.error(`❌ Cannot create directory "${resolvedPath}": ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const env = await loadEnvFile(context.projectRoot);
  env.MCP_NETWORK_ANALYZER_DATA = resolvedPath;
  await writeEnvFile(context.projectRoot, env);
  log('.env updated', '✓');

  const data = await loadProfiles(context.projectRoot);
  if (data.active && data.profiles[data.active]) {
    data.profiles[data.active].env.MCP_NETWORK_ANALYZER_DATA = resolvedPath;
    await saveProfiles(context.projectRoot, data);
    log(`Profile "${data.active}" updated`, '✓');
  }

  console.log(`\n✓ Data directory set to: ${resolvedPath}`);
  console.log('  Restart the MCP server for the change to take effect.\n');
}

export async function showConfig(context: CliContext): Promise<void> {
  header('⚙️  Current Configuration');

  const envPathExists = existsSync(`${context.projectRoot}/.env`);
  if (!envPathExists) {
    console.log('  No .env file found. Run setup to create one.\n');
    return;
  }

  const env = await loadEnvFile(context.projectRoot);
  const relevant = ['MCP_NETWORK_ANALYZER_DATA', 'MCP_STORAGE_MODE'];

  console.log('  .env values:\n');
  for (const key of relevant) {
    if (env[key]) {
      console.log(`    ${key}=${env[key]}`);
    }
  }

  const data = await loadProfiles(context.projectRoot);
  if (data.active) {
    console.log(`\n  Active profile: ${data.active} (${data.profiles[data.active]?.mode ?? 'unknown'})`);
    console.log('  Switch profiles: mcp-network-analyzer setup --switch <name>');
  }
  console.log('');
}

function printSetupUsage(): void {
  console.log('Usage: mcp-network-analyzer setup [options]');
  console.log('  --switch, -s <name>   Switch active profile');
  console.log('  --list, -l            List saved profiles');
  console.log('  --data-dir, -d <dir>  Set data directory non-interactively');
  console.log('  --show-config, -c     Print current .env/profile configuration');
}

export async function runSetupCommand(context: CliContext, args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    printSetupUsage();
    return;
  }

  if (args.includes('--switch') || args.includes('-s')) {
    const switchIdx = args.indexOf('--switch') !== -1 ? args.indexOf('--switch') : args.indexOf('-s');
    const profileName = args[switchIdx + 1];

    if (!profileName) {
      console.error('❌ --switch requires a profile name.');
      process.exit(1);
    }

    const success = await activateProfile(context, profileName);
    process.exit(success ? 0 : 1);
  }

  if (args.includes('--list') || args.includes('-l')) {
    await listProfiles(context);
    return;
  }

  if (args.includes('--data-dir') || args.includes('-d')) {
    const flagIdx = args.indexOf('--data-dir') !== -1 ? args.indexOf('--data-dir') : args.indexOf('-d');
    const dirPath = args[flagIdx + 1];

    if (!dirPath) {
      console.error('❌ --data-dir requires a path argument.');
      process.exit(1);
    }

    await setDataDir(context, dirPath);
    return;
  }

  if (args.includes('--show-config') || args.includes('-c')) {
    await showConfig(context);
    return;
  }

  console.log('\n🔧 MCP Network Analyzer - Setup Wizard\n');
  console.log('This wizard will help you configure the network analyzer.\n');

  const existingProfiles = await loadProfiles(context.projectRoot);
  if (Object.keys(existingProfiles.profiles).length > 0) {
    console.log('📋 Existing profiles:');
    for (const [name, profile] of Object.entries(existingProfiles.profiles)) {
      const isActive = name === existingProfiles.active ? '✓' : ' ';
      console.log(`  [${isActive}] ${name} - ${profile.mode}`);
    }
    console.log('');
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (prompt: string): Promise<string> => new Promise(resolve => rl.question(prompt, resolve));

  try {
    const config = await setupLocal(ask);
    const saved = await saveConfiguration(context, ask, config);
    if (saved) {
      await showNextSteps();
    }
  } finally {
    rl.close();
  }
}
