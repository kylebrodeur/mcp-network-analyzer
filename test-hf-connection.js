#!/usr/bin/env node
/**
 * Test HuggingFace + Nebius connection
 */
import { HfInference } from '@huggingface/inference';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Load environment variables from .env file
async function loadEnv() {
  try {
    const envContent = await readFile(join(process.cwd(), '.env'), 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      if (line.includes('=')) {
        const [key, value] = line.split('=');
        process.env[key.trim()] = value.trim();
      }
    }
  } catch (error) {
    console.log('No .env file found or error reading it');
  }
}

async function testHuggingFaceConnection() {
  await loadEnv();
  
  console.log('🧪 Testing HuggingFace + Nebius connection...\n');
  
  const hfToken = process.env.HF_TOKEN;
  
  if (!hfToken) {
    console.error('❌ No HF_TOKEN found in environment');
    process.exit(1);
  }
  
  console.log(`✅ HF_TOKEN found: ${hfToken.substring(0, 8)}...`);
  
  const client = new HfInference(hfToken);
  
  try {
    console.log('🔄 Testing basic text generation...');
    
    const response = await client.chatCompletion({
      model: 'meta-llama/Llama-3.1-8B-Instruct',
      provider: 'nebius',
      messages: [
        {
          role: 'user',
          content: 'Say "Hello, world!" in TypeScript code.'
        }
      ],
      max_tokens: 100,
    });
    
    console.log('✅ Success! Response:');
    console.log(response.choices[0]?.message?.content);
    
  } catch (error) {
    console.error('❌ Error:', error);
    
    // Try without provider
    try {
      console.log('\n🔄 Trying without explicit provider...');
      
      const response2 = await client.chatCompletion({
        model: 'microsoft/DialoGPT-medium',
        messages: [
          {
            role: 'user', 
            content: 'Hello'
          }
        ],
        max_tokens: 50,
      });
      
      console.log('✅ Alternative approach worked!');
      console.log(response2.choices[0]?.message?.content);
      
    } catch (error2) {
      console.error('❌ Alternative also failed:', error2);
    }
  }
}

testHuggingFaceConnection();