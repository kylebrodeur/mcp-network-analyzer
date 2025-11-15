/**
 * Storage adapter interface and implementations
 * Provides abstraction for local and cloud storage
 */

import type { CaptureSession, StorageResult } from './types.js';

/**
 * Abstract storage adapter interface
 */
export interface IStorageAdapter {
  /**
   * Initialize the storage adapter
   */
  initialize(): Promise<void>;

  /**
   * Save a capture session
   */
  saveCaptureSession(session: CaptureSession): Promise<StorageResult>;

  /**
   * Save arbitrary data to a path
   */
  saveData(relativePath: string, data: unknown): Promise<StorageResult>;

  /**
   * Get the session path for a given session ID
   */
  getSessionPath(sessionId: string): string;

  /**
   * Get the base data directory
   */
  getDataDirectory(): string;
}

/**
 * Base implementation with common utilities
 */
export abstract class BaseStorageAdapter implements IStorageAdapter {
  abstract initialize(): Promise<void>;
  abstract saveCaptureSession(session: CaptureSession): Promise<StorageResult>;
  abstract saveData(relativePath: string, data: unknown): Promise<StorageResult>;
  abstract getSessionPath(sessionId: string): string;
  abstract getDataDirectory(): string;

  /**
   * Serialize data to JSON string
   */
  protected serializeData(data: unknown): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Create metadata object from capture session
   */
  protected createMetadata(session: CaptureSession) {
    return {
      id: session.id,
      url: session.url,
      startTime: session.startTime,
      endTime: session.endTime,
      userAgent: session.userAgent,
      viewport: session.viewport,
      metadata: session.metadata
    };
  }
}
