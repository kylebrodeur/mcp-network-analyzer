/**
 * Network capture tool implementation
 * Orchestrates browser automation, network interception, and data storage
 */

import { BrowserManager } from '../lib/browser.js';
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
  const browserManager = new BrowserManager({
    headless: true,
    stealth: true
  });

  const interceptor = new NetworkInterceptor({
    includeResourceTypes: options.includeResourceTypes,
    excludeResourceTypes: options.excludeResourceTypes,
    ignoreStaticAssets: options.ignoreStaticAssets ?? true
  });

  try {
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
        `Next: Run analyze_captured_data with captureId: ${sessionId}`
      ]
    };

    // Get viewport and user agent
    const viewport = page.viewportSize() || { width: 1920, height: 1080 };
    const userAgent = await page.evaluate(() => navigator.userAgent);

    // Create capture session
    const captureSession: CaptureSession = {
      id: sessionId,
      url: options.url,
      startTime,
      endTime,
      userAgent,
      viewport,
      requests,
      responses,
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
      captureId: sessionId,
      sessionPath: saveResult.path,
      totalRequests: requests.length,
      totalResponses: responses.length,
      domains,
      analysis
    };
  } catch (error) {
    return {
      success: false,
      captureId: sessionId,
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
