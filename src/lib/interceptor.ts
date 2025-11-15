/**
 * Network interceptor for capturing HTTP requests and responses
 * Uses Playwright's route interception and CDPSession for detailed data
 */

import { randomUUID } from 'node:crypto';
import type { Page, Route } from 'playwright';
import type { CapturedRequest, CapturedResponse, InterceptorOptions } from './types.js';

const DEFAULT_STATIC_ASSET_TYPES = [
  'stylesheet',
  'image',
  'media',
  'font',
  'imageset',
  'texttrack',
  'eventsource',
  'manifest'
];

export class NetworkInterceptor {
  private requests: CapturedRequest[] = [];
  private responses: CapturedResponse[] = [];
  private requestMap = new Map<string, CapturedRequest>();
  private options: InterceptorOptions;
  private isActive = false;

  constructor(options: InterceptorOptions = {}) {
    this.options = {
      includeResourceTypes: options.includeResourceTypes,
      excludeResourceTypes: options.excludeResourceTypes,
      ignoreStaticAssets: options.ignoreStaticAssets ?? true
    };
  }

  async attach(page: Page): Promise<void> {
    if (this.isActive) {
      throw new Error('Interceptor is already attached');
    }

    this.isActive = true;

    // Enable request interception
    await page.route('**/*', async (route: Route) => {
      const request = route.request();
      const resourceType = request.resourceType();

      // Check if we should capture this request
      if (!this.shouldCapture(resourceType)) {
        await route.continue();
        return;
      }

      // Capture request details
      const capturedRequest: CapturedRequest = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        method: request.method(),
        url: request.url(),
        headers: await request.allHeaders(),
        resourceType,
        body: request.postData() || undefined,
        postData: request.postData() || undefined
      };

      this.requests.push(capturedRequest);
      this.requestMap.set(request.url(), capturedRequest);

      await route.continue();
    });

    // Capture responses
    page.on('response', async response => {
      const request = response.request();
      const url = request.url();
      const resourceType = request.resourceType();

      // Check if we captured this request
      if (!this.shouldCapture(resourceType)) {
        return;
      }

      const matchingRequest = this.requestMap.get(url);
      if (!matchingRequest) {
        return;
      }

      try {
        const body = await response.text();
        const headers = await response.allHeaders();

        const capturedResponse: CapturedResponse = {
          id: randomUUID(),
          requestId: matchingRequest.id,
          timestamp: new Date().toISOString(),
          status: response.status(),
          statusText: response.statusText(),
          headers,
          body,
          size: body.length,
          mimeType: headers['content-type']
        };

        this.responses.push(capturedResponse);
      } catch (error) {
        // Some responses might fail to read (e.g., binary data, network errors)
        console.error(`Failed to capture response for ${url}:`, error);
      }
    });
  }

  private shouldCapture(resourceType: string): boolean {
    // Check explicit include list
    if (this.options.includeResourceTypes && this.options.includeResourceTypes.length > 0) {
      return this.options.includeResourceTypes.includes(resourceType);
    }

    // Check explicit exclude list
    if (this.options.excludeResourceTypes && this.options.excludeResourceTypes.length > 0) {
      return !this.options.excludeResourceTypes.includes(resourceType);
    }

    // Check if we should ignore static assets
    if (this.options.ignoreStaticAssets) {
      return !DEFAULT_STATIC_ASSET_TYPES.includes(resourceType);
    }

    return true;
  }

  getRequests(): CapturedRequest[] {
    return [...this.requests];
  }

  getResponses(): CapturedResponse[] {
    return [...this.responses];
  }

  clear(): void {
    this.requests = [];
    this.responses = [];
    this.requestMap.clear();
  }

  detach(): void {
    this.isActive = false;
  }

  isAttached(): boolean {
    return this.isActive;
  }
}
