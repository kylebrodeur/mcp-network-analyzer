/**
 * Configuration management for MCP Network Analyzer
 * Supports local and cloud storage modes
 */

import { homedir } from 'node:os';
import { resolve } from 'node:path';

export type StorageMode = 'local' | 'cloud';

export interface CloudStorageConfig {
  provider: 'aws-s3' | 'gcp-storage' | 'azure-blob' | 'custom';
  bucket?: string;
  region?: string;
  endpoint?: string;
  credentials?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    [key: string]: string | undefined;
  };
}

export interface ConfigOptions {
  mode: StorageMode;
  localDataDir?: string;
  cloudStorage?: CloudStorageConfig;
}

export class Config {
  private static instance: Config | null = null;
  private config: ConfigOptions;

  private constructor() {
    // Initialize with environment variables or defaults
    this.config = this.loadFromEnvironment();
  }

  /**
   * Get the singleton config instance
   */
  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  /**
   * Reset the singleton (useful for testing)
   */
  static reset(): void {
    Config.instance = null;
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): ConfigOptions {
    const mode = (process.env.MCP_STORAGE_MODE || 'local') as StorageMode;
    const localDataDir = this.normalizeLocalPath(process.env.MCP_NETWORK_ANALYZER_DATA);
    
    const config: ConfigOptions = {
      mode,
      localDataDir
    };

    // Load cloud storage configuration if in cloud mode
    if (mode === 'cloud') {
      config.cloudStorage = {
        provider: (process.env.MCP_CLOUD_PROVIDER || 'aws-s3') as any,
        bucket: process.env.MCP_CLOUD_BUCKET,
        region: process.env.MCP_CLOUD_REGION,
        endpoint: process.env.MCP_CLOUD_ENDPOINT,
        credentials: {
          accessKeyId: process.env.MCP_CLOUD_ACCESS_KEY_ID,
          secretAccessKey: process.env.MCP_CLOUD_SECRET_ACCESS_KEY
        }
      };
    }

    return config;
  }

  /**
   * Expand shell-style home paths for local directory configuration
   */
  private normalizeLocalPath(input?: string): string | undefined {
    if (!input) {
      return undefined;
    }

    const trimmed = input.trim();
    if (!trimmed) {
      return undefined;
    }

    if (trimmed === '~') {
      return homedir();
    }

    if (trimmed.startsWith('~/')) {
      return resolve(homedir(), trimmed.slice(2));
    }

    if (trimmed.startsWith('~\\')) {
      return resolve(homedir(), trimmed.slice(2));
    }

    return trimmed;
  }

  /**
   * Get the current storage mode
   */
  getMode(): StorageMode {
    return this.config.mode;
  }

  /**
   * Check if running in local mode
   */
  isLocalMode(): boolean {
    return this.config.mode === 'local';
  }

  /**
   * Check if running in cloud mode
   */
  isCloudMode(): boolean {
    return this.config.mode === 'cloud';
  }

  /**
   * Get local data directory (if configured)
   */
  getLocalDataDir(): string | undefined {
    return this.config.localDataDir;
  }

  /**
   * Get cloud storage configuration (if configured)
   */
  getCloudStorageConfig(): CloudStorageConfig | undefined {
    return this.config.cloudStorage;
  }

  /**
   * Update configuration programmatically
   */
  updateConfig(options: Partial<ConfigOptions>): void {
    this.config = { ...this.config, ...options };
  }

  /**
   * Get the full configuration
   */
  getConfig(): Readonly<ConfigOptions> {
    return { ...this.config };
  }
}
