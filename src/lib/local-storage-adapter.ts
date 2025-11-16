/**
 * Local file system storage adapter
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Config } from './config.js';
import { BaseStorageAdapter } from './storage-adapter.js';
import type { CaptureSession, StorageResult } from './types.js';

// Get the project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

/**
 * Local file system storage adapter
 */
export class LocalStorageAdapter extends BaseStorageAdapter {
  private dataDir: string;
  private capturesDir: string;

  constructor() {
    super();
    this.dataDir = this.determineDataDirectory();
    this.capturesDir = join(this.dataDir, 'captures');
  }

  /**
   * Determine the data directory based on configuration and environment
   */
  private determineDataDirectory(): string {
    const config = Config.getInstance();
    
    // First priority: config or environment variable
    const configuredDir = config.getLocalDataDir();
    if (configuredDir) {
      console.error(`[LocalStorageAdapter] Using configured data directory: ${configuredDir}`);
      return configuredDir;
    }

    // Second priority: If running as installed package, use cwd()/mcp-network-data
    const cwd = process.cwd();
    console.error(`[LocalStorageAdapter] process.cwd(): ${cwd}`);
    console.error(`[LocalStorageAdapter] PROJECT_ROOT: ${PROJECT_ROOT}`);
    
    if (cwd !== PROJECT_ROOT) {
      const dataPath = join(cwd, 'mcp-network-data');
      console.error(`[LocalStorageAdapter] Using cwd-based data directory: ${dataPath}`);
      return dataPath;
    }

    // Default: Use package data directory (for development)
    console.error(`[LocalStorageAdapter] Using project data directory: ${join(PROJECT_ROOT, 'data')}`);
    return join(PROJECT_ROOT, 'data');
  }

  /**
   * Initialize local storage directories
   */
  async initialize(): Promise<void> {
    // Ensure base data directory exists first
    await mkdir(this.dataDir, { recursive: true });
    await mkdir(this.capturesDir, { recursive: true });
    await mkdir(join(this.dataDir, 'analyses'), { recursive: true });
    await mkdir(join(this.dataDir, 'generated'), { recursive: true });
  }

  /**
   * Get the data directory path
   */
  getDataDirectory(): string {
    return this.dataDir;
  }

  /**
   * Get the path for a capture session
   */
  getSessionPath(sessionId: string): string {
    return join(this.capturesDir, sessionId);
  }

  /**
   * Save a capture session to local disk
   */
  async saveCaptureSession(session: CaptureSession): Promise<StorageResult> {
    try {
      const sessionPath = this.getSessionPath(session.id);
      await mkdir(sessionPath, { recursive: true });

      // Save complete session data
      const sessionFilePath = join(sessionPath, 'session.json');
      await writeFile(sessionFilePath, this.serializeData(session), 'utf-8');

      // Save individual components for easier access
      const requestsPath = join(sessionPath, 'requests.json');
      await writeFile(requestsPath, this.serializeData(session.requests), 'utf-8');

      const responsesPath = join(sessionPath, 'responses.json');
      await writeFile(responsesPath, this.serializeData(session.responses), 'utf-8');

      // Save metadata
      const metadataPath = join(sessionPath, 'metadata.json');
      await writeFile(metadataPath, this.serializeData(this.createMetadata(session)), 'utf-8');

      return {
        success: true,
        path: sessionPath
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Save arbitrary data to a specific path
   */
  async saveData(relativePath: string, data: unknown): Promise<StorageResult> {
    try {
      const fullPath = join(this.dataDir, relativePath);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, this.serializeData(data), 'utf-8');

      return {
        success: true,
        path: fullPath
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
