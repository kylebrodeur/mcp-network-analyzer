#!/usr/bin/env tsx
/**
 * Storage mode test
 * Verifies local and cloud storage configurations work correctly
 */

import { Config } from '../src/lib/config.js';
import { Storage } from '../src/lib/storage.js';
import type { CaptureSession } from '../src/lib/types.js';

const createMockSession = (): CaptureSession => ({
  id: 'test_session_' + Date.now(),
  url: 'https://example.com',
  startTime: new Date().toISOString(),
  endTime: new Date().toISOString(),
  userAgent: 'Test User Agent',
  viewport: { width: 1920, height: 1080 },
  requests: [
    {
      id: 'req_1',
      timestamp: new Date().toISOString(),
      method: 'GET',
      url: 'https://example.com/api/data',
      headers: { 'content-type': 'application/json' },
      resourceType: 'fetch'
    }
  ],
  responses: [
    {
      id: 'res_1',
      requestId: 'req_1',
      timestamp: new Date().toISOString(),
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"test": "data"}',
      size: 16
    }
  ],
  metadata: {
    totalRequests: 1,
    totalResponses: 1,
    capturedRequestTypes: { fetch: 1 },
    domains: ['example.com']
  }
});

async function testLocalMode(): Promise<boolean> {
  console.log('\n=== Testing Local Mode ===');

  Config.reset();
  Storage.resetAdapter();
  process.env.MCP_STORAGE_MODE = 'local';

  const config = Config.getInstance();
  console.log('Mode:', config.getMode());
  console.log('Is Local Mode:', config.isLocalMode());

  await Storage.ensureDirectories();
  console.log('Data Directory:', Storage.getDataDirectory());

  const session = createMockSession();
  console.log('Session ID:', session.id);

  const result = await Storage.saveCaptureSession(session);
  console.log('Save Result:', result.success ? '✓ Success' : '✗ Failed');
  if (result.path) console.log('Saved to:', result.path);
  if (result.error) console.error('Error:', result.error);

  return result.success;
}

async function testCloudMode(): Promise<boolean> {
  console.log('\n=== Testing Cloud Mode ===');

  Config.reset();
  Storage.resetAdapter();
  process.env.MCP_STORAGE_MODE = 'cloud';
  process.env.MCP_CLOUD_PROVIDER = 'aws-s3';
  process.env.MCP_CLOUD_BUCKET = 'test-bucket';
  process.env.MCP_CLOUD_REGION = 'us-east-1';

  const config = Config.getInstance();
  console.log('Mode:', config.getMode());
  console.log('Is Cloud Mode:', config.isCloudMode());

  try {
    await Storage.ensureDirectories();
    console.log('Data Directory:', Storage.getDataDirectory());

    const session = createMockSession();
    console.log('Session ID:', session.id);

    const result = await Storage.saveCaptureSession(session);
    console.log('Save Result:', result.success ? '✓ Success' : '✗ Failed');
    if (result.path) console.log('Saved to:', result.path);
    if (result.error) console.error('Error:', result.error);

    return result.success;
  } catch (error) {
    console.error('Error during cloud mode test:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function main(): Promise<void> {
  console.log('MCP Network Analyzer - Storage Mode Test\n');

  const results = { local: false, cloud: false };

  try {
    results.local = await testLocalMode();
    results.cloud = await testCloudMode();
  } catch (error) {
    console.error('\nTest error:', error);
  }

  console.log('\n=== Test Results ===');
  console.log('Local Mode:', results.local ? '✓ PASS' : '✗ FAIL');
  console.log('Cloud Mode:', results.cloud ? '✓ PASS' : '✗ FAIL');

  const allPassed = results.local && results.cloud;
  console.log('\nOverall:', allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED');

  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
