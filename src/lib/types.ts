/**
 * Core type definitions for MCP Network Analyzer
 */

export interface CapturedRequest {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  resourceType: string; // 'xhr', 'fetch', 'document', 'script', 'stylesheet', 'image', etc.
  postData?: string;
  searchableContent?: string; // Indexed content for search
}

export interface CapturedResponse {
  id: string;
  requestId: string;
  timestamp: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  size: number;
  mimeType?: string;
  searchableContent?: string; // Indexed content for search
}

export interface CaptureSession {
  id: string;
  url: string;
  startTime: string;
  endTime?: string;
  userAgent: string;
  viewport: { width: number; height: number };
  requests: CapturedRequest[];
  responses: CapturedResponse[];
  metadata: {
    totalRequests: number;
    totalResponses: number;
    capturedRequestTypes: Record<string, number>;
    domains: string[];
  };
}

export interface BrowserConfig {
  headless?: boolean;
  stealth?: boolean;
  viewport?: { width: number; height: number };
  userAgent?: string;
  timeout?: number;
}

export interface InterceptorOptions {
  includeResourceTypes?: string[];
  excludeResourceTypes?: string[];
  ignoreStaticAssets?: boolean;
}

export interface StorageResult {
  success: boolean;
  path?: string;
  error?: string;
}
