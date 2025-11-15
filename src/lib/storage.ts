/**
 * Storage layer for persisting captured network data
 * Supports local, cloud, and Blaxel storage modes through adapters
 */

import { randomUUID } from 'node:crypto';
import type { CaptureSession, StorageResult } from './types.js';
import type { IStorageAdapter } from './storage-adapter.js';
import { LocalStorageAdapter } from './local-storage-adapter.js';
import { CloudStorageAdapter } from './cloud-storage-adapter.js';
import { createBlaxelStorageAdapter } from './blaxel-storage-adapter.js';
import { Config } from './config.js';

/**
 * Storage facade that delegates to the appropriate adapter
 */
export class Storage {
  private static adapter: IStorageAdapter | null = null;

  /**
   * Get the storage adapter (lazy initialization)
   */
  private static getAdapter(): IStorageAdapter {
    if (!this.adapter) {
      const config = Config.getInstance();
      
      if (config.isBlaxelMode()) {
        this.adapter = createBlaxelStorageAdapter();
      } else if (config.isCloudMode()) {
        this.adapter = new CloudStorageAdapter();
      } else {
        this.adapter = new LocalStorageAdapter();
      }
    }
    
    return this.adapter;
  }

  /**
   * Reset the adapter (useful for testing or mode switching)
   */
  static resetAdapter(): void {
    this.adapter = null;
  }

  /**
   * Get the data directory path
   */
  static getDataDirectory(): string {
    return this.getAdapter().getDataDirectory();
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
    return this.getAdapter().getSessionPath(sessionId);
  }

  /**
   * Ensure data directories exist
   */
  static async ensureDirectories(): Promise<void> {
    await this.getAdapter().initialize();
  }

  /**
   * Save a capture session
   */
  static async saveCaptureSession(session: CaptureSession): Promise<StorageResult> {
    return this.getAdapter().saveCaptureSession(session);
  }

  /**
   * Save arbitrary data to a specific path
   */
  static async saveData(relativePath: string, data: unknown): Promise<StorageResult> {
    return this.getAdapter().saveData(relativePath, data);
  }

  /**
   * Get current storage mode
   */
  static getMode(): string {
    return Config.getInstance().getMode();
  }
}
