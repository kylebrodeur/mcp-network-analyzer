#!/usr/bin/env node

/**
 * Interactive setup wizard for MCP Network Analyzer
 * Guides users through initial configuration
 */

import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const PROFILES_PATH = join(PROJECT_ROOT, '.env.profiles.json');

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function log(message, emoji = '✓') {
  console.log(`${emoji} ${message}`);
}

function header(title) {
  console.log('\n' + '='.repeat(50));
  console.log(`  ${title}`);
  console.log('='.repeat(50) + '\n');
}

async function loadProfiles() {
  try {
    if (existsSync(PROFILES_PATH)) {
      const data = await readFile(PROFILES_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    // Ignore errors, return empty
  }
  return { profiles: {}, active: null };
}

async function saveProfiles(profiles) {
  await writeFile(PROFILES_PATH, JSON.stringify(profiles, null, 2), 'utf-8');
}

async function activateProfile(profileName) {
  const data = await loadProfiles();
  
  if (!data.profiles[profileName]) {
    console.error(`❌ Profile "${profileName}" not found.`);
    return false;
  }
  
  const profile = data.profiles[profileName];
  
  // Update .env file
  const envPath = join(PROJECT_ROOT, '.env');
  const envLines = Object.entries(profile.env).map(([key, value]) => `${key}=${value}`);
  await writeFile(envPath, envLines.join('\n') + '\n', 'utf-8');
  
  // Update active profile
  data.active = profileName;
  await saveProfiles(data);
  
  log(`Switched to profile: ${profileName} (${profile.mode})`, '✓');
  return true;
}

async function listProfiles() {
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

async function validateHFToken(token) {
  try {
    const response = await fetch('https://huggingface.co/api/whoami-v2', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return { valid: true, username: data.name };
    }
    return { valid: false };
  } catch (error) {
    return { valid: false };
  }
}

async function createHFDataset(token, repoName, isPrivate) {
  try {
    const response = await fetch('https://huggingface.co/api/repos/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: repoName,
        type: 'dataset',
        private: isPrivate
      })
    });
    
    if (response.ok || response.status === 409) { // 409 = already exists
      return { success: true };
    }
    
    const error = await response.text();
    return { success: false, error };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function setupLocal() {
  header('💾 Local Storage Setup');
  
  console.log('Local storage will save data to your computer.');
  console.log('Location: ./data directory\n');
  
  const customPath = await question('Custom data directory? (leave empty for ./data): ');
  
  const config = {
    mode: 'local',
    env: {}
  };
  
  if (customPath.trim()) {
    config.env.MCP_NETWORK_ANALYZER_DATA = customPath.trim();
  }
  
  log('Local storage configured!');
  return config;
}

async function setupCloud() {
  header('☁️  Cloud Storage Setup');
  
  console.log('Available cloud providers:');
  console.log('1. AWS S3');
  console.log('2. Google Cloud Storage');
  console.log('3. Azure Blob Storage');
  console.log('4. Custom S3-compatible');
  console.log('5. HuggingFace Dataset (Recommended)\n');
  
  const choice = await question('Choose provider [1-5]: ');
  
  const providers = {
    '1': 'aws-s3',
    '2': 'gcp-storage',
    '3': 'azure-blob',
    '4': 'custom',
    '5': 'hf-dataset'
  };
  
  const provider = providers[choice] || 'aws-s3';
  
  // HuggingFace Dataset flow
  if (provider === 'hf-dataset') {
    console.log('\n🤗 HuggingFace Dataset Setup\n');
    console.log('We\'ll create a PRIVATE dataset to store your captures.\n');
    
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
  
  // Traditional cloud storage flow
  const bucket = await question('Bucket/Container name: ');
  const region = await question('Region (e.g., us-east-1): ');
  const accessKey = await question('Access Key ID: ');
  const secretKey = await question('Secret Access Key: ');
  
  let endpoint = '';
  if (provider === 'custom') {
    endpoint = await question('Custom endpoint URL: ');
  }
  
  const config = {
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

async function setupHuggingFace() {
  // This function is now integrated into setupCloud()
  // Keeping it for backward compatibility but redirecting
  return await setupCloud();
}

async function setupBlaxel() {
  header('🚀 Blaxel Setup');
  
  console.log('Blaxel provides serverless MCP hosting.\n');
  
  const projectId = await question('Blaxel Project ID: ');
  const apiKey = await question('Blaxel API Key (optional for local dev): ');
  const endpoint = await question('Custom endpoint (leave empty for default): ');
  
  const config = {
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

async function saveConfiguration(config, profileName = null) {
  header('💾 Saving Configuration');
  
  // Ask for profile name
  if (!profileName) {
    const defaultName = config.mode === 'local' ? 'local' : 
                        config.mode === 'hf-dataset' ? 'cloud-hf' :
                        config.mode === 'blaxel' ? 'blaxel' : 'cloud';
    profileName = await question(`\nProfile name [${defaultName}]: `) || defaultName;
  }
  
  const description = await question('Description (optional): ');
  
  const saveChoice = await question('\nSave these settings?\n- Will create .env file (gitignored)\n- Will save profile for easy switching\n- Will update mcp.json\n\n[Y/n]: ');
  
  if (saveChoice.toLowerCase() === 'n') {
    console.log('\n⚠️  Configuration not saved. You can run setup again anytime.');
    return false;
  }
  
  // Save .env file
  const envPath = join(PROJECT_ROOT, '.env');
  const envLines = Object.entries(config.env).map(([key, value]) => `${key}=${value}`);
  await writeFile(envPath, envLines.join('\n') + '\n', 'utf-8');
  log('.env file created', '✓');
  
  // Update mcp.json
  const mcpPath = join(PROJECT_ROOT, 'mcp.json');
  let mcpConfig = { mcpServers: {} };
  
  if (existsSync(mcpPath)) {
    const mcpContent = await readFile(mcpPath, 'utf-8');
    mcpConfig = JSON.parse(mcpContent);
  }
  
  // Check if this is a remote server config
  if (config.mcpConfig) {
    // Use provided MCP config (for remote servers)
    mcpConfig.mcpServers['network-analyzer'] = config.mcpConfig;
  } else {
    // Standard local server config
    mcpConfig.mcpServers['network-analyzer'] = {
      command: 'node',
      args: [join(PROJECT_ROOT, 'dist/index.js')],
      env: {}
    };
    
    // Add env vars with ${} references for sensitive data
    Object.keys(config.env).forEach(key => {
      if (key.includes('TOKEN') || key.includes('KEY') || key.includes('SECRET')) {
        mcpConfig.mcpServers['network-analyzer'].env[key] = `\${${key}}`;
      } else {
        mcpConfig.mcpServers['network-analyzer'].env[key] = config.env[key];
      }
    });
  }
  
  await writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
  log('mcp.json updated', '✓');
  
  // Save profile
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

async function showNextSteps() {
  header('🎉 Setup Complete!');
  
  console.log('Next steps:\n');
  console.log('1. Build the project:');
  console.log('   pnpm run build\n');
  console.log('2. Test with MCP Inspector:');
  console.log('   npx @modelcontextprotocol/inspector node dist/index.js\n');
  console.log('3. Or install to Claude Desktop:');
  console.log('   ./scripts/install-claude.sh\n');
  console.log('4. Check status anytime:');
  console.log('   pnpm run status\n');
  console.log('Happy capturing! 🚀\n');
}

async function switchProfile() {
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

async function setupRemoteServer() {
  header('🌐 Remote MCP Server Setup');
  
  console.log('Configure connection to a remote MCP server.\n');
  console.log('Examples:');
  console.log('  • Blaxel: https://run.blaxel.ai/username/functions/mcp-network-analyzer/mcp');
  console.log('  • Custom: https://your-server.com/mcp\n');
  
  const url = await question('Remote MCP server URL: ');
  
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.error('❌ Invalid URL. Must start with http:// or https://');
    rl.close();
    process.exit(1);
  }
  
  // Check if authentication is needed
  const needsAuth = await question('\nDoes the server require authentication? [y/N]: ');
  
  let authHeaders = {};
  if (needsAuth.toLowerCase() === 'y') {
    console.log('\nAuthentication options:');
    console.log('1. Bearer Token');
    console.log('2. API Key (custom header)');
    console.log('3. Basic Auth\n');
    
    const authChoice = await question('Choice [1-3]: ');
    
    switch (authChoice) {
      case '1':
        const token = await question('Bearer token: ');
        authHeaders['Authorization'] = `Bearer ${token}`;
        break;
      case '2':
        const headerName = await question('Header name (e.g., X-API-Key): ');
        const headerValue = await question('Header value: ');
        authHeaders[headerName] = headerValue;
        break;
      case '3':
        const username = await question('Username: ');
        const password = await question('Password: ');
        const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');
        authHeaders['Authorization'] = `Basic ${basicAuth}`;
        break;
    }
  }
  
  const config = {
    mode: 'remote',
    transport: 'remote',
    env: {
      MCP_TRANSPORT: 'http',
      MCP_SERVER_URL: url
    },
    mcpConfig: {
      transport: {
        type: 'http',
        url: url
      }
    }
  };
  
  // Add auth headers if provided
  if (Object.keys(authHeaders).length > 0) {
    config.env.MCP_AUTH_HEADERS = JSON.stringify(authHeaders);
    config.mcpConfig.transport.headers = authHeaders;
  }
  
  log('Remote server configured!');
  
  const saved = await saveConfiguration(config);
  
  if (saved) {
    await showNextStepsRemote();
  }
  
  rl.close();
}

async function showNextStepsRemote() {
  header('🎉 Remote Setup Complete!');
  
  console.log('Your Claude Desktop is now configured to connect to the remote MCP server.\n');
  console.log('Next steps:\n');
  console.log('1. Install to Claude Desktop:');
  console.log('   ./scripts/install-claude.sh\n');
  console.log('2. Or manually add the config from mcp.json to:');
  console.log('   ~/Library/Application Support/Claude/claude_desktop_config.json\n');
  console.log('3. Check status anytime:');
  console.log('   pnpm run status\n');
  console.log('4. Switch profiles:');
  console.log('   pnpm run setup -- --switch <name>\n');
  console.log('Happy capturing! 🚀\n');
}

async function main() {
  // Handle command-line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--switch') || args.includes('-s')) {
    const profileName = args[args.indexOf('--switch') + 1] || args[args.indexOf('-s') + 1];
    
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
  
  console.log('\n🔧 MCP Network Analyzer - Setup Wizard\n');
  console.log('This wizard will help you configure the network analyzer.\n');
  
  // Show existing profiles if any
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
  console.log('2. ☁️  Cloud Storage:');
  console.log('   • AWS S3, Google Cloud, Azure Blob');
  console.log('   • HuggingFace Dataset (Recommended)');
  console.log('3. 🚀 Blaxel (MCP hosting) - Need Blaxel project\n');
  
  const choice = await question('Choice [1-3]: ');
  
  let config = null;
  
  switch (choice) {
    case '1':
      config = await setupLocal();
      break;
    case '2':
      config = await setupCloud();
      break;
    case '3':
      config = await setupBlaxel();
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
  console.error('\n❌ Setup error:', error.message);
  rl.close();
  process.exit(1);
});
