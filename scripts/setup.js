#!/usr/bin/env node

/**
 * Interactive setup wizard for MCP Network Analyzer
 * Guides users through initial configuration
 */

import { createInterface } from 'readline';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

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
  
  console.log('Available providers:');
  console.log('1. AWS S3');
  console.log('2. Google Cloud Storage');
  console.log('3. Azure Blob Storage');
  console.log('4. Custom S3-compatible\n');
  
  const choice = await question('Choose provider [1-4]: ');
  
  const providers = {
    '1': 'aws-s3',
    '2': 'gcp-storage',
    '3': 'azure-blob',
    '4': 'custom'
  };
  
  const provider = providers[choice] || 'aws-s3';
  
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
  header('🤗 HuggingFace Dataset Setup');
  
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

async function saveConfiguration(config) {
  header('💾 Saving Configuration');
  
  const saveChoice = await question('\nSave these settings?\n- Will create .env file (gitignored)\n- Will update mcp.json\n\n[Y/n]: ');
  
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
  
  await writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
  log('mcp.json updated', '✓');
  
  console.log('\n✓ Configuration saved!');
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

async function main() {
  console.log('\n🔧 MCP Network Analyzer - Setup Wizard\n');
  console.log('This wizard will help you configure the network analyzer.\n');
  
  console.log('Where do you want to store captured data?\n');
  console.log('1. 💾 Local (your computer) - No setup needed');
  console.log('2. ☁️  Cloud (AWS/GCP/Azure) - Need cloud credentials');
  console.log('3. 🤗 HuggingFace Dataset - Need HF token (Recommended)');
  console.log('4. 🚀 Blaxel (MCP hosting) - Need Blaxel project\n');
  
  const choice = await question('Choice [1-4]: ');
  
  let config = null;
  
  switch (choice) {
    case '1':
      config = await setupLocal();
      break;
    case '2':
      config = await setupCloud();
      break;
    case '3':
      config = await setupHuggingFace();
      break;
    case '4':
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
