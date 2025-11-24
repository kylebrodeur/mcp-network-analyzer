#!/usr/bin/env node
/**
 * Simple test to verify discovery path resolution is fixed
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { Storage } from './dist/lib/storage.js';

async function testDiscoveryPath() {
  console.log('🧪 Testing discovery path resolution...\n');
  
  try {
    const discoveryId = 'discovery_1763346972243_az00w2jd';
    
    // Test the exact path resolution that generate tool uses
    const dataDir = Storage.getDataDirectory();
    const discoveryFile = join(dataDir, "analyses", discoveryId, "discovery.json");
    
    console.log(`📁 Data directory: ${dataDir}`);
    console.log(`📄 Discovery file path: ${discoveryFile}`);
    
    // Try to read the file
    const discoveryData = await readFile(discoveryFile, "utf-8");
    const discovery = JSON.parse(discoveryData);
    
    console.log(`✅ Successfully read discovery file!`);
    console.log(`   - Discovery ID: ${discovery.discoveryId}`);
    console.log(`   - Patterns found: ${discovery.patterns?.length || 0}`);
    console.log(`   - Analysis ID: ${discovery.analysisId}`);
    console.log(`   - Capture ID: ${discovery.captureId}`);
    
    console.log('\n🎉 Path resolution test passed! The generate tool should now work correctly.\n');
    
  } catch (error) {
    console.error('❌ Path resolution test failed:', error.message);
    process.exit(1);
  }
}

testDiscoveryPath();