# API Archaeologist - Hackathon Deployment Guide

**Goal:** Build a complete "API Archaeologist" system that captures, analyzes, and generates export code for any website's API.

## Architecture Overview

```
┌───────────────────────────────────────────────────────────┐
│  BLAXEL: MCP Network Analyzer Server                     │
│  • capture_network_requests (Playwright)                 │
│  • Lightweight orchestration                             │
│  • Protocol handling                                     │
└────────┬──────────────────────────────┬──────────────────┘
         │                              │
         │ Heavy Compute                │ Data Storage
         ▼                              ▼
┌──────────────────────┐      ┌──────────────────────┐
│  MODAL: Analysis     │      │  MODAL: Gradio UI    │
│  • Pattern detection │      │  • Browse captures   │
│  • LLM code gen      │      │  • Visualize APIs    │
│  • Validation        │      │  • Search data       │
└──────────────────────┘      └──────────────────────┘
```

## Deployment Steps

### ✅ Prerequisites

**Already Completed:**
- MCP Server deployed on Blaxel
- Network capture tool working
- Data being saved to `data/captures/`

### Step 1: Deploy Analysis Functions to Modal

**File: `modal_analysis.py`**

```python
"""
Heavy computational analysis for the API Archaeologist
Deployed on Modal for scalability and GPU access
"""
import json
from typing import Dict, List
import modal

app = modal.App("api-archaeologist-analysis")

# Define image with analysis dependencies
analysis_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "pandas==2.2.0",
        "scikit-learn==1.5.2",
        "anthropic==0.42.0",
        "jinja2==3.1.5",
    )
)

@app.function(
    image=analysis_image,
    timeout=600,  # 10 minutes
    memory=4096,  # 4GB
)
def analyze_patterns(capture_data: dict) -> dict:
    """
    Deep analysis of captured network traffic.
    
    - Clusters similar endpoints
    - Identifies REST patterns (list, detail, create, etc.)
    - Detects pagination strategies
    - Infers authentication methods
    """
    import pandas as pd
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.cluster import DBSCAN
    
    requests = capture_data.get("requests", [])
    
    if not requests:
        return {"error": "No requests to analyze"}
    
    # Convert to DataFrame
    df = pd.DataFrame(requests)
    
    # Extract URL paths for clustering
    df['path'] = df['url'].apply(lambda u: u.split('?')[0].split('#')[0])
    
    # Cluster similar endpoints
    vectorizer = TfidfVectorizer(tokenizer=lambda x: x.split('/'))
    path_vectors = vectorizer.fit_transform(df['path'])
    
    clustering = DBSCAN(eps=0.3, min_samples=2, metric='cosine')
    df['cluster'] = clustering.fit_predict(path_vectors.toarray())
    
    # Identify patterns
    patterns = []
    
    for cluster_id in df['cluster'].unique():
        if cluster_id == -1:
            continue
        
        cluster_urls = df[df['cluster'] == cluster_id]['path'].tolist()
        methods = df[df['cluster'] == cluster_id]['method'].unique().tolist()
        
        # Detect pattern type
        pattern_type = detect_pattern_type(cluster_urls, methods)
        
        patterns.append({
            "cluster_id": int(cluster_id),
            "type": pattern_type,
            "urls": cluster_urls[:5],  # Sample
            "methods": methods,
            "count": len(cluster_urls)
        })
    
    # Authentication analysis
    auth_headers = detect_auth_headers(requests)
    
    return {
        "patterns": patterns,
        "auth_headers": auth_headers,
        "total_requests": len(requests),
        "unique_endpoints": df['path'].nunique()
    }

def detect_pattern_type(urls: List[str], methods: List[str]) -> str:
    """Heuristic pattern detection."""
    # Check for ID patterns (e.g., /api/users/123)
    has_id_pattern = any(':id' in url or any(c.isdigit() for c in url) for url in urls)
    
    if 'GET' in methods and has_id_pattern:
        return 'detail'
    elif 'GET' in methods and not has_id_pattern:
        return 'list'
    elif 'POST' in methods:
        return 'create'
    elif 'PUT' in methods or 'PATCH' in methods:
        return 'update'
    elif 'DELETE' in methods:
        return 'delete'
    
    return 'unknown'

def detect_auth_headers(requests: List[dict]) -> dict:
    """Identify authentication mechanisms."""
    auth_methods = {
        "bearer": False,
        "api_key": False,
        "cookie": False,
        "headers": []
    }
    
    for req in requests:
        headers = req.get("headers", {})
        
        if "Authorization" in headers:
            if "Bearer" in headers["Authorization"]:
                auth_methods["bearer"] = True
        
        if "X-API-Key" in headers or "API-Key" in headers:
            auth_methods["api_key"] = True
        
        if "Cookie" in headers:
            auth_methods["cookie"] = True
        
        # Collect custom headers
        for header in headers:
            if header.startswith("X-") and header not in auth_methods["headers"]:
                auth_methods["headers"].append(header)
    
    return auth_methods


@app.function(
    image=analysis_image,
    secrets=[modal.Secret.from_name("anthropic-secret")],
    timeout=300,
)
def generate_export_code(analysis: dict, target_language: str = "typescript") -> str:
    """
    Use Claude to generate production-ready export code.
    
    Takes the API analysis and generates a complete, runnable script
    that handles authentication, pagination, rate limiting, etc.
    """
    import anthropic
    
    client = anthropic.Anthropic()
    
    prompt = f"""You are an expert at reverse engineering APIs and writing robust data export scripts.

Based on this API analysis:

```json
{json.dumps(analysis, indent=2)}
```

Generate a complete, production-ready {target_language} script that:

1. **Authenticates** using the detected method
2. **Discovers all endpoints** based on the patterns
3. **Handles pagination** intelligently
4. **Respects rate limits** with exponential backoff
5. **Saves data** to JSON files
6. **Is resumable** - tracks progress and can restart

Include:
- Clear comments
- Error handling
- Progress logging
- Type definitions (if TypeScript)

Return ONLY the code, no markdown formatting."""

    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=8000,
        messages=[{"role": "user", "content": prompt}]
    )
    
    return response.content[0].text


# CLI for testing
@app.local_entrypoint()
def main(capture_file: str = "data/captures/latest/requests.json"):
    """Test the analysis functions locally."""
    with open(capture_file) as f:
        capture_data = {"requests": json.load(f)}
    
    print("Running analysis...")
    analysis = analyze_patterns.remote(capture_data)
    print(json.dumps(analysis, indent=2))
    
    print("\nGenerating export code...")
    code = generate_export_code.remote(analysis)
    print(code)
```

