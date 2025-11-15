# Next Steps: Adding Modal Integration

## What You Already Have ✅

Your MCP Network Analyzer is **production-ready** with:

1. **MCP Server on Blaxel**
   - Network capture with Playwright
   - All MCP tools functional
   - Dual-mode storage (local + cloud)
   - S3/GCS/Azure adapter support

2. **Storage Architecture**
   - `IStorageAdapter` interface
   - `LocalStorageAdapter` for file system
   - `CloudStorageAdapter` for S3/GCS/Azure
   - Configuration system with env vars

## What Modal Adds 🚀

Modal provides **heavy computational capabilities**:

1. **ML Pattern Analysis** (`modal_analysis.py`)
   - Scikit-learn clustering of API endpoints
   - REST pattern detection (list, detail, create, etc.)
   - Authentication method identification
   - Pagination strategy detection

2. **AI Code Generation** (`modal_analysis.py`)
   - Claude 3.5 Sonnet generates export scripts
   - Production-ready code with error handling
   - Support for TypeScript, Python, Go, etc.

3. **Gradio Web UI** (`modal_gradio_app.py`)
   - Beautiful visualization of captures
   - Interactive charts and graphs
   - Search functionality
   - Browse all your captures

## Quick Deploy (5 Minutes)

### Step 1: Set Up Modal

```bash
# Install Modal CLI
pip install modal

# Authenticate
modal setup

# Create secret for Claude
modal secret create anthropic-secret ANTHROPIC_API_KEY=sk-ant-...
```

### Step 2: Deploy Analysis Functions

```bash
# Test locally first
modal run modal_analysis.py --capture-file data/captures/session_XXX/requests.json

# Deploy to Modal
modal deploy modal_analysis.py
```

This creates endpoints like:
- `https://YOUR-WORKSPACE--api-archaeologist-analysis-analyze-patterns.modal.run`
- `https://YOUR-WORKSPACE--api-archaeologist-analysis-generate-export-code.modal.run`

### Step 3: Deploy Gradio UI

```bash
# Deploy the web interface
modal deploy modal_gradio_app.py
```

Access at: `https://YOUR-WORKSPACE--network-analyzer-ui.modal.run`

### Step 4: Connect MCP Server to Modal (Optional)

To have your MCP tools automatically call Modal for analysis:

Create `src/lib/modal-client.ts`:

```typescript
export async function analyzeWithModal(captureData: any): Promise<any> {
  const response = await fetch(
    'https://YOUR-WORKSPACE--api-archaeologist-analysis-analyze-patterns.modal.run',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(captureData)
    }
  );
  
  if (!response.ok) {
    throw new Error(`Modal analysis failed: ${response.statusText}`);
  }
  
  return response.json();
}

export async function generateCodeWithModal(
  analysis: any,
  language: string = 'typescript'
): Promise<string> {
  const response = await fetch(
    'https://YOUR-WORKSPACE--api-archaeologist-analysis-generate-export-code.modal.run',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis, target_language: language })
    }
  );
  
  if (!response.ok) {
    throw new Error(`Modal code generation failed: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.code || data;
}
```

Then update your analyze tool to optionally use Modal:

```typescript
// In src/tools/analyze.ts
import { analyzeWithModal } from '../lib/modal-client.js';
import { getStorage } from '../lib/storage.js';

export async function analyzeDeep(captureId: string, useModal: boolean = false) {
  const storage = getStorage();
  const captureData = await storage.loadCapture(captureId);
  
  if (useModal) {
    // Use Modal for heavy ML analysis
    const analysis = await analyzeWithModal(captureData);
    await storage.saveAnalysis(captureId, analysis);
    return analysis;
  } else {
    // Use your existing lightweight analysis
    // ...
  }
}
```

## Integration Benefits

### Why Add Modal?

1. **Scalability**: Modal auto-scales - handle 100 captures in parallel
2. **GPU Access**: Run ML models on GPUs without managing infrastructure
3. **AI Integration**: Claude API for intelligent code generation
4. **Web UI**: Beautiful Gradio interface with zero DevOps
5. **Cost Efficiency**: Serverless - only pay when analyzing

### Architecture

```
┌────────────────────────────────────────────┐
│  Your MCP Server (Blaxel)                 │
│  • Network capture                         │
│  • Protocol handling                       │
│  • Dual-mode storage                       │
└─────────┬──────────────────────────────────┘
          │
          │ Optional: Heavy analysis
          ▼
┌────────────────────────────────────────────┐
│  Modal Functions (Auto-scaling)           │
│  • ML pattern clustering                   │
│  • Claude code generation                  │
│  • Gradio web UI                           │
└────────────────────────────────────────────┘
```

Your MCP server remains **fast and lightweight**. Modal handles the heavy lifting only when needed.

## Demo Flow

Perfect for your hackathon demo:

1. **Capture** (via MCP on Blaxel) - 30s
   ```
   User → Claude: "Capture traffic from jsonplaceholder.typicode.com"
   ```

2. **Store** (your dual-mode storage) - instant
   ```
   Saved to S3 or local depending on config
   ```

3. **Analyze** (Modal with ML) - 45s
   ```
   ML clusters endpoints, identifies patterns
   ```

4. **Generate** (Modal with Claude) - 30s
   ```
   Claude writes complete export script
   ```

5. **Visualize** (Gradio UI on Modal) - 15s
   ```
   Beautiful charts, searchable data
   ```

**Total: ~2 minutes from unknown website to working export code**

## Testing

Test the Modal functions with your existing capture data:

```bash
# Find a capture
ls data/captures/

# Test analysis
modal run modal_analysis.py --capture-file data/captures/session_XXX/requests.json

# View generated code
cat generated_export.ts
```

## Cost Estimate

For hackathon demos:

- **Development**: Free (Modal $30/month credit)
- **50 demos**: ~$5 total
  - Each analysis: $0.05 (CPU time)
  - Each code gen: $0.10 (Claude API)
  - UI hosting: $0.02/hour

## Next Enhancements

After the hackathon, you could add:

1. **Real-time Streaming**: Stream capture data to Gradio UI live
2. **Multi-language Support**: Python, Go, Ruby export scripts
3. **API Documentation**: Generate OpenAPI specs automatically
4. **Diff Detection**: Compare API versions over time
5. **Monitoring**: Schedule periodic captures and alert on changes

## Questions?

See the full documentation:
- `docs/MODAL_INTEGRATION.md` - Technical details
- `docs/HACKATHON_DEPLOYMENT.md` - Complete deployment guide
- `HACKATHON_README.md` - Project overview
