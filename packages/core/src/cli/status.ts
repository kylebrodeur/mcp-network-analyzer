import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { CliContext, loadEnvFile, loadProfiles } from './common.js';

interface HFTokenCheck {
  valid: boolean;
  username?: string;
  orgs?: number;
  error?: string;
}

interface DataStats {
  captures: number;
  analyses: number;
  totalSize: string | number;
}

interface BuildStatus {
  built: boolean;
  lastBuilt?: string;
  needsRebuild?: boolean;
}

function log(message: string, emoji = ''): void {
  console.log(emoji ? `${emoji} ${message}` : message);
}

function section(title: string): void {
  console.log(`\n${title}`);
  console.log('-'.repeat(50));
}

async function checkHFToken(token: string): Promise<HFTokenCheck> {
  try {
    const response = await fetch('https://huggingface.co/api/whoami-v2', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      return { valid: false };
    }

    const data = (await response.json()) as { name: string; orgs?: unknown[] };
    return {
      valid: true,
      username: data.name,
      orgs: data.orgs?.length ?? 0
    };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function getDataStats(projectRoot: string): Promise<DataStats> {
  const dataDirCandidates = [join(projectRoot, 'mcp-network-data'), join(projectRoot, 'data')];
  const dataDir = dataDirCandidates.find(d => existsSync(d));

  if (!dataDir) {
    return { captures: 0, analyses: 0, totalSize: 0 };
  }

  const stats: DataStats = { captures: 0, analyses: 0, totalSize: 0 };

  const capturesDir = join(dataDir, 'captures');
  if (existsSync(capturesDir)) {
    const captures = await readdir(capturesDir);
    stats.captures = captures.filter(f => !f.startsWith('.')).length;
  }

  const analysesDir = join(dataDir, 'analyses');
  if (existsSync(analysesDir)) {
    const analyses = await readdir(analysesDir);
    stats.analyses = analyses.filter(f => !f.startsWith('.')).length;
  }

  try {
    const { execSync } = await import('node:child_process');
    const output = execSync(`du -sh "${dataDir}" 2>/dev/null | cut -f1`, { encoding: 'utf-8' });
    stats.totalSize = output.trim();
  } catch {
    stats.totalSize = 'Unknown';
  }

  return stats;
}

async function checkBuildStatus(projectRoot: string): Promise<BuildStatus> {
  const distIndex = join(projectRoot, 'dist', 'index.js');
  if (!existsSync(distIndex)) {
    return { built: false };
  }

  const distStat = await stat(distIndex);
  const packageStat = await stat(join(projectRoot, 'package.json'));

  const srcDir = join(projectRoot, 'src');
  const srcFiles = await readdir(srcDir, { recursive: true });
  let newestSrc = packageStat.mtime;

  for (const file of srcFiles) {
    if (typeof file !== 'string' || !file.endsWith('.ts')) {
      continue;
    }

    const fileStat = await stat(join(srcDir, file));
    if (fileStat.mtime > newestSrc) {
      newestSrc = fileStat.mtime;
    }
  }

  return {
    built: true,
    lastBuilt: distStat.mtime.toLocaleString(),
    needsRebuild: newestSrc > distStat.mtime
  };
}

export async function runStatusCommand(context: CliContext): Promise<void> {
  console.log('\n🔍 MCP Network Analyzer - Status Check\n');

  const env = await loadEnvFile(context.projectRoot);
  const profileData = await loadProfiles(context.projectRoot);
  const mode = env.MCP_STORAGE_MODE ?? process.env.MCP_STORAGE_MODE ?? 'local';

  if (profileData.active) {
    section('🔖 Active Profile');
    const profile = profileData.profiles[profileData.active];
    log(`Name:        ${profileData.active}`);
    if (profile?.description) {
      log(`Description: ${profile.description}`);
    }
    log(`Mode:        ${profile?.mode ?? 'unknown'}`);
    if (profile?.transport === 'remote') {
      log('Transport:   🌐 Remote Server');
      if (profile.env?.MCP_SERVER_URL) {
        log(`Server URL:  ${profile.env.MCP_SERVER_URL}`);
      }
    } else {
      log('Transport:   📍 Local Server');
    }
    if (profile?.createdAt) {
      log(`Created:     ${new Date(profile.createdAt).toLocaleString()}`);
    }

    const others = Object.keys(profileData.profiles).filter(name => name !== profileData.active);
    if (others.length > 0) {
      log(`\nOther saved: ${others.join(', ')}`, '💡');
      log('Switch with: mcp-network-analyzer setup --switch <name>');
    }
  }

  section('📦 Storage Configuration');
  if (mode === 'hf-dataset') {
    log('Mode:        🤗 HuggingFace Dataset');
    log(`Repository:  ${env.HF_DATASET_REPO ?? 'Not set'}`);
    log(`Privacy:     ${env.HF_DATASET_PRIVATE === 'true' ? 'Private' : 'Public'}`);

    if (env.HF_TOKEN) {
      const tokenCheck = await checkHFToken(env.HF_TOKEN);
      if (tokenCheck.valid) {
        log(`Token:       ✓ Valid (user: ${tokenCheck.username})`);
      } else {
        log('Token:       ❌ Invalid or expired');
      }
    } else {
      log('Token:       ❌ Not configured');
    }
  } else if (mode === 'cloud') {
    log('Mode:        ☁️  Cloud Storage');
    log(`Provider:    ${env.MCP_CLOUD_PROVIDER ?? 'Unknown'}`);
    log(`Bucket:      ${env.MCP_CLOUD_BUCKET ?? 'Not set'}`);
    log(`Region:      ${env.MCP_CLOUD_REGION ?? 'Not set'}`);
  } else {
    log('Mode:        💾 Local (file system)');
    log(`Directory:   ${env.MCP_NETWORK_ANALYZER_DATA ?? './mcp-network-data'}`);
  }

  section('📊 Data Statistics');
  const stats = await getDataStats(context.projectRoot);
  log(`Captures:    ${stats.captures} sessions`);
  log(`Analyses:    ${stats.analyses} reports`);
  log(`Total Size:  ${stats.totalSize}`);

  section('🔨 Build Status');
  const buildStatus = await checkBuildStatus(context.projectRoot);
  if (!buildStatus.built) {
    log('Status:      ❌ Not built');
    log('Action:      Run `pr build`', '💡');
  } else if (buildStatus.needsRebuild) {
    log('Status:      ⚠️  Needs rebuild (source files changed)');
    log(`Last Built:  ${buildStatus.lastBuilt}`);
    log('Action:      Run `pr build`', '💡');
  } else {
    log('Status:      ✓ Up to date');
    log(`Last Built:  ${buildStatus.lastBuilt}`);
  }

  section('⚡ Quick Actions');
  console.log('');
  console.log('  mcp-network-analyzer setup');
  console.log('  mcp-network-analyzer install-claude');
  console.log('  mcp-network-analyzer serve');
  console.log('');
}
