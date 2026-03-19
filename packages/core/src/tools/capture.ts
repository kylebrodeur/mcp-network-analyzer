/**
 * Network capture tool implementation
 * Orchestrates browser automation, network interception, and data storage
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BrowserManager } from '../lib/browser.js';
import { DatabaseService } from '../lib/database.js';
import { NetworkInterceptor } from '../lib/interceptor.js';
import { Storage } from '../lib/storage.js';
import type { CaptureSession } from '../lib/types.js';

export interface CaptureOptions {
  url: string;
  waitForNetworkIdleMs?: number;
  sessionId?: string;
  includeResourceTypes?: string[];
  excludeResourceTypes?: string[];
  ignoreStaticAssets?: boolean;
  onProgress?: (status: string) => void; // Callback for progress updates
}

export interface CaptureResult {
  success: boolean;
  captureId: string;
  sessionPath?: string;
  totalRequests: number;
  totalResponses: number;
  domains: string[];
  analysis: {
    apiEndpoints: Array<{
      method: string;
      url: string;
      resourceType: string;
      hasBody: boolean;
    }>;
    authenticationHints: {
      cookieBased: boolean;
      cookies: string[];
      customHeaders: string[];
      bearerToken: boolean;
    };
    requestTypeBreakdown: Record<string, number>;
    suggestedNextSteps: string[];
  };
  error?: string;
}

/**
 * Capture network requests from a website
 */
