#!/usr/bin/env tsx

/**
 * Interactive setup wizard for MCP Network Analyzer (free edition)
 * Local storage only
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const PROFILES_PATH = join(PROJECT_ROOT, '.env.profiles.json');

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function log(message: string, emoji = '✓'): void {
  console.log(`${emoji} ${message}`);
}

function header(title: string): void {
  console.log('\n' + '='.repeat(50));
  console.log(`  ${title}`);
  console.log('='.repeat(50) + '\n');
}

interface Profile {
  mode: string;
  transport?: string;
  env: Record<string, string>;
  description?: string;
  createdAt: string;
}

interface ProfileData {
  profiles: Record<string, Profile>;
  active: string | null;
}

async function loadProfiles(): Promise<ProfileData> {
  try {
    if (existsSync(PROFILES_PATH)) {
      const data = await readFile(PROFILES_PATH, 'utf-8');
      return JSON.parse(data) as ProfileData;
    }
  } catch {
    // Ignore errors, return empty
  }
  return { profiles: {}, active: null };
}

async function saveProfiles(profiles: ProfileData): Promise<void> {
  await writeFile(PROFILES_PATH, JSON.stringify(profiles, null, 2), 'utf-8');
}

async function activateProfile(profileName: string): Promise<boolean> {
  const data = await loadProfiles();

  if (!data.profiles[profileName]) {
    console.error(`❌ Profile "${profileName}" not found.`);
    return false;
  }

  const profile = data.profiles[profileName];

  const envPath = join(PROJECT_ROOT, '.env');
  const envLines = Object.entries(profile.env).map(([key, value]) => `${key}=${value}`);
  await writeFile(envPath, envLines.join('\n') + '\n', 'utf-8');

  data.active = profileName;
  await saveProfiles(data);

  log(`Switched to profile: ${profileName} (${profile.mode})`, '✓');
  return true;
}

async function listProfiles(): Promise<void> {
  const data = await loadProfiles();

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

  console.log('\n💡 Switch profiles: pnpm run setup -- --switch <name>\n');
}

interface SetupConfig {
  mode: string;
  env: Record<string, string>;
}

async function setupLocal(): Promise<SetupConfig> {
  header('💾 Local Storage Setup');

  console.log('Local storage will save data to your computer.');
  console.log('Location: ./data directory\n');

  const customPath = await question('Custom data directory? (leave empty for ./data): ');

  const config: SetupConfig = { mode: 'local', env: {} };

  if (customPath.trim()) {
    config.env.MCP_NETWORK_ANALYZER_DATA = customPath.trim();
  }

  log('Local storage configured!');
  return config;
}

async function saveConfiguration(config: SetupConfig, profileName: string | null = null): Promise<boolean> {
  header('💾 Saving Configuration');

  if (!profileName) {
    profileName = (await question('\nProfile name [local]: ')) || 'local';
  }

  const description = await question('Description (optional): ');

  const saveChoice = await question('\nSave these settings?\n- Will create .env file (gitignored)\n- Will save profile for easy switching\n\n[Y/n]: ');

  if (saveChoice.toLowerCase() === 'n') {
    console.log('\n⚠️  Configuration not saved. You can run setup again anytime.');
    return false;
  }

  const envPath = join(PROJECT_ROOT, '.env');
  const envLines = Object.entries(config.env).map(([key, value]) => `${key}=${value}`);
  await writeFile(envPath, envLines.join('\n') + '\n', 'utf-8');
  log('.env file created', '✓');

  const profileData = await loadProfiles();
  profileData.profiles[profileName] = {
    mode: config.mode,
    env: config.env,
    description: description || undefined,
    createdAt: new Date().toISOString()
  };
  profileData.active = profileName;
  await saveProfiles(profileData);
  log(`Profile "${profileName}" saved`, '✓');

  console.log('\n✓ Configuration saved!');
  console.log(`\n💡 Switch profiles anytime: pnpm run setup -- --switch <name>`);
  return true;
}

async function showNextSteps(): Promise<void> {
  header('🎉 Setup Complete!');

  console.log('Next steps:\n');
  console.log('1. Build the project:');
  console.log('   pnpm run build\n');
  console.log('2. Test with MCP Inspector:');
  console.log('   npx @modelcontextprotocol/inspector node dist/index.js\n');
  console.log('3. Or install to Claude Desktop:');
  console.log('   pnpm run install-claude\n');
  console.log('4. Check status anytime:');
  console.log('   pnpm run status\n');
  console.log('Happy capturing! 🚀\n');
}

async function switchProfile(): Promise<void> {
  header('🔄 Switch Profile');

  const data = await loadProfiles();

  if (Object.keys(data.profiles).length === 0) {
    console.log('\n📋 No saved profiles. Run setup to create one.\n');
    return;
  }

  console.log('Available profiles:\n');
  for (const [name, profile] of Object.entries(data.profiles)) {
    const isActive = name === data.active ? '✓ (active)' : '';
    console.log(`  ${name} - ${profile.mode} ${isActive}`);
  }

  const choice = await question('\nProfile name (or "list" to see details): ');

  if (choice === 'list') {
    await listProfiles();
    rl.close();
    return;
  }

  const success = await activateProfile(choice);

  if (success) {
    console.log('\n✓ Profile activated! Changes take effect immediately.\n');
  }

  rl.close();
}

/**
 * Non-interactively update the data directory in .env and the active profile
 */
