import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface CliContext {
  projectRoot: string;
}

export interface Profile {
  mode: string;
  transport?: string;
  env: Record<string, string>;
  description?: string;
  createdAt: string;
}

export interface ProfileData {
  profiles: Record<string, Profile>;
  active: string | null;
}

export function getEnvPath(projectRoot: string): string {
  return join(projectRoot, '.env');
}

export function getProfilesPath(projectRoot: string): string {
  return join(projectRoot, '.env.profiles.json');
}

export function parseEnvContent(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    if (!line.includes('=') || line.trim().startsWith('#')) {
      continue;
    }

    const [key, ...rest] = line.split('=');
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      continue;
    }

    env[normalizedKey] = rest.join('=').trim();
  }

  return env;
}

export async function loadEnvFile(projectRoot: string): Promise<Record<string, string>> {
  const envPath = getEnvPath(projectRoot);
  if (!existsSync(envPath)) {
    return {};
  }

  const content = await readFile(envPath, 'utf-8');
  return parseEnvContent(content);
}

export async function writeEnvFile(projectRoot: string, env: Record<string, string>): Promise<void> {
  const envPath = getEnvPath(projectRoot);
  const lines = Object.entries(env).map(([key, value]) => `${key}=${value}`);
  await writeFile(envPath, `${lines.join('\n')}\n`, 'utf-8');
}

export async function loadProfiles(projectRoot: string): Promise<ProfileData> {
  const profilesPath = getProfilesPath(projectRoot);

  try {
    if (existsSync(profilesPath)) {
      const data = await readFile(profilesPath, 'utf-8');
      return JSON.parse(data) as ProfileData;
    }
  } catch {
    // Ignore malformed profile file and return empty structure.
  }

  return { profiles: {}, active: null };
}

export async function saveProfiles(projectRoot: string, profiles: ProfileData): Promise<void> {
  const profilesPath = getProfilesPath(projectRoot);
  await writeFile(profilesPath, JSON.stringify(profiles, null, 2), 'utf-8');
}
