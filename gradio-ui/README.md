# MCP Network Analyzer - Gradio UI

Beautiful web interface for the MCP Network Analyzer, featuring AI-powered code generation and API analysis.

## Features

- 📡 **Capture Tab**: Capture network traffic from any website via Blaxel MCP endpoint
- 🤖 **Generate Code Tab**: AI-powered export script generation using HuggingFace + Nebius
- 📊 **Review API Tab**: Intelligent API pattern analysis with AI
- 📈 **Visualize Tab**: Interactive data visualization with Plotly

## Quick Start

### Local Development

```bash
cd gradio-ui

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export BLAXEL_API_KEY="your_blaxel_key"
export HF_TOKEN="your_huggingface_token"

# Run the app
python app.py
```

Visit `http://localhost:7860` in your browser.

### Deploy to Modal

1. Install Modal CLI:
```bash
pip install modal
```

2. Set up Modal secrets:
```bash
# Add your Blaxel API key
modal secret create blaxel-api-key BLAXEL_API_KEY="your_key"

# Add your HuggingFace token
modal secret create huggingface-token HF_TOKEN="your_token"
```

3. Deploy:
```bash
modal deploy modal_app.py
```

4. Access your deployed app at the URL provided by Modal

## Configuration

### Environment Variables

- `BLAXEL_API_KEY` - Your Blaxel workspace API key (required)
- `HF_TOKEN` - Your HuggingFace token with Nebius access (required)

### AI Models

The UI supports multiple Nebius models via HuggingFace:
- `Qwen/Qwen2.5-Coder-32B-Instruct` (default for code generation)
- `meta-llama/Llama-3.3-70B-Instruct`
- `Qwen/QwQ-32B-Preview`

## Architecture

```
User Browser
    ↓
Gradio UI (Modal)
    ↓
    ├─→ Blaxel MCP Server (capture, analyze)
    │   └─→ https://run.blaxel.ai/kylebrodeur/functions/mcp-network-analyzer/mcp
    │
    └─→ HuggingFace Inference (Nebius)
        └─→ Code generation & API analysis
```

## Usage Flow

1. **Capture**: Enter a URL and capture network traffic
2. **Review**: Analyze patterns and understand the API structure
3. **Generate**: Create export scripts in TypeScript, Python, JavaScript, or Go
4. **Visualize**: Explore the data with interactive charts

## Technology Stack

- **UI Framework**: Gradio 5.0+
- **Deployment**: Modal (serverless)
- **MCP Server**: Blaxel (remote)
- **AI**: HuggingFace Inference with Nebius provider
- **Visualization**: Plotly
- **Language**: Python 3.11

## Troubleshooting

### "BLAXEL_API_KEY not configured"
Make sure you've set the environment variable or Modal secret correctly.

### "HF_TOKEN not configured"
You need a HuggingFace token with access to Nebius models. Configure it at: https://huggingface.co/settings/inference-providers

### Modal deployment fails
Ensure you've created the secrets:
```bash
modal secret list
```

Should show `blaxel-api-key` and `huggingface-token`.

## Links

- [Main Project](../)
- [Blaxel MCP Endpoint](https://run.blaxel.ai/kylebrodeur/functions/mcp-network-analyzer/mcp)
- [HuggingFace Nebius Setup](https://huggingface.co/settings/inference-providers)
- [Modal Documentation](https://modal.com/docs)