async function setDataDir(inputPath: string): Promise<void> {
  const resolvedPath = resolve(inputPath);

  try {
    await mkdir(resolvedPath, { recursive: true });
  } catch (error) {
    console.error(`❌ Cannot create directory "${resolvedPath}": ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const envPath = join(PROJECT_ROOT, '.env');
  let envContent = '';
  try {
    envContent = await readFile(envPath, 'utf-8');
  } catch { /* .env may not exist */ }

  const lines = envContent.split('\n');
  const idx = lines.findIndex(line => line.trimStart().startsWith('MCP_NETWORK_ANALYZER_DATA='));
  if (idx >= 0) {
    lines[idx] = `MCP_NETWORK_ANALYZER_DATA=${resolvedPath}`;
  } else {
    lines.push(`MCP_NETWORK_ANALYZER_DATA=${resolvedPath}`);
  }
  await writeFile(envPath, lines.join('\n'), 'utf-8');
  log(`.env updated`, '✓');

  const data = await loadProfiles();
  if (data.active && data.profiles[data.active]) {
    data.profiles[data.active].env.MCP_NETWORK_ANALYZER_DATA = resolvedPath;
    await saveProfiles(data);
    log(`Profile "${data.active}" updated`, '✓');
  }

  console.log(`\n✓ Data directory set to: ${resolvedPath}`);
  console.log('  Restart the MCP server for the change to take effect.\n');
}

/**
 * Print the current configuration from .env without running the wizard
 */
async function showConfig(): Promise<void> {
  header('⚙️  Current Configuration');

  const envPath = join(PROJECT_ROOT, '.env');
  let envContent = '';
  try {
    envContent = await readFile(envPath, 'utf-8');
  } catch {
    console.log('  No .env file found. Run setup to create one.\n');
    return;
  }

  const relevant = ['MCP_NETWORK_ANALYZER_DATA', 'MCP_STORAGE_MODE'];
  const parsed: Record<string, string> = {};
  for (const line of envContent.split('\n')) {
    if (!line.includes('=') || line.trim().startsWith('#')) continue;
    const [key, ...rest] = line.split('=');
    parsed[key.trim()] = rest.join('=').trim();
  }

  console.log('  .env values:\n');
  for (const key of relevant) {
    if (parsed[key]) {
      console.log(`    ${key}=${parsed[key]}`);
    }
  }

  const data = await loadProfiles();
  if (data.active) {
    console.log(`\n  Active profile: ${data.active} (${data.profiles[data.active]?.mode ?? 'unknown'})`);
    console.log('  Switch profiles: pnpm run setup -- --switch <name>');
  }
  console.log('');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--switch') || args.includes('-s')) {
    const switchIdx = args.indexOf('--switch') !== -1 ? args.indexOf('--switch') : args.indexOf('-s');
    const profileName = args[switchIdx + 1];

    if (profileName) {
      const success = await activateProfile(profileName);
      rl.close();
      process.exit(success ? 0 : 1);
    } else {
      await switchProfile();
      return;
    }
  }

  if (args.includes('--list') || args.includes('-l')) {
    await listProfiles();
    rl.close();
    return;
  }

  if (args.includes('--data-dir') || args.includes('-d')) {
    const flagIdx = args.indexOf('--data-dir') !== -1 ? args.indexOf('--data-dir') : args.indexOf('-d');
    const dirPath = args[flagIdx + 1];
    if (!dirPath) {
      console.error('❌ --data-dir requires a path argument. Example: pnpm run setup -- --data-dir /path/to/data');
      rl.close();
      process.exit(1);
    }
    await setDataDir(dirPath);
    rl.close();
    return;
  }

  if (args.includes('--show-config') || args.includes('-c')) {
    await showConfig();
    rl.close();
    return;
  }

  console.log('\n🔧 MCP Network Analyzer - Setup Wizard\n');
  console.log('This wizard will help you configure the network analyzer.\n');

  const existingProfiles = await loadProfiles();
  if (Object.keys(existingProfiles.profiles).length > 0) {
    console.log('📋 Existing profiles:');
    for (const [name, profile] of Object.entries(existingProfiles.profiles)) {
      const isActive = name === existingProfiles.active ? '✓' : ' ';
      console.log(`  [${isActive}] ${name} - ${profile.mode}`);
    }
    console.log('');
  }

  const config = await setupLocal();

  const saved = await saveConfiguration(config);

  if (saved) {
    await showNextSteps();
  }

  rl.close();
}

main().catch(error => {
  console.error('\n❌ Setup error:', error instanceof Error ? error.message : String(error));
  rl.close();
  process.exit(1);
});
