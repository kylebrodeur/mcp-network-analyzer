# TypeScript Code Generation Template

## Language Requirements

- Use modern TypeScript with strict types
- Use built-in `fetch` API (Node.js 18+) - NO axios or other HTTP libraries
- Use ES modules (import/export)
- Include proper TypeScript interfaces for data structures

## Structure

```typescript
// Usage instructions as comments at top
// Include: how to run, required args, environment variables

import { writeFile } from 'fs/promises';
import { join } from 'path';

// Configuration constants
const BASE_URL = '...';
const RETRY_COUNT = 3;
const RETRY_DELAY = 1000; // ms

// TypeScript interfaces
interface EndpointConfig {
  path: string;
  method: string;
  headers: Record<string, string>;
}

// Helper functions
async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  // Implement retry logic
}

// Main export function
async function exportData(): Promise<void> {
  // Implementation
}

// Execute
exportData().catch(console.error);
```

## Required Features

- Command-line argument parsing for auth tokens, output path
- Retry logic with exponential backoff
- Progress logging to console
- Error handling for network failures
- File output with proper formatting (JSON/CSV/SQLite)
- Type-safe throughout