**Deploy:**

```bash
modal deploy modal_analysis.py
```

### Step 2: Deploy Gradio UI to Modal

The Gradio UI integrates with your existing storage system:

```bash
modal deploy modal_gradio_app.py
```

Access at: `https://WORKSPACE--network-analyzer-ui.modal.run`

**Note:** The UI will read from your configured storage (local or cloud via your adapters).

### Step 3: Connect Everything

**In your MCP server, call Modal functions:**

Create `src/lib/modal-client.ts`:

```typescript
export async function callModalAnalysis(captureData: any) {
  const response = await fetch(
    'https://YOUR_WORKSPACE--api-archaeologist-analysis-analyze-patterns.modal.run',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(captureData)
    }
  );
  
  return response.json();
}

export async function callModalCodeGen(analysis: any, language: string = 'typescript') {
  const response = await fetch(
    'https://YOUR_WORKSPACE--api-archaeologist-analysis-generate-export-code.modal.run',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis, target_language: language })
    }
  );
  
  return response.json();
}
```

**Update your MCP tools to use Modal:**

```typescript
// In src/tools/analyze.ts
import { callModalAnalysis } from '../lib/modal-client.js';

export async function analyzeCapturedData(captureId: string) {
  // Load capture
  const captureData = await loadCapture(captureId);
  
  // Send to Modal for heavy analysis
  const analysis = await callModalAnalysis(captureData);
  
  // Save results
  await saveAnalysis(captureId, analysis);
  
  return analysis;
}
```

## Demo Flow for Hackathon

**"From Unknown Website to Working Export Script in 2 Minutes"**

1. **Capture** (30s):
   ```
   User: "Capture network traffic from jsonplaceholder.typicode.com"
   MCP Tool: capture_network_requests
   Result: 50 requests captured
   ```

2. **Analyze** (45s):
   ```
   User: "Analyze the captured data"
   MCP Tool → Modal: Deep pattern analysis
   Result: Identified 5 REST endpoints (posts, comments, etc.)
   ```

3. **Generate** (30s):
   ```
   User: "Generate a TypeScript export script"
   MCP Tool → Modal → Claude: Code generation
   Result: Complete 200-line script with all features
   ```

4. **Visualize** (15s):
   ```
   Open Gradio UI
   Browse capture
   See interactive charts
   Download generated code
   ```

## Costs Estimate

**Development/Testing:**
- Blaxel: Free tier (plenty for hackathon)
- Modal: $30 free credits/month (more than enough)

**Demo:**
- Each capture: ~$0.01 (Blaxel compute)
- Each analysis: ~$0.05 (Modal CPU)
- Each code gen: ~$0.10 (Claude API)
- UI hosting: ~$0.02/hour

**Total for 50 demos: ~$8**

## Troubleshooting

### Modal Connection Issues
- Confirm Modal Functions are deployed
- Check secrets are set (Anthropic API key)
- Test functions with `modal run`

### Data Sync Issues
- Ensure volumes are mounted correctly
- Check file permissions
- Use Modal Volume browser: `modal volume ls network-analyzer-data`

## Next Steps After Hackathon

1. **Add more analysis features:**
   - GraphQL detection
   - WebSocket capture
   - Rate limit detection

2. **Enhance code generation:**
   - Support more languages (Python, Go, Ruby)
   - Add test generation
   - Include API documentation

3. **Improve UI:**
   - Real-time capture streaming
   - Diff view for API changes
   - Export to Postman/Insomnia

4. **Make it a product:**
   - User authentication
   - Team collaboration
   - Scheduled captures
   - API monitoring

## Resources

- **Blaxel Docs:** https://docs.blaxel.ai
- **Modal Docs:** https://modal.com/docs
- **MCP Spec:** https://modelcontextprotocol.io
- **Your repo:** https://github.com/kylebrodeur/mcp-network-analyzer
