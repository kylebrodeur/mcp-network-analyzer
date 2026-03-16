# API Archaeologist 🏺

**Unearth the hidden APIs of any website** - A hackathon project combining MCP, Blaxel, and Modal.

## What It Does

1. **Captures** network traffic from any website
2. **Analyzes** API patterns with machine learning
3. **Generates** production-ready export code with Claude
4. **Visualizes** everything in a beautiful Gradio interface

## The Stack

- **Blaxel** - Hosts the MCP server (lightweight protocol handling)
- **Modal** - Heavy computation (ML analysis, LLM code generation, web UI)
- **MCP** - Connect to AI agents (Claude Desktop, Cursor, etc.)

## Quick Start

### ✅ Already Done

- MCP Server deployed on Blaxel (not deployed or setup)
- Network capture working ✅
- Dual-mode storage (local + cloud S3/GCS/Azure) ✅
- Storage adapter architecture ✅

### Next Steps: Add Modal for Heavy Computation

### 1. Deploy Analysis Functions to Modal

```bash
# Create Anthropic secret
modal secret create anthropic-secret ANTHROPIC_API_KEY=<your-key>

# Deploy functions
modal deploy modal_analysis.py
```

### 2. Deploy Gradio UI to Modal

```bash
# Create data volume
modal volume create network-analyzer-data

# Deploy UI
modal deploy modal_gradio_app.py
```

### 3. Test the Full Pipeline

Your MCP server is already connected to Claude via Blaxel. Now test:

```
User: "Capture network traffic from jsonplaceholder.typicode.com"
Claude: [Uses capture_network_requests tool]

User: "Analyze the captured data"
Claude: [Deep ML analysis via Modal]

User: "Generate a TypeScript export script"
Claude: [Claude generates production code via Modal]
```

## Demo Flow

**"From Unknown Website to Working Export Script in 2 Minutes"**

1. **Capture** (30s) - Intercept all API calls
2. **Analyze** (45s) - ML pattern detection + auth discovery
3. **Generate** (30s) - Claude writes complete export script
4. **Visualize** (15s) - Beautiful charts in Gradio UI

## Project Structure

```
mcp-network-analyzer/
├── src/                        # MCP server (TypeScript)
│   ├── index.ts               # Entry point
│   ├── tools/
│   │   └── capture.ts         # Network capture tool
│   └── lib/
│       ├── browser.ts         # Playwright wrapper
│       ├── interceptor.ts     # Network interception
│       └── storage.ts         # Data persistence
│
├── modal_analysis.py          # Modal: ML analysis + code gen
├── modal_gradio_app.py        # Modal: Web UI
│
├── data/
│   ├── captures/              # Captured network traffic
│   ├── analyses/              # Analysis results
│   └── generated/             # Generated export scripts
│
└── docs/
    ├── PLAN.md                # Original roadmap
    ├── MODAL_INTEGRATION.md   # Modal integration guide
    └── HACKATHON_DEPLOYMENT.md # Complete deployment guide
```

## Features

### Current (Phase 2 Complete + Storage Enhanced)

✅ Network traffic capture with Playwright  
✅ Browser stealth mode (anti-bot detection)  
✅ Request/response persistence  
✅ Session management  
✅ Resource filtering  
✅ **Dual-mode storage (local + cloud S3/GCS/Azure)**  
✅ **Cloud storage adapter architecture**  
✅ **Configuration system with environment variables**  

### In Progress (Phase 3 - Modal Integration)

🚧 ML-based pattern clustering  
🚧 REST endpoint classification  
🚧 Authentication detection  
🚧 Claude-powered code generation  

### Planned

⏳ Gradio web dashboard  
⏳ Data search and querying  
⏳ Multi-language code generation  
⏳ API documentation generation  

## Why This Architecture?

**Blaxel for MCP Server:**

- Native MCP support
- Serverless (only pay when AI agents use it)
- Global endpoint for any MCP client
- Perfect for protocol orchestration

**Modal for Computation:**

- Powerful GPUs/CPUs on-demand
- Great for ML and LLM inference
- Easy web app deployment (Gradio)
- Excellent Python ecosystem

**Best of Both Worlds:**

- MCP server stays lightweight and fast
- Heavy computation scales independently
- Each platform does what it's best at

## Cost Estimate

**Development:** Free (both platforms have generous free tiers)

**Demo Day:** ~$8 for 50 demos

- Blaxel: ~$0.01 per capture
- Modal analysis: ~$0.05 per analysis
- Claude code gen: ~$0.10 per generation
- Gradio UI: ~$0.02/hour

## Hackathon Highlights

🎯 **Novel combination** - MCP + Blaxel + Modal (probably first ever)  
🤖 **AI-powered** - Claude generates actual working code  
🔬 **ML analysis** - Scikit-learn clusters API patterns  
🎨 **Beautiful UI** - Gradio dashboard with charts  
🚀 **Production-ready** - Can actually use this tool  

## Next Steps After Hackathon

1. Add GraphQL and WebSocket support
2. Generate API documentation (OpenAPI specs)
3. Multi-language code generation (Python, Go, Ruby)
4. Real-time capture streaming in UI
5. API change detection and alerts

## Resources

- [Blaxel Documentation](https://docs.blaxel.ai)
- [Modal Documentation](https://modal.com/docs)
- [MCP Specification](https://modelcontextprotocol.io)

## License

MIT

---

Built with ❤️ for the hackathon by [@kylebrodeur](https://github.com/kylebrodeur)
