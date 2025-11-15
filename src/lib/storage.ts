/**
 * Storage layer for persisting captured network data
 * Handles JSON serialization and file system operations
 */

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CaptureSession, StorageResult } from './types.js';

// Get the project root directory (2 levels up from this file: lib -> src -> root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

// Allow data directory to be configured via environment variable
// Falls back to: 1) MCP_NETWORK_ANALYZER_DATA env var, 2) cwd()/mcp-network-data, 3) package data dir
const getDataDirectory = (): string => {
  if (process.env.MCP_NETWORK_ANALYZER_DATA) {
    return process.env.MCP_NETWORK_ANALYZER_DATA;
  }
  
  // For installed package: use cwd() + mcp-network-data
  // For development: use package data dir
  if (process.cwd() !== PROJECT_ROOT) {
    return join(process.cwd(), 'mcp-network-data');
  }
  
  return join(PROJECT_ROOT, 'data');
};

const DATA_DIR = getDataDirectory();
const CAPTURES_DIR = join(DATA_DIR, 'captures');

export class Storage {
  /**
   * Get the data directory path
   */
  static getDataDirectory(): string {
    return DATA_DIR;
  }

  /**
   * Generate a unique session ID
   */
  static generateSessionId(): string {
    return `session_${Date.now()}_${randomUUID().slice(0, 8)}`;
  }

  /**
   * Get the path for a capture session
   */
  static getSessionPath(sessionId: string): string {
    return join(CAPTURES_DIR, sessionId);
  }

  /**
   * Ensure data directories exist
   */
  static async ensureDirectories(): Promise<void> {
    await mkdir(CAPTURES_DIR, { recursive: true });
    await mkdir(join(DATA_DIR, 'analyses'), { recursive: true });
    await mkdir(join(DATA_DIR, 'generated'), { recursive: true });
  }

  /**
   * Save a capture session to disk
   */
  static async saveCaptureSession(session: CaptureSession): Promise<StorageResult> {
    try {
      const sessionPath = this.getSessionPath(session.id);
      await mkdir(sessionPath, { recursive: true });

      // Save complete session data
      const sessionFilePath = join(sessionPath, 'session.json');
      await writeFile(sessionFilePath, JSON.stringify(session, null, 2), 'utf-8');

      // Save individual components for easier access
      const requestsPath = join(sessionPath, 'requests.json');
      await writeFile(requestsPath, JSON.stringify(session.requests, null, 2), 'utf-8');

      const responsesPath = join(sessionPath, 'responses.json');
      await writeFile(responsesPath, JSON.stringify(session.responses, null, 2), 'utf-8');

      // Save metadata
      const metadataPath = join(sessionPath, 'metadata.json');
      await writeFile(
        metadataPath,
        JSON.stringify(
          {
            id: session.id,
            url: session.url,
            startTime: session.startTime,
            endTime: session.endTime,
            userAgent: session.userAgent,
            viewport: session.viewport,
            metadata: session.metadata
          },
          null,
          2
        ),
        'utf-8'
      );

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
  static async saveData(
    relativePath: string,
    data: unknown,
    baseDir = DATA_DIR
  ): Promise<StorageResult> {
    try {
      const fullPath = join(baseDir, relativePath);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, JSON.stringify(data, null, 2), 'utf-8');

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
