import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

import {
    CliContext,
    loadEnvFile,
    loadProfiles,
    saveProfiles,
    writeEnvFile
} from '@mcp-network-analyzer/core';

function question(prompt: string, rl: ReturnType<typeof createInterface>): Promise<string> {
  return new Promise(res => rl.question(prompt, res));
}

function log(message: string, emoji = '✓'): void {
  console.log(`${emoji} ${message}`);
}

function header(title: string): void {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(50)}\n`);
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

async function validateHFToken(token: string): Promise<{ valid: boolean; username?: string }> {
  try {
    const response = await fetch('https://huggingface.co/api/whoami-v2', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.ok) {
      const data = (await response.json()) as { name: string };
      return { valid: true, username: data.name };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

async function createHFDataset(
  token: string,
  repoName: string,
  isPrivate: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://huggingface.co/api/repos/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: repoName, type: 'dataset', private: isPrivate })
    });
    if (response.ok || response.status === 409) {
      return { success: true };
    }
    return { success: false, error: await response.text() };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function setupLocal(rl: ReturnType<typeof createInterface>): Promise<SetupConfig> {
  header('💾 Local Storage Setup');
  console.log('Local storage will save data to your computer.');
  console.log('Location: ./data directory\n');

  const customPath = await question('Custom data directory? (leave empty for ./data): ', rl);
  const config: SetupConfig = { mode: 'local', env: {} };
  if (customPath.trim()) {
    config.env.MCP_NETWORK_ANALYZER_DATA = customPath.trim();
  }
  log('Local storage configured!');
  return config;
}

async function setupCloud(rl: ReturnType<typeof createInterface>): Promise<SetupConfig | null> {
  header('☁️  Cloud Storage Setup');
  console.log('Available cloud providers:');
  console.log('1. AWS S3');
  console.log('2. Google Cloud Storage');
  console.log('3. Azure Blob Storage');
  console.log('4. Custom S3-compatible');
  console.log('5. HuggingFace Dataset (Recommended)\n');

  const choice = await question('Choose provider [1-5]: ', rl);
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

    const token = await question(
      'Enter your HuggingFace token (from https://hf.co/settings/tokens):\nHF_TOKEN: ',
      rl
    );
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
    const repoInput = await question(`\nDataset name [${defaultRepo}]: `, rl);
    const repoName = repoInput.trim() || defaultRepo;

    const privateInput = await question('Keep private? [Y/n]: ', rl);
    const isPrivate = privateInput.toLowerCase() !== 'n';

    console.log('\n📦 Creating dataset...');
    const result = await createHFDataset(token, repoName.split('/')[1] ?? repoName, isPrivate);
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

  const bucket = await question('Bucket/Container name: ', rl);
  const region = await question('Region (e.g., us-east-1): ', rl);
  const accessKey = await question('Access Key ID: ', rl);
  const secretKey = await question('Secret Access Key: ', rl);
  let endpoint = '';
  if (provider === 'custom') {
    endpoint = await question('Custom endpoint URL: ', rl);
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

async function setupRemoteServer(context: CliContext, rl: ReturnType<typeof createInterface>): Promise<void> {
  header('🌐 Remote MCP Server Setup');
  console.log('Configure connection to a remote MCP server.\n');
  console.log('Examples:');
  console.log('  • Custom: https://your-server.com/mcp\n');

  const url = await question('Remote MCP server URL: ', rl);
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.error('❌ Invalid URL. Must start with http:// or https://');
    rl.close();
    process.exit(1);
  }

  const needsAuth = await question('\nDoes the server require authentication? [y/N]: ', rl);
  const authHeaders: Record<string, string> = {};

  if (needsAuth.toLowerCase() === 'y') {
    console.log('\nAuthentication options:');
    console.log('1. Bearer Token');
    console.log('2. API Key (custom header)');
    console.log('3. Basic Auth\n');

    const authChoice = await question('Choice [1-3]: ', rl);
    switch (authChoice) {
      case '1': {
        const token = await question('Bearer token: ', rl);
        authHeaders['Authorization'] = `Bearer ${token}`;
        break;
      }
      case '2': {
        const headerName = await question('Header name (e.g., X-API-Key): ', rl);
        const headerValue = await question('Header value: ', rl);
        authHeaders[headerName] = headerValue;
        break;
      }
      case '3': {
        const username = await question('Username: ', rl);
        const password = await question('Password: ', rl);
        const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');
        authHeaders['Authorization'] = `Basic ${basicAuth}`;
        break;
      }
    }
  }

  const config: SetupConfig = {
    mode: 'remote',
    transport: 'remote',
    env: { MCP_TRANSPORT: 'http', MCP_SERVER_URL: url },
    mcpConfig: { transport: { type: 'http', url } }
  };
  if (Object.keys(authHeaders).length > 0) {
    config.env.MCP_AUTH_HEADERS = JSON.stringify(authHeaders);
    config.mcpConfig!.transport.headers = authHeaders;
  }

  log('Remote server configured!');
  const saved = await saveConfiguration(context, config, null, rl);
  if (saved) {
    showNextStepsRemote();
  }
}

async function saveConfiguration(
  context: CliContext,
  config: SetupConfig,
  profileNameArg: string | null,
  rl: ReturnType<typeof createInterface>
): Promise<boolean> {
  header('💾 Saving Configuration');

  let profileName: string | null = profileNameArg;
  if (!profileName) {
    const defaultName =
      config.mode === 'local' ? 'local' :
      config.mode === 'hf-dataset' ? 'cloud-hf' : 'cloud';
    profileName = (await question(`\nProfile name [${defaultName}]: `, rl)) || defaultName;
  }

  const description = await question('Description (optional): ', rl);
  const saveChoice = await question(
    '\nSave these settings?\n- Will create .env file (gitignored)\n- Will save profile for easy switching\n- Will update mcp.json\n\n[Y/n]: ',
    rl
  );

  if (saveChoice.toLowerCase() === 'n') {
    console.log('\n⚠️  Configuration not saved. You can run setup again anytime.');
    return false;
  }

  await writeEnvFile(context.projectRoot, config.env);
  log('.env file created', '✓');

  const mcpPath = join(context.projectRoot, 'mcp.json');
  let mcpConfig: { mcpServers: Record<string, unknown> } = { mcpServers: {} };
  if (existsSync(mcpPath)) {
    try {
      mcpConfig = JSON.parse(await readFile(mcpPath, 'utf-8')) as typeof mcpConfig;
    } catch { /* ignore */ }
  }

  if (config.mcpConfig) {
    mcpConfig.mcpServers['network-analyzer'] = config.mcpConfig;
  } else {
    const serverEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(config.env)) {
      serverEnv[key] = key.includes('TOKEN') || key.includes('KEY') || key.includes('SECRET')
        ? `\${${key}}`
        : value;
    }
    mcpConfig.mcpServers['network-analyzer'] = {
      command: 'node',
      args: [join(context.projectRoot, 'dist/index.js')],
      env: serverEnv
    };
  }
  await writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
  log('mcp.json updated', '✓');

  const profileData = await loadProfiles(context.projectRoot);
  profileData.profiles[profileName] = {
    mode: config.mode,
    env: config.env,
    description: description || undefined,
    createdAt: new Date().toISOString()
  };
  profileData.active = profileName;
  await saveProfiles(context.projectRoot, profileData);
  log(`Profile "${profileName}" saved`, '✓');

  console.log('\n✓ Configuration saved!');
  console.log(`\n💡 Switch profiles anytime: mcp-network-analyzer-pro setup --switch <name>`);
  return true;
}

function showNextSteps(): void {
  header('🎉 Setup Complete!');
  console.log('Next steps:\n');
  console.log('1. Build the project:');
  console.log('   pr build\n');
  console.log('2. Test with MCP Inspector:');
  console.log('   npx @modelcontextprotocol/inspector node dist/index.js\n');
  console.log('3. Or install to Claude Desktop:');
  console.log('   pr install-claude\n');
  console.log('4. Check status anytime:');
  console.log('   pr status\n');
  console.log('Happy capturing! 🚀\n');
}

function showNextStepsRemote(): void {
  header('🎉 Remote Setup Complete!');
  console.log('Your Claude Desktop is now configured to connect to the remote MCP server.\n');
  console.log('Next steps:\n');
  console.log('1. Install to Claude Desktop:');
  console.log('   pr install-claude\n');
  console.log('2. Check status anytime:');
  console.log('   pr status\n');
  console.log('Happy capturing! 🚀\n');
}

export async function activateProfile(context: CliContext, profileName: string): Promise<boolean> {
  const data = await loadProfiles(context.projectRoot);
  if (!data.profiles[profileName]) {
    console.error(`❌ Profile "${profileName}" not found.`);
    return false;
  }
  await writeEnvFile(context.projectRoot, data.profiles[profileName].env);
  data.active = profileName;
  await saveProfiles(context.projectRoot, data);
  log(`Switched to profile: ${profileName} (${data.profiles[profileName].mode})`, '✓');
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
  console.log('\n💡 Switch profiles: mcp-network-analyzer-pro setup --switch <name>\n');
}

export async function setDataDir(context: CliContext, inputPath: string): Promise<void> {
  const resolvedPath = resolve(inputPath);
  try {
    await mkdir(resolvedPath, { recursive: true });
  } catch (error) {
    console.error(
      `❌ Cannot create directory "${resolvedPath}": ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }

  const current = await loadEnvFile(context.projectRoot);
  current.MCP_NETWORK_ANALYZER_DATA = resolvedPath;
  await writeEnvFile(context.projectRoot, current);
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
  const env = await loadEnvFile(context.projectRoot);
  if (Object.keys(env).length === 0) {
    console.log('  No .env file found. Run setup to create one.\n');
    return;
  }
  const relevant = ['MCP_NETWORK_ANALYZER_DATA', 'MCP_STORAGE_MODE', 'PORT', 'HOST'];
  console.log('  .env values:\n');
  for (const key of relevant) {
    if (env[key]) {
      console.log(`    ${key}=${env[key]}`);
    }
  }
  const data = await loadProfiles(context.projectRoot);
  if (data.active) {
    console.log(`\n  Active profile: ${data.active} (${data.profiles[data.active]?.mode ?? 'unknown'})`);
    console.log('  Switch profiles: mcp-network-analyzer-pro setup --switch <name>');
  }
  console.log('');
}

