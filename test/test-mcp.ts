#!/usr/bin/env tsx
/**
 * Simple MCP test script
 * Tests the network analyzer tools directly without needing Claude Desktop
 */

import { DatabaseService } from '../src/lib/database.js';
import { Storage } from '../src/lib/storage.js';
import { analyzeCapturedData } from '../src/tools/analyze.js';
import { captureNetworkRequests } from '../src/tools/capture.js';
import { discoverApiPatterns } from '../src/tools/discover.js';

async function test(): Promise<void> {
  console.log('🧪 Testing MCP Network Analyzer...\n');

  await Storage.ensureDirectories();
  await DatabaseService.getInstance().initialize();

  try {
    // Test 1: Capture
    console.log('1️⃣  Testing capture_network_requests...');
    const captureResult = await captureNetworkRequests({
      url: 'https://jsonplaceholder.typicode.com/users',
      waitForNetworkIdleMs: 2000,
      ignoreStaticAssets: true
    });

    if (!captureResult.success) {
      console.error('❌ Capture failed:', captureResult.error);
      process.exit(1);
    }

    console.log(`✅ Capture successful: ${captureResult.captureId}`);
    console.log(`   - Requests: ${captureResult.totalRequests}`);
    console.log(`   - Responses: ${captureResult.totalResponses}`);
    console.log(`   - API endpoints: ${captureResult.analysis.apiEndpoints.length}`);
    console.log(`   - Path: ${captureResult.sessionPath}\n`);

    // Test 2: Analyze
    console.log('2️⃣  Testing analyze_captured_data...');
    const analyzeResult = await analyzeCapturedData({
      captureId: captureResult.captureId
    });

    if (!analyzeResult.success) {
      console.error('❌ Analysis failed:', analyzeResult.error);
      process.exit(1);
    }

    console.log(`✅ Analysis successful: ${analyzeResult.analysisId}`);
    console.log(`   - Endpoint groups: ${analyzeResult.endpointGroups.length}`);
    console.log(`   - Auth method: ${analyzeResult.authentication.method}`);
    console.log(`   - Path: ${analyzeResult.analysisPath}\n`);

    // Test 3: Discover
    console.log('3️⃣  Testing discover_api_patterns...');
    const discoverResult = await discoverApiPatterns({
      analysisId: analyzeResult.analysisId,
      minConfidence: 0.5
    });

    if (!discoverResult.success) {
      console.error('❌ Discovery failed:', discoverResult.error);
      process.exit(1);
    }

    console.log(`✅ Discovery successful: ${discoverResult.discoveryId}`);
    console.log(`   - Patterns found: ${discoverResult.patterns.length}`);
    console.log(`   - Pagination: ${discoverResult.pagination.type}`);
    console.log(`   - Rate limiting: ${discoverResult.rateLimiting.detected ? 'Yes' : 'No'}`);
    console.log(`   - Path: ${discoverResult.discoveryPath}\n`);

    console.log('🎉 All tests passed!\n');
    console.log('📋 Test Summary:');
    console.log(`   Capture ID:   ${captureResult.captureId}`);
    console.log(`   Analysis ID:  ${analyzeResult.analysisId}`);
    console.log(`   Discovery ID: ${discoverResult.discoveryId}`);
    console.log('\n✨ MCP server is ready to use with Claude Desktop');

  } catch (error) {
    console.error('❌ Test failed with error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error) console.error(error.stack);
    process.exit(1);
  }
}

test();
