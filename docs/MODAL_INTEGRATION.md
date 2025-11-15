# Modal Integration for Heavy Computation

## Architecture Overview

Your MCP server (hosted on Blaxel) handles orchestration and protocol.
Your dual-mode storage handles data persistence (local or cloud).
Modal adds compute-intensive analysis and web UI capabilities.

**Important:** This builds on top of your existing dual-mode storage. Modal functions can read from your cloud storage adapters.

## Use Cases for Modal Functions

### 1. Deep Pattern Analysis
```python
import modal

app = modal.App("network-analyzer-analysis")

@app.function(
    image=modal.Image.debian_slim().pip_install("pandas", "scikit-learn"),
    timeout=600  # 10 minutes for deep analysis
)
def analyze_api_patterns(capture_data: dict) -> dict:
    """
    Perform ML-based clustering and pattern recognition on captured requests.
    
    - Groups similar endpoints
    - Identifies REST patterns
    - Detects pagination strategies
    - Infers data models
    """
    import pandas as pd
    from sklearn.cluster import DBSCAN
    
    # Your analysis logic here
    # Return structured patterns
    pass
```

### 2. LLM-Powered Code Generation
```python
@app.function(
    secrets=[modal.Secret.from_name("anthropic-secret")],
    timeout=300
)
def generate_export_code(analysis_result: dict, language: str = "typescript") -> str:
    """
    Use Claude to generate high-quality export scripts from API analysis.
    
    - Prompts Claude with API patterns
    - Generates complete, runnable code
    - Includes error handling, pagination, auth
    """
    import anthropic
    
    client = anthropic.Anthropic()
    
    prompt = f"""
    Based on this API analysis:
    {analysis_result}
    
    Generate a complete {language} script to export all data...
    """
    
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}]
    )
    
    return response.content[0].text
```

### 3. Parallel Validation
```python
@app.function(gpu="T4")  # If needed for ML validation
def validate_generated_code(code: str, test_cases: list) -> dict:
    """
    Run generated code in Modal Sandbox for validation.
    
    - Syntax checking
    - Test execution
    - Security scanning
    """
    pass
```

## Integration Pattern

Your MCP tool calls Modal functions using your existing storage system:

```typescript
// In src/tools/analyze.ts
import { callModalFunction } from '../lib/modal-client.js';
import { StorageAdapter } from '../lib/storage-adapter.js';
import { getConfig } from '../lib/config.js';

export async function analyzeDeep(captureId: string) {
    // Use your existing storage adapter
    const config = getConfig();
    const storage = StorageAdapter.create(config.storageMode);
    const captureData = await storage.loadCapture(captureId);
    
    // Call Modal for heavy lifting
    const analysis = await callModalFunction(
        'network-analyzer-analysis',
        'analyze_api_patterns',
        { capture_data: captureData }
    );
    
    // Save analysis results using your storage system
    await storage.saveAnalysis(captureId, analysis);
    
    return analysis;
}
```

## Benefits

- **MCP Server**: Stays fast and lightweight
- **Modal**: Handles computation without affecting MCP responsiveness
- **Cost**: Only pay for compute when analyzing (Modal's serverless model)
- **Scalability**: Analyze multiple captures in parallel on Modal