export async function runSetupCommand(context: CliContext, args: string[]): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (args.includes('--switch') || args.includes('-s')) {
      const idx = args.includes('--switch') ? args.indexOf('--switch') : args.indexOf('-s');
      const profileName = args[idx + 1];
      if (profileName) {
        const success = await activateProfile(context, profileName);
        process.exit(success ? 0 : 1);
      } else {
        await switchProfileInteractive(context, rl);
        return;
      }
    }

    if (args.includes('--list') || args.includes('-l')) {
      await listProfiles(context);
      return;
    }

    if (args.includes('--data-dir') || args.includes('-d')) {
      const idx = args.includes('--data-dir') ? args.indexOf('--data-dir') : args.indexOf('-d');
      const dirPath = args[idx + 1];
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

    console.log('\n🔧 MCP Network Analyzer Pro - Setup Wizard\n');
    console.log('This wizard will help you configure the network analyzer.\n');

    const existingProfiles = await loadProfiles(context.projectRoot);
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

    const serverChoice = await question('Choice [1-2]: ', rl);
    if (serverChoice === '2') {
      await setupRemoteServer(context, rl);
      return;
    }

    console.log('\nWhere do you want to store captured data?\n');
    console.log('1. 💾 Local (your computer) - No setup needed');
    console.log('2. ☁️  Cloud Storage (AWS S3, GCS, Azure, HuggingFace)\n');

    const storageChoice = await question('Choice [1-2]: ', rl);
    let config: SetupConfig | null = null;

    switch (storageChoice) {
      case '1':
        config = await setupLocal(rl);
        break;
      case '2':
        config = await setupCloud(rl);
        break;
      default:
        console.log('\n⚠️  Invalid choice. Defaulting to local storage.');
        config = await setupLocal(rl);
    }

    if (!config) {
      console.error('\n❌ Setup failed. Please try again.');
      process.exit(1);
    }

    const saved = await saveConfiguration(context, config, null, rl);
    if (saved) {
      showNextSteps();
    }
  } finally {
    rl.close();
  }
}

async function switchProfileInteractive(context: CliContext, rl: ReturnType<typeof createInterface>): Promise<void> {
  header('🔄 Switch Profile');
  const data = await loadProfiles(context.projectRoot);
  if (Object.keys(data.profiles).length === 0) {
    console.log('\n📋 No saved profiles. Run setup to create one.\n');
    return;
  }
  console.log('Available profiles:\n');
  for (const [name, profile] of Object.entries(data.profiles)) {
    const isActive = name === data.active ? '✓ (active)' : '';
    console.log(`  ${name} - ${profile.mode} ${isActive}`);
  }
  const choice = await question('\nProfile name (or "list" to see details): ', rl);
  if (choice === 'list') {
    await listProfiles(context);
    return;
  }
  const success = await activateProfile(context, choice);
  if (success) {
    console.log('\n✓ Profile activated! Changes take effect immediately.\n');
  }
}
