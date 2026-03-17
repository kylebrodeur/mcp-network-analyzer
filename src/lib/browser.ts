/**
 * Browser automation wrapper using Playwright
 * Handles browser lifecycle, stealth configuration, and page management
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { BrowserConfig } from './types.js';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DEFAULT_VIEWPORT = { width: 1920, height: 1080 };

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: BrowserConfig;

  constructor(config: BrowserConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      stealth: config.stealth ?? true,
      viewport: config.viewport ?? DEFAULT_VIEWPORT,
      userAgent: config.userAgent ?? DEFAULT_USER_AGENT,
      timeout: config.timeout ?? 30000
    };
  }

  async launch(): Promise<void> {
    if (this.browser) {
      return; // Already launched
    }

    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: this.config.stealth
        ? [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
          ]
        : []
    });

    // Create context with stealth settings
    this.context = await this.browser.newContext({
      viewport: this.config.viewport,
      userAgent: this.config.userAgent,
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation', 'notifications'],
      bypassCSP: false,
      ignoreHTTPSErrors: false
    });

    // Apply additional stealth measures
    if (this.config.stealth) {
      await this.applyStealth(this.context);
    }

    this.page = await this.context.newPage();
    if (this.config.timeout) {
      this.page.setDefaultTimeout(this.config.timeout);
    }
  }

  private async applyStealth(context: BrowserContext): Promise<void> {
    // Override navigator properties to avoid detection
    await context.addInitScript(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });

      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });

      // Override permissions - cast to any to work around type issues in browser context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = globalThis.navigator as any;
      if (nav.permissions) {
        const originalQuery = nav.permissions.query;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nav.permissions.query = (parameters: any) =>
          parameters.name === 'notifications'
            ? Promise.resolve({ state: 'granted' })
            : originalQuery(parameters);
      }
    });
  }

  async navigateTo(url: string, waitForNetworkIdle = false): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const waitUntil = waitForNetworkIdle ? 'networkidle' : 'load';
    await this.page.goto(url, { waitUntil });
  }

  async waitForNetworkIdle(timeoutMs = 2000): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    await this.page.waitForLoadState('networkidle', { timeout: timeoutMs });
  }

  async waitForTime(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  getPage(): Page {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }
    return this.page;
  }

  getContext(): BrowserContext {
    if (!this.context) {
      throw new Error('Browser not launched. Call launch() first.');
    }
    return this.context;
  }

  async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }

    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  isLaunched(): boolean {
    return this.browser !== null && this.context !== null && this.page !== null;
  }
}
