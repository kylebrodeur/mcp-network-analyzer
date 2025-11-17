#!/usr/bin/env node

/**
 * Status checker for MCP Network Analyzer
 * Shows current configuration, storage status, and tool availability
 */

import { existsSync } from 'fs';
import { readdir, readFile, stat } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const PROFILES_PATH = join(PROJECT_ROOT, '.env.profiles.json');

function log(message, emoji = '') {
  console.log(emoji ? `${emoji} ${message}` : message);
}

function section(title) {
  console.log('\n' + title);
  console.log('-'.repeat(50));
}

async function loadEnv() {
  const envPath = join(PROJECT_ROOT, '.env');
  if (!existsSync(envPath)) {
    return {};
  }
  
  const envContent = await readFile(envPath, 'utf-8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  });
  
  return env;
}

async function loadProfiles() {
  try {
    if (existsSync(PROFILES_PATH)) {
      const data = await readFile(PROFILES_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    // Ignore errors
  }
  return { profiles: {}, active: null };
}

async function checkHFToken(token) {
  try {
    const response = await fetch('https://huggingface.co/api/whoami-v2', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      return { 
        valid: true, 
        username: data.name,
        orgs: data.orgs?.length || 0
      };
    }
    return { valid: false };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

async function getDataStats() {
  const dataDir = join(PROJECT_ROOT, 'data');
  
  if (!existsSync(dataDir)) {
    return { captures: 0, analyses: 0, generated: 0, totalSize: 0 };
  }
  
  const stats = {
    captures: 0,
    analyses: 0,
    generated: 0,
    totalSize: 0
  };
  
  // Count captures
  const capturesDir = join(dataDir, 'captures');
  if (existsSync(capturesDir)) {
    const captures = await readdir(capturesDir);
    stats.captures = captures.filter(f => !f.startsWith('.')).length;
  }
  
  // Count analyses
  const analysesDir = join(dataDir, 'analyses');
  if (existsSync(analysesDir)) {
    const analyses = await readdir(analysesDir);
    stats.analyses = analyses.filter(f => !f.startsWith('.')).length;
  }
  
  // Count generated files
  const generatedDir = join(dataDir, 'generated');
  if (existsSync(generatedDir)) {
    const generated = await readdir(generatedDir);
    stats.generated = generated.filter(f => !f.startsWith('.')).length;
  }
  
  // Calculate total size
  try {
    const { execSync } = await import('child_process');
    const sizeOutput = execSync(`du -sh "${dataDir}" 2>/dev/null | cut -f1`, { encoding: 'utf-8' });
    stats.totalSize = sizeOutput.trim();
  } catch {
    stats.totalSize = 'Unknown';
  }
  
  return stats;
}

async function checkBuildStatus() {
  const distDir = join(PROJECT_ROOT, 'dist');
  const distIndex = join(distDir, 'index.js');
  
  if (!existsSync(distIndex)) {
    return { built: false };
  }
  
  const distStat = await stat(distIndex);
  const packagePath = join(PROJECT_ROOT, 'package.json');
  const packageStat = await stat(packagePath);
  
  const srcDir = join(PROJECT_ROOT, 'src');
  const srcFiles = await readdir(srcDir);
  let newestSrc = packageStat.mtime;
  
  for (const file of srcFiles) {
    if (file.endsWith('.ts')) {
      const fileStat = await stat(join(srcDir, file));
      if (fileStat.mtime > newestSrc) {
        newestSrc = fileStat.mtime;
      }
    }
  }
  
  const needsRebuild = newestSrc > distStat.mtime;
  
  return {
    built: true,
    lastBuilt: distStat.mtime.toLocaleString(),
    needsRebuild
  };
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function main() {
  console.log('\n🔍 MCP Network Analyzer - Status Check\n');
  
  // Load environment and profiles
  const env = await loadEnv();
  const profileData = await loadProfiles();
  const mode = env.MCP_STORAGE_MODE || process.env.MCP_STORAGE_MODE || 'local';
  
  // Show active profile if exists
  if (profileData.active) {
    section('🔖 Active Profile');
    const profile = profileData.profiles[profileData.active];
    log(`Name:        ${profileData.active}`, '');
    if (profile.description) {
      log(`Description: ${profile.description}`, '');
    }
    
    // Show transport type
    const transportType = profile.transport === 'remote' ? '🌐 Remote Server' : '📍 Local Server';
    log(`Transport:   ${transportType}`, '');
    
    // Show remote URL if applicable
    if (profile.transport === 'remote' && profile.env?.MCP_SERVER_URL) {
      log(`Server URL:  ${profile.env.MCP_SERVER_URL}`, '');
    }
    
    log(`Mode:        ${profile.mode}`, '');
    log(`Created:     ${new Date(profile.createdAt).toLocaleString()}`, '');
    
    // Show other profiles
    const otherProfiles = Object.keys(profileData.profiles).filter(p => p !== profileData.active);
    if (otherProfiles.length > 0) {
      log(`\nOther saved: ${otherProfiles.join(', ')}`, '💡');
      log(`Switch with: pnpm run setup -- --switch <name>`, '');
    }
  }
  
  // Storage configuration
  section('📦 Storage Configuration');
  
  // Check if remote mode
  if (mode === 'remote' || env.MCP_SERVER_URL) {
    log('Type:        🌐 Remote MCP Server', '');
    log(`Server URL:  ${env.MCP_SERVER_URL || 'Not set'}`, '');
    if (env.MCP_AUTH_HEADERS) {
      log('Auth:        ✓ Configured', '');
    }
    console.log('\n💡 Storage is managed by the remote server.');
    console.log('   Contact server admin for storage details.\n');
  } else {
    // Local server with storage config
    switch (mode) {
      case 'local':
        log('Mode:        💾 Local (file system)', '');
        log(`Directory:   ${env.MCP_NETWORK_ANALYZER_DATA || './data'}`, '');
        break;
        
      case 'cloud':
        log('Mode:        ☁️  Cloud Storage', '');
        log(`Provider:    ${env.MCP_CLOUD_PROVIDER || 'Unknown'}`, '');
        log(`Bucket:      ${env.MCP_CLOUD_BUCKET || 'Not set'}`, '');
        log(`Region:      ${env.MCP_CLOUD_REGION || 'Not set'}`, '');
        break;
        
      case 'hf-dataset':
        log('Mode:        🤗 HuggingFace Dataset', '');
        log(`Repository:  ${env.HF_DATASET_REPO || 'Not set'}`, '');
        log(`Privacy:     ${env.HF_DATASET_PRIVATE === 'true' ? 'Private' : 'Public'}`, '');
        
        if (env.HF_TOKEN) {
          const tokenCheck = await checkHFToken(env.HF_TOKEN);
          if (tokenCheck.valid) {
            log(`Token:       ✓ Valid (user: ${tokenCheck.username})`, '');
          } else {
            log('Token:       ❌ Invalid or expired', '');
          }
        } else {
          log('Token:       ❌ Not configured', '');
        }
        break;
        
      case 'blaxel':
        log('Mode:        🚀 Blaxel (MCP hosting)', '');
        log(`Project:     ${env.BLAXEL_PROJECT_ID || 'Not set'}`, '');
        log(`Endpoint:    ${env.BLAXEL_ENDPOINT || 'Default'}`, '');
        break;
        
      default:
        log(`Mode:        Unknown (${mode})`, '❌');
    }
  }
  
  // Data statistics
  section('📊 Data Statistics');
  const stats = await getDataStats();
  log(`Captures:    ${stats.captures} sessions`, '');
  log(`Analyses:    ${stats.analyses} reports`, '');
  log(`Generated:   ${stats.generated} scripts`, '');
  log(`Total Size:  ${stats.totalSize}`, '');
  
  // Build status
  section('🔨 Build Status');
  const buildStatus = await checkBuildStatus();
  
  if (!buildStatus.built) {
    log('Status:      ❌ Not built', '');
    log('Action:      Run `pnpm run build`', '💡');
  } else if (buildStatus.needsRebuild) {
    log('Status:      ⚠️  Needs rebuild (source files changed)', '');
    log(`Last Built:  ${buildStatus.lastBuilt}`, '');
    log('Action:      Run `pnpm run build`', '💡');
  } else {
    log('Status:      ✓ Up to date', '');
    log(`Last Built:  ${buildStatus.lastBuilt}`, '');
  }
  
  // Tool availability
  section('🛠️  MCP Tools');
  log('capture_network_requests    ✓ Available', '');
  log('analyze_captured_data       ✓ Available', '');
  log('discover_api_patterns       ✓ Available', '');
  log('generate_export_tool        ✓ Available', '');
  log('search_exported_data        ⏳ Coming soon', '');
  
  // Quick actions
  section('⚡ Quick Actions');
  console.log('');
  console.log('  pnpm run build              Build the project');
  console.log('  pnpm run dev                Start in watch mode');
  console.log('  pnpm run setup              Run setup wizard again');
  console.log('  ./scripts/install-claude.sh Install to Claude Desktop');
  console.log('');
  
  // Status summary
  const allGood = buildStatus.built && !buildStatus.needsRebuild;
  
  if (allGood) {
    console.log('✅ Ready to capture network traffic! 🚀\n');
  } else {
    console.log('⚠️  Action required - see above\n');
  }
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
