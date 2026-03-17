#!/usr/bin/env tsx

/**
 * Interactive setup wizard for MCP Network Analyzer
 * Guides users through initial configuration
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

async function validateHFToken(token: string): Promise<{ valid: boolean; username?: string }> {
  try {
    const response = await fetch('https://huggingface.co/api/whoami-v2', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json() as { name: string };
      return { valid: true, username: data.name };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

async function createHFDataset(token: string, repoName: string, isPrivate: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://huggingface.co/api/repos/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: repoName, type: 'dataset', private: isPrivate })
    });

    if (response.ok || response.status === 409) {
      return { success: true };
    }

    const error = await response.text();
    return { success: false, error };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

interface SetupConfig {
  mode: string;
  transport?: string;
  env: Record<string, string>;
  mcpConfig?: {
    transport: {
      type: string;
      url: string;
      headers?: Record<string, string>;
    };
  };
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

async function setupCloud(): Promise<SetupConfig | null> {
  header('☁️  Cloud Storage Setup');

  console.log('Available cloud providers:');
  console.log('1. AWS S3');
  console.log('2. Google Cloud Storage');
  console.log('3. Azure Blob Storage');
  console.log('4. Custom S3-compatible');
  console.log('5. HuggingFace Dataset (Recommended)\n');

  const choice = await question('Choose provider [1-5]: ');

  const providers: Record<string, string> = {
    '1': 'aws-s3',
    '2': 'gcp-storage',
    '3': 'azure-blob',
    '4': 'custom',
    '5': 'hf-dataset'
  };

  const provider = providers[choice] ?? 'aws-s3';

  if (provider === 'hf-dataset') {
    console.log('\n🤗 HuggingFace Dataset Setup\n');
    console.log("We'll create a PRIVATE dataset to store your captures.\n");

    const token = await question('Enter your HuggingFace token (from https://hf.co/settings/tokens):\nHF_TOKEN: ');

    if (!token.startsWith('hf_')) {
      console.error('❌ Invalid token format. Token should start with "hf_"');
      return null;
    }

    console.log('\n🔍 Validating token...');
    const validation = await validateHFToken(token);

    if (!validation.valid) {
      console.error('❌ Invalid token. Please check your token and try again.');
      return null;
    }

    log(`Logged in as: ${validation.username}`, '✓');

    const defaultRepo = `${validation.username}/network-captures`;
    const repoInput = await question(`\nDataset name [${defaultRepo}]: `);
    const repoName = repoInput.trim() || defaultRepo;

    const privateInput = await question('Keep private? [Y/n]: ');
    const isPrivate = privateInput.toLowerCase() !== 'n';

    console.log('\n📦 Creating dataset...');
    const result = await createHFDataset(token, repoName.split('/')[1], isPrivate);

    if (!result.success && !result.error?.includes('already exists')) {
      console.error(`❌ Failed to create dataset: ${result.error}`);
      return null;
    }

    log(`Dataset ready: ${repoName} (${isPrivate ? 'private' : 'public'})`, '✓');

    return {
      mode: 'hf-dataset',
      env: {
        MCP_STORAGE_MODE: 'hf-dataset',
        HF_TOKEN: token,
        HF_DATASET_REPO: repoName,
        HF_DATASET_PRIVATE: isPrivate.toString()
      }
    };
  }

  const bucket = await question('Bucket/Container name: ');
  const region = await question('Region (e.g., us-east-1): ');
  const accessKey = await question('Access Key ID: ');
  const secretKey = await question('Secret Access Key: ');

  let endpoint = '';
  if (provider === 'custom') {
    endpoint = await question('Custom endpoint URL: ');
  }

  const config: SetupConfig = {
    mode: 'cloud',
    env: {
      MCP_STORAGE_MODE: 'cloud',
      MCP_CLOUD_PROVIDER: provider,
      MCP_CLOUD_BUCKET: bucket,
      MCP_CLOUD_REGION: region,
      MCP_CLOUD_ACCESS_KEY_ID: accessKey,
      MCP_CLOUD_SECRET_ACCESS_KEY: secretKey
    }
  };

  if (endpoint) {
    config.env.MCP_CLOUD_ENDPOINT = endpoint;
  }

  log('Cloud storage configured!');
  return config;
}

async function setupBlaxel(): Promise<SetupConfig> {
  header('🚀 Blaxel Setup');

  console.log('Blaxel provides serverless MCP hosting.\n');

  const projectId = await question('Blaxel Project ID: ');
  const apiKey = await question('Blaxel API Key (optional for local dev): ');
  const endpoint = await question('Custom endpoint (leave empty for default): ');

  const config: SetupConfig = {
    mode: 'blaxel',
    env: {
      MCP_STORAGE_MODE: 'blaxel',
      BLAXEL_PROJECT_ID: projectId
    }
  };

  if (apiKey) {
    config.env.BLAXEL_API_KEY = apiKey;
  }

  if (endpoint) {
    config.env.BLAXEL_ENDPOINT = endpoint;
  }

  log('Blaxel storage configured!');
  return config;
}

async function saveConfiguration(config: SetupConfig, profileName: string | null = null): Promise<boolean> {
  header('💾 Saving Configuration');

  if (!profileName) {
    const defaultName = config.mode === 'local' ? 'local' :
      config.mode === 'hf-dataset' ? 'cloud-hf' :
        config.mode === 'blaxel' ? 'blaxel' : 'cloud';
    profileName = (await question(`\nProfile name [${defaultName}]: `)) || defaultName;
  }

  const description = await question('Description (optional): ');

  const saveChoice = await question('\nSave these settings?\n- Will create .env file (gitignored)\n- Will save profile for easy switching\n- Will update mcp.json\n\n[Y/n]: ');

  if (saveChoice.toLowerCase() === 'n') {
    console.log('\n⚠️  Configuration not saved. You can run setup again anytime.');
    return false;
  }

  const envPath = join(PROJECT_ROOT, '.env');
  const envLines = Object.entries(config.env).map(([key, value]) => `${key}=${value}`);
  await writeFile(envPath, envLines.join('\n') + '\n', 'utf-8');
  log('.env file created', '✓');

  const mcpPath = join(PROJECT_ROOT, 'mcp.json');
  let mcpConfig: { mcpServers: Record<string, unknown> } = { mcpServers: {} };

  if (existsSync(mcpPath)) {
    const mcpContent = await readFile(mcpPath, 'utf-8');
    mcpConfig = JSON.parse(mcpContent) as typeof mcpConfig;
  }

  if (config.mcpConfig) {
    mcpConfig.mcpServers['network-analyzer'] = config.mcpConfig;
  } else {
    const serverEnv: Record<string, string> = {};
    Object.keys(config.env).forEach(key => {
      if (key.includes('TOKEN') || key.includes('KEY') || key.includes('SECRET')) {
        serverEnv[key] = `\${${key}}`;
      } else {
        serverEnv[key] = config.env[key];
      }
    });

    mcpConfig.mcpServers['network-analyzer'] = {
      command: 'node',
      args: [join(PROJECT_ROOT, 'dist/index.js')],
      env: serverEnv
    };
  }

  await writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
  log('mcp.json updated', '✓');

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

async function setupRemoteServer(): Promise<void> {
  header('🌐 Remote MCP Server Setup');

  console.log('Configure connection to a remote MCP server.\n');
  console.log('Examples:');
  console.log('  • Custom: https://your-server.com/mcp\n');

  const url = await question('Remote MCP server URL: ');

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.error('❌ Invalid URL. Must start with http:// or https://');
    rl.close();
    process.exit(1);
  }

  const needsAuth = await question('\nDoes the server require authentication? [y/N]: ');

  const authHeaders: Record<string, string> = {};
  if (needsAuth.toLowerCase() === 'y') {
    console.log('\nAuthentication options:');
    console.log('1. Bearer Token');
    console.log('2. API Key (custom header)');
    console.log('3. Basic Auth\n');

    const authChoice = await question('Choice [1-3]: ');

    switch (authChoice) {
      case '1': {
        const token = await question('Bearer token: ');
        authHeaders['Authorization'] = `Bearer ${token}`;
        break;
      }
      case '2': {
        const headerName = await question('Header name (e.g., X-API-Key): ');
        const headerValue = await question('Header value: ');
        authHeaders[headerName] = headerValue;
        break;
      }
      case '3': {
        const username = await question('Username: ');
        const password = await question('Password: ');
        const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');
        authHeaders['Authorization'] = `Basic ${basicAuth}`;
        break;
      }
    }
  }

  const config: SetupConfig = {
    mode: 'remote',
    transport: 'remote',
    env: {
      MCP_TRANSPORT: 'http',
      MCP_SERVER_URL: url
    },
    mcpConfig: {
      transport: {
        type: 'http',
        url
      }
    }
  };

  if (Object.keys(authHeaders).length > 0) {
    config.env.MCP_AUTH_HEADERS = JSON.stringify(authHeaders);
    config.mcpConfig!.transport.headers = authHeaders;
  }

  log('Remote server configured!');

  const saved = await saveConfiguration(config);

  if (saved) {
    await showNextStepsRemote();
  }

  rl.close();
}

async function showNextStepsRemote(): Promise<void> {
  header('🎉 Remote Setup Complete!');

  console.log('Your Claude Desktop is now configured to connect to the remote MCP server.\n');
  console.log('Next steps:\n');
  console.log('1. Install to Claude Desktop:');
  console.log('   pnpm run install-claude\n');
  console.log('2. Or manually add the config from mcp.json to your Claude Desktop config.');
  console.log('3. Check status anytime:');
  console.log('   pnpm run status\n');
  console.log('4. Switch profiles:');
  console.log('   pnpm run setup -- --switch <name>\n');
  console.log('Happy capturing! 🚀\n');
}

/**
 * Non-interactively update the data directory in .env and the active profile
 */
