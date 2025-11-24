/**
 * JSON-based database service for MCP network analyzer
 * Portable solution that works in all deployment environments without native dependencies
 * Manages analysis IDs, discovery IDs, and their relationships using JSON files
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Storage } from './storage.js';

interface CaptureRecord {
  id: string;
  sessionId: string;
  targetUrl: string;
  timestamp: string;
  requestCount: number;
  responseCount: number;
  status: 'active' | 'complete' | 'failed';
  createdAt: string;
}

interface AnalysisRecord {
  id: string;
  captureId: string;
  timestamp: string;
  status: 'processing' | 'complete' | 'failed';
  filePath?: string;
  totalRequests: number;
  totalResponses: number;
  apiEndpoints: number;
  staticAssets: number;
  errorCount: number;
  createdAt: string;
}

interface DiscoveryRecord {
  id: string;
  analysisId: string;
  timestamp: string;
  status: 'processing' | 'complete' | 'failed';
  filePath?: string;
  patternsFound: number;
  paginationDetected: boolean;
  rateLimitingDetected: boolean;
  createdAt: string;
}

interface GenerationRecord {
  id: string;
  discoveryId: string;
  toolName: string;
  language: string;
  timestamp: string;
  status: 'processing' | 'complete' | 'failed';
  filePath?: string;
  linesOfCode?: number;
  tokensUsed?: number;
  createdAt: string;
}

interface DatabaseData {
  captures: Record<string, CaptureRecord>;
  analyses: Record<string, AnalysisRecord>;
  discoveries: Record<string, DiscoveryRecord>;
  generations: Record<string, GenerationRecord>;
  metadata: {
    version: string;
    lastUpdated: string;
  };
}

export class DatabaseService {
  private static instance: DatabaseService | null = null;
  private dbPath: string | null = null;
  private data: DatabaseData | null = null;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!this.instance) {
      this.instance = new DatabaseService();
    }
    return this.instance;
  }

  /**
   * Initialize the database
   */
  public async initialize(): Promise<void> {
    if (this.data) {
      return; // Already initialized
    }

    const dataDir = Storage.getDataDirectory();
    await mkdir(dataDir, { recursive: true });
    
    this.dbPath = join(dataDir, 'mcp-analyzer.db.json');
    
    await this.loadData();
  }

  /**
   * Load database from JSON file
   */
  private async loadData(): Promise<void> {
    if (!this.dbPath) throw new Error('Database not initialized');

    if (existsSync(this.dbPath)) {
      try {
        const content = await readFile(this.dbPath, 'utf-8');
        this.data = JSON.parse(content);
      } catch (error) {
        console.error('Failed to load database, creating new one:', error);
        this.data = this.createEmptyDatabase();
      }
    } else {
      this.data = this.createEmptyDatabase();
    }

    // Ensure data has the expected structure
    if (!this.data) throw new Error('Failed to load database');
    
    if (!this.data.captures) this.data.captures = {};
    if (!this.data.analyses) this.data.analyses = {};
    if (!this.data.discoveries) this.data.discoveries = {};
    if (!this.data.generations) this.data.generations = {};
    if (!this.data.metadata) {
      this.data.metadata = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Create empty database structure
   */
  private createEmptyDatabase(): DatabaseData {
    return {
      captures: {},
      analyses: {},
      discoveries: {},
      generations: {},
      metadata: {
        version: '1.0.0',
        lastUpdated: new Date().toISOString()
      }
    };
  }

  /**
   * Save database to JSON file
   */
  private async saveData(): Promise<void> {
    if (!this.dbPath || !this.data) throw new Error('Database not initialized');

    this.data.metadata.lastUpdated = new Date().toISOString();
    
    try {
      await writeFile(this.dbPath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save database:', error);
      throw error;
    }
  }

  /**
   * Generate a unique analysis ID and create record
   */
  public async createAnalysis(captureId: string): Promise<string> {
    if (!this.data) throw new Error('Database not initialized');

    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date().toISOString();
    
    this.data.analyses[analysisId] = {
      id: analysisId,
      captureId,
      timestamp: now,
      status: 'processing',
      totalRequests: 0,
      totalResponses: 0,
      apiEndpoints: 0,
      staticAssets: 0,
      errorCount: 0,
      createdAt: now
    };

    await this.saveData();
    return analysisId;
  }

  /**
   * Update analysis record with results
   */
  public async updateAnalysis(id: string, data: Partial<AnalysisRecord>): Promise<void> {
    if (!this.data) throw new Error('Database not initialized');

    const existing = this.data.analyses[id];
    if (!existing) {
      throw new Error(`Analysis ${id} not found`);
    }

    // Update fields
    Object.assign(existing, data);
    
    await this.saveData();
  }

  /**
   * Generate a unique discovery ID and create record
   */
  public async createDiscovery(analysisId: string): Promise<string> {
    if (!this.data) throw new Error('Database not initialized');

    const discoveryId = `discovery_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date().toISOString();
    
    this.data.discoveries[discoveryId] = {
      id: discoveryId,
      analysisId,
      timestamp: now,
      status: 'processing',
      patternsFound: 0,
      paginationDetected: false,
      rateLimitingDetected: false,
      createdAt: now
    };

    await this.saveData();
    return discoveryId;
  }

  /**
   * Update discovery record with results
   */
  public async updateDiscovery(id: string, data: Partial<DiscoveryRecord>): Promise<void> {
    if (!this.data) throw new Error('Database not initialized');

    const existing = this.data.discoveries[id];
    if (!existing) {
      throw new Error(`Discovery ${id} not found`);
    }

    // Update fields
    Object.assign(existing, data);
    
    await this.saveData();
  }

  /**
   * Generate a unique generation ID and create record
   */
  public async createGeneration(discoveryId: string, toolName: string, language: string): Promise<string> {
    if (!this.data) throw new Error('Database not initialized');

    const generationId = `generation_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date().toISOString();
    
    this.data.generations[generationId] = {
      id: generationId,
      discoveryId,
      toolName,
      language,
      timestamp: now,
      status: 'processing',
      createdAt: now
    };

    await this.saveData();
    return generationId;
  }

  /**
   * Update generation record with results
   */
  public async updateGeneration(id: string, data: Partial<GenerationRecord>): Promise<void> {
    if (!this.data) throw new Error('Database not initialized');

    const existing = this.data.generations[id];
    if (!existing) {
      throw new Error(`Generation ${id} not found`);
    }

    // Update fields
    Object.assign(existing, data);
    
    await this.saveData();
  }

  /**
   * Get analysis by ID
   */
  public getAnalysis(id: string): AnalysisRecord | null {
    if (!this.data) throw new Error('Database not initialized');
    return this.data.analyses[id] || null;
  }

  /**
   * Get discovery by ID
   */
  public getDiscovery(id: string): DiscoveryRecord | null {
    if (!this.data) throw new Error('Database not initialized');
    return this.data.discoveries[id] || null;
  }

  /**
   * List all analyses
   */
  public listAnalyses(): AnalysisRecord[] {
    if (!this.data) throw new Error('Database not initialized');
    return Object.values(this.data.analyses).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * List all discoveries
   */
  public listDiscoveries(): DiscoveryRecord[] {
    if (!this.data) throw new Error('Database not initialized');
    return Object.values(this.data.discoveries).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Get database statistics
   */
  public getStats() {
    if (!this.data) throw new Error('Database not initialized');

    return {
      captures: Object.keys(this.data.captures).length,
      analyses: Object.keys(this.data.analyses).length,
      discoveries: Object.keys(this.data.discoveries).length,
      generations: Object.keys(this.data.generations).length,
      lastUpdated: this.data.metadata.lastUpdated,
      version: this.data.metadata.version
    };
  }

  /**
   * Clear all data (for testing)
   */
  public async clear(): Promise<void> {
    this.data = this.createEmptyDatabase();
    await this.saveData();
  }

  /**
   * Get the raw data (for debugging)
   */
  public getData(): DatabaseData | null {
    return this.data;
  }
}