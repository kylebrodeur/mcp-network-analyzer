/**
 * Blaxel cloud storage adapter
 * Integrates with Blaxel hosting service for MCP data storage
 */

import type { CaptureSession, StorageResult } from './types.js';
import { BaseStorageAdapter } from './storage-adapter.js';

export interface BlaxelConfig {
  apiKey?: string;
  endpoint?: string;
  projectId?: string;
}

/**
 * Blaxel storage adapter for MCP hosting
 * Provides cloud storage optimized for Blaxel hosting platform
 */
export class BlaxelStorageAdapter extends BaseStorageAdapter {
  private config: BlaxelConfig;
  private basePrefix: string;
  private apiEndpoint: string;

  constructor(config: BlaxelConfig) {
    super();
    this.config = config;
    this.basePrefix = 'mcp-network-analyzer';
    // Use custom endpoint or default to Blaxel API
    this.apiEndpoint = config.endpoint || 'https://api.blaxel.ai';
  }

  /**
   * Initialize Blaxel storage
   */
  async initialize(): Promise<void> {
    console.error('[Blaxel Storage] Initializing Blaxel integration...');
    
    // Validate configuration
    if (!this.config.apiKey && !process.env.BLAXEL_API_KEY) {
      console.error('[Blaxel Storage] Warning: No API key configured. Storage will operate in mock mode.');
    }

    if (this.config.projectId) {
      console.error(`[Blaxel Storage] Project ID: ${this.config.projectId}`);
    }

    console.error(`[Blaxel Storage] Endpoint: ${this.apiEndpoint}`);
    console.error('[Blaxel Storage] Initialized successfully');
  }

  /**
   * Get the base data directory (Blaxel storage path)
   */
  getDataDirectory(): string {
    const projectId = this.config.projectId || 'default';
    return `blaxel://${projectId}/${this.basePrefix}`;
  }

  /**
   * Get the path for a capture session in Blaxel storage
   */
  getSessionPath(sessionId: string): string {
    const projectId = this.config.projectId || 'default';
    return `${this.basePrefix}/captures/${sessionId}`;
  }

  /**
   * Save a capture session to Blaxel storage
   */
  async saveCaptureSession(session: CaptureSession): Promise<StorageResult> {
    try {
      const sessionPath = this.getSessionPath(session.id);
      const projectId = this.config.projectId || 'default';

      // Prepare data for Blaxel API
      const payload = {
        sessionId: session.id,
        path: sessionPath,
        data: {
          session: this.serializeData(session),
          requests: this.serializeData(session.requests),
          responses: this.serializeData(session.responses),
          metadata: this.serializeData(this.createMetadata(session))
        },
        timestamp: new Date().toISOString()
      };

      console.error(`[Blaxel Storage] Saving session ${session.id} to project ${projectId}`);
      console.error(`[Blaxel Storage] Path: ${sessionPath}`);
      console.error(`[Blaxel Storage] Data size: ${JSON.stringify(payload).length} bytes`);

      // TODO: Implement actual Blaxel API call
      // For now, this is a mock implementation
      await this.mockBlaxelUpload(payload);

      return {
        success: true,
        path: `blaxel://${projectId}/${sessionPath}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Save arbitrary data to Blaxel storage
   */
  async saveData(relativePath: string, data: unknown): Promise<StorageResult> {
    try {
      const projectId = this.config.projectId || 'default';
      const fullPath = `${this.basePrefix}/${relativePath}`;

      const payload = {
        path: fullPath,
        data: this.serializeData(data),
        timestamp: new Date().toISOString()
      };

      console.error(`[Blaxel Storage] Saving data to ${fullPath}`);
      
      // TODO: Implement actual Blaxel API call
      await this.mockBlaxelUpload(payload);

      return {
        success: true,
        path: `blaxel://${projectId}/${fullPath}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Mock Blaxel upload (placeholder for actual API implementation)
   */
  private async mockBlaxelUpload(payload: any): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // In a real implementation, this would:
    // 1. Authenticate with Blaxel API using API key
    // 2. Upload data to Blaxel storage endpoint
    // 3. Handle errors and retries
    // 4. Return upload confirmation with storage URL
    
    console.error(`[Blaxel Storage] Mock upload completed successfully`);
    
    // Log what would be uploaded in production
    if (process.env.DEBUG === 'true') {
      console.error(`[Blaxel Storage] Payload preview:`, {
        path: payload.path,
        dataSize: typeof payload.data === 'string' ? payload.data.length : JSON.stringify(payload.data).length,
        timestamp: payload.timestamp
      });
    }
  }

  /**
   * Get Blaxel hosting URL for a session
   */
  getHostingUrl(sessionId: string): string {
    const projectId = this.config.projectId || 'default';
    return `${this.apiEndpoint}/projects/${projectId}/captures/${sessionId}`;
  }
}

/**
 * Create a Blaxel storage adapter from environment variables
 */
export function createBlaxelStorageAdapter(): BlaxelStorageAdapter {
  const config: BlaxelConfig = {
    apiKey: process.env.BLAXEL_API_KEY,
    endpoint: process.env.BLAXEL_ENDPOINT,
    projectId: process.env.BLAXEL_PROJECT_ID
  };

  return new BlaxelStorageAdapter(config);
}