async function setDataDir(inputPath: string): Promise<void> {
  const resolvedPath = resolve(inputPath);

  // Validate/create the directory
  try {
    await mkdir(resolvedPath, { recursive: true });
  } catch (error) {
    console.error(`❌ Cannot create directory "${resolvedPath}": ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  // Update .env
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

  // Update the active profile if one exists
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

  // Read .env
  const envPath = join(PROJECT_ROOT, '.env');
  let envContent = '';
  try {
    envContent = await readFile(envPath, 'utf-8');
  } catch {
    console.log('  No .env file found. Run setup to create one.\n');
    return;
  }

  const relevant = ['MCP_NETWORK_ANALYZER_DATA', 'MCP_STORAGE_MODE', 'PORT', 'HOST'];
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
      const typeLabel = profile.transport === 'remote' ? ' (remote)' : '';
      console.log(`  [${isActive}] ${name} - ${profile.mode}${typeLabel}`);
    }
    console.log('');
  }

  console.log('How will you run the MCP server?\n');
  console.log('1. 📍 Local (this computer) - Run server locally');
  console.log('2. 🌐 Remote (hosted) - Connect to remote server\n');

  const serverChoice = await question('Choice [1-2]: ');

  if (serverChoice === '2') {
    await setupRemoteServer();
    return;
  }

  console.log('\nWhere do you want to store captured data?\n');
  console.log('1. 💾 Local (your computer) - No setup needed');
  console.log('2. ☁️  Cloud Storage (AWS S3, GCS, Azure, HuggingFace)\n');

  const choice = await question('Choice [1-2]: ');

  let config: SetupConfig | null = null;

  switch (choice) {
    case '1':
      config = await setupLocal();
      break;
    case '2':
      config = await setupCloud();
      break;
    default:
      console.log('\n⚠️  Invalid choice. Defaulting to local storage.');
      config = await setupLocal();
  }

  if (!config) {
    console.error('\n❌ Setup failed. Please try again.');
    rl.close();
    process.exit(1);
  }

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