export async function captureNetworkRequests(options: CaptureOptions): Promise<CaptureResult> {
  const sessionId = options.sessionId || Storage.generateSessionId();
  const db = DatabaseService.getInstance();
  
  const browserManager = new BrowserManager({
    headless: true,
    stealth: true
  });

  const interceptor = new NetworkInterceptor({
    includeResourceTypes: options.includeResourceTypes,
    excludeResourceTypes: options.excludeResourceTypes,
    ignoreStaticAssets: options.ignoreStaticAssets ?? true
  });

  let captureId: string | null = null;

  try {
    // Initialize database and create capture record
    options.onProgress?.('Initializing capture tracking...');
    await db.initialize();
    captureId = await db.createCapture(sessionId, options.url);
    
    // Ensure storage directories exist
    options.onProgress?.('Creating data directories...');
    await Storage.ensureDirectories();
    
    options.onProgress?.(`Data will be saved to: ${Storage.getDataDirectory()}`);

    // Launch browser
    options.onProgress?.('Launching browser...');
    await browserManager.launch();
    const page = browserManager.getPage();

    // Attach network interceptor
    options.onProgress?.('Setting up network interceptor...');
    await interceptor.attach(page);

    // Navigate to target URL
    options.onProgress?.(`Navigating to ${options.url}...`);
    const startTime = new Date().toISOString();
    await browserManager.navigateTo(options.url, true);

    // Wait for additional network activity if specified
    if (options.waitForNetworkIdleMs) {
      options.onProgress?.(`Waiting for network activity (${options.waitForNetworkIdleMs}ms)...`);
      await browserManager.waitForTime(options.waitForNetworkIdleMs);
      await browserManager.waitForNetworkIdle(5000);
    }

    const endTime = new Date().toISOString();
    
    options.onProgress?.('Processing captured data...');

    // Collect captured data
    const requests = interceptor.getRequests();
    const responses = interceptor.getResponses();

    // Update capture record with counts
    await db.updateCapture(captureId, {
      requestCount: requests.length,
      responseCount: responses.length,
      status: 'complete'
    });

    // Extract unique domains
    const domains = Array.from(new Set(requests.map(req => new URL(req.url).hostname)));

    // Count resource types
    const capturedRequestTypes = requests.reduce(
      (acc, req) => {
        acc[req.resourceType] = (acc[req.resourceType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Analyze API endpoints (fetch and xhr requests)
    const apiEndpoints = requests
      .filter(req => req.resourceType === 'fetch' || req.resourceType === 'xhr')
      .map(req => ({
        method: req.method,
        url: req.url,
        resourceType: req.resourceType,
        hasBody: !!req.body || !!req.postData
      }));

    // Detect authentication patterns
    const allCookies = new Set<string>();
    const customHeaders = new Set<string>();
    let hasBearerToken = false;

    requests.forEach(req => {
      // Extract cookie names
      if (req.headers.cookie) {
        req.headers.cookie.split(';').forEach(cookie => {
          const cookieName = cookie.trim().split('=')[0];
          if (cookieName) allCookies.add(cookieName);
        });
      }

      // Look for custom/proprietary headers
      Object.keys(req.headers).forEach(header => {
        if (header.startsWith('x-') || header.includes('auth') || header.includes('token')) {
          customHeaders.add(header);
        }
        // Check for bearer token
        if (header.toLowerCase() === 'authorization' && req.headers[header]?.includes('Bearer')) {
          hasBearerToken = true;
        }
      });
    });

    // Generate analysis insights
    const analysis = {
      apiEndpoints,
      authenticationHints: {
        cookieBased: allCookies.size > 0,
        cookies: Array.from(allCookies),
        customHeaders: Array.from(customHeaders),
        bearerToken: hasBearerToken
      },
      requestTypeBreakdown: capturedRequestTypes,
      suggestedNextSteps: [
        apiEndpoints.length > 0
          ? `Found ${apiEndpoints.length} API endpoint(s). Use analyze_captured_data to extract patterns.`
          : 'No API endpoints detected (only static assets).',
        allCookies.size > 0
          ? `Cookie-based authentication detected with ${allCookies.size} cookie(s).`
          : hasBearerToken
            ? 'Bearer token authentication detected.'
            : 'No obvious authentication mechanism found.',
        `Captured traffic from ${domains.length} domain(s). Main domain: ${new URL(options.url).hostname}`,
        `✅ Capture Complete! Use this ID for next steps:`,
        `📋 Capture ID: ${captureId}`,
        `🔍 Next: Run analyze_captured_data with captureId: ${captureId}`,
        `📊 Or use 'get_next_session_ids' with sessionId: ${sessionId} to see IDs ready for the next phase`
      ]
    };

    // Get viewport and user agent
    const viewport = page.viewportSize() || { width: 1920, height: 1080 };
    const userAgent = await page.evaluate(() => navigator.userAgent);

    // Create capture session with indexed content for search
    const captureSession: CaptureSession = {
      id: sessionId,
      url: options.url,
      startTime,
      endTime,
      userAgent,
      viewport,
      requests: requests.map(req => ({
        ...req,
        // Add searchable content index
        searchableContent: createSearchableContent(req)
      })),
      responses: responses.map(resp => ({
        ...resp,
        // Add searchable content index  
        searchableContent: createSearchableContent(resp)
      })),
      metadata: {
        totalRequests: requests.length,
        totalResponses: responses.length,
        capturedRequestTypes,
        domains
      }
    };

    // Save to disk
    options.onProgress?.('Saving captured data...');
    const saveResult = await Storage.saveCaptureSession(captureSession);

    if (!saveResult.success) {
      throw new Error(`Failed to save capture session: ${saveResult.error}`);
    }
    
    options.onProgress?.('✓ Capture complete!');

    return {
      success: true,
      captureId,
      sessionPath: saveResult.path,
      totalRequests: requests.length,
      totalResponses: responses.length,
      domains,
      analysis
    };
  } catch (error) {
    // Update capture record as failed if we have the ID
    if (captureId) {
      try {
        await db.updateCapture(captureId, { status: 'failed' });
      } catch (dbError) {
        console.error('Failed to update capture status:', dbError);
      }
    }

    return {
      success: false,
      captureId: captureId || sessionId,
      totalRequests: 0,
      totalResponses: 0,
      domains: [],
      analysis: {
        apiEndpoints: [],
        authenticationHints: {
          cookieBased: false,
          cookies: [],
          customHeaders: [],
          bearerToken: false
        },
        requestTypeBreakdown: {},
        suggestedNextSteps: []
      },
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    // Cleanup
    interceptor.detach();
    await browserManager.close();
  }
}

/**
 * Create searchable content for indexing
 */
function createSearchableContent(item: any): string {
  const searchableFields = [];
  
  // Add URL and method for requests
  if (item.url) searchableFields.push(item.url);
  if (item.method) searchableFields.push(item.method);
  
  // Add headers (keys and values that might be searchable)
  if (item.headers) {
    Object.entries(item.headers).forEach(([key, value]) => {
      searchableFields.push(key);
      if (typeof value === 'string' && value.length < 200) {
        // Only include short header values to avoid noise
        searchableFields.push(value);
      }
    });
  }
  
  // Add body content (truncated for performance)
  if (item.body && typeof item.body === 'string') {
    // Only include first 1000 characters of body for search
    searchableFields.push(item.body.substring(0, 1000));
  }
  
  // Add status text for responses
  if (item.statusText) searchableFields.push(item.statusText);
  
  // Add MIME type for responses
  if (item.mimeType) searchableFields.push(item.mimeType);
  
  return searchableFields.join(' ').toLowerCase();
}

export function registerCaptureTool(server: McpServer): void {
  server.registerTool(
    'capture_network_requests',
    {
      title: 'Capture Network Requests',
      description:
        'Launches a Playwright session, persists auth if requested, and records HTTP traffic into data/captures/. A unique sessionId is automatically generated if not provided.',
      inputSchema: z.object({
        url: z.string().url(),
        waitForNetworkIdleMs: z.number().int().positive().max(120000).optional(),
        sessionId: z.string().min(1).nullable().optional(),
        includeResourceTypes: z.array(z.string()).nullable().optional(),
        excludeResourceTypes: z.array(z.string()).nullable().optional(),
        ignoreStaticAssets: z.boolean().optional()
      }).shape
    },
    async ({ url, waitForNetworkIdleMs, sessionId, includeResourceTypes, excludeResourceTypes, ignoreStaticAssets }) => {
      try {
        const result = await captureNetworkRequests({
          url,
          waitForNetworkIdleMs,
          sessionId: sessionId ?? undefined,
          includeResourceTypes: includeResourceTypes ?? undefined,
          excludeResourceTypes: excludeResourceTypes ?? undefined,
          ignoreStaticAssets
        });

        if (!result.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to capture network requests: ${result.error}` }],
            isError: true
          };
        }

        const { analysis } = result;

        return {
          content: [
            {
              type: 'text' as const,
              text: [
                '# Network Capture Complete',
                '',
                `**Capture ID:** ${result.captureId}`,
                `**Target URL:** ${url}`,
                `**Total Requests:** ${result.totalRequests}`,
                `**Total Responses:** ${result.totalResponses}`,
                '',
                '## 📊 Request Type Breakdown',
                ...Object.entries(analysis.requestTypeBreakdown).map(
                  ([type, count]) => `- ${type}: ${count}`
                ),
                '',
                '## 🌐 Domains Accessed',
                ...result.domains.map(domain => `- ${domain}`),
                '',
                '## 🔌 API Endpoints Discovered',
                analysis.apiEndpoints.length > 0
                  ? analysis.apiEndpoints
                      .map(ep => `- ${ep.method} ${ep.url}${ep.hasBody ? ' (with body)' : ''}`)
                      .join('\n')
                  : '- No API endpoints detected (only static resources)',
                '',
                '## 🔐 Authentication Analysis',
                `**Cookie-based:** ${analysis.authenticationHints.cookieBased ? 'Yes' : 'No'}`,
                analysis.authenticationHints.cookies.length > 0
                  ? `**Cookies detected:** ${analysis.authenticationHints.cookies.slice(0, 5).join(', ')}${analysis.authenticationHints.cookies.length > 5 ? ` (+${analysis.authenticationHints.cookies.length - 5} more)` : ''}`
                  : '',
                analysis.authenticationHints.customHeaders.length > 0
                  ? `**Custom headers:** ${analysis.authenticationHints.customHeaders.join(', ')}`
                  : '',
                `**Bearer token:** ${analysis.authenticationHints.bearerToken ? 'Yes' : 'No'}`,
                '',
                '## 📁 Data Saved',
                `- Complete session: ${result.sessionPath}/session.json`,
                `- Requests: ${result.sessionPath}/requests.json`,
                `- Responses: ${result.sessionPath}/responses.json`,
                `- Metadata: ${result.sessionPath}/metadata.json`,
                '',
                '## 🎯 Recommended Next Steps',
                ...analysis.suggestedNextSteps.map((step, i) => `${i + 1}. ${step}`)
              ]
                .filter(line => line !== '')
                .join('\n')
            }
          ]
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error capturing network requests: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true
        };
      }
    }
  );
}
