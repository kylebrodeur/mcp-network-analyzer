#!/usr/bin/env node
/**
 * Simple test script to verify storage functionality
 * Tests local, cloud, and Blaxel storage configurations
 */

import { Config } from '../dist/lib/config.js';
import { Storage } from '../dist/lib/storage.js';

// Mock capture session for testing
const createMockSession = () => ({
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

async function testLocalMode() {
  console.log('\n=== Testing Local Mode ===');
  
  // Reset and configure for local mode
  Config.reset();
  Storage.resetAdapter();
  process.env.MCP_STORAGE_MODE = 'local';
  
  const config = Config.getInstance();
  console.log('Mode:', config.getMode());
  console.log('Is Local Mode:', config.isLocalMode());
  
  // Initialize storage
  await Storage.ensureDirectories();
  console.log('Data Directory:', Storage.getDataDirectory());
  
  // Create and save a test session
  const session = createMockSession();
  console.log('Session ID:', session.id);
  
  const result = await Storage.saveCaptureSession(session);
  console.log('Save Result:', result.success ? '✓ Success' : '✗ Failed');
  if (result.path) {
    console.log('Saved to:', result.path);
  }
  if (result.error) {
    console.error('Error:', result.error);
  }
  
  return result.success;
}

async function testCloudMode() {
  console.log('\n=== Testing Cloud Mode ===');
  
  // Reset and configure for cloud mode
  Config.reset();
  Storage.resetAdapter();
  process.env.MCP_STORAGE_MODE = 'cloud';
  process.env.MCP_CLOUD_PROVIDER = 'aws-s3';
  process.env.MCP_CLOUD_BUCKET = 'test-bucket';
  process.env.MCP_CLOUD_REGION = 'us-east-1';
  
  const config = Config.getInstance();
  console.log('Mode:', config.getMode());
  console.log('Is Cloud Mode:', config.isCloudMode());
  
  // Initialize storage
  try {
    await Storage.ensureDirectories();
    console.log('Data Directory:', Storage.getDataDirectory());
    
    // Create and save a test session
    const session = createMockSession();
    console.log('Session ID:', session.id);
    
    const result = await Storage.saveCaptureSession(session);
    console.log('Save Result:', result.success ? '✓ Success' : '✗ Failed');
    if (result.path) {
      console.log('Saved to:', result.path);
    }
    if (result.error) {
      console.error('Error:', result.error);
    }
    
    return result.success;
  } catch (error) {
    console.error('Error during cloud mode test:', error.message);
    return false;
  }
}

async function main() {
  console.log('MCP Network Analyzer - Storage Mode Test\n');
  
  const results = {
    local: false,
    cloud: false
  };
  
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
