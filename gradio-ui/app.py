"""
MCP Network Analyzer - Gradio Web UI

A beautiful web interface for the MCP Network Analyzer, featuring:
- Network traffic capture via Blaxel MCP endpoint
- AI-powered code generation with HuggingFace + Nebius
- API pattern analysis with HuggingFace + Nebius
- Data visualization with Plotly

Deployment: Modal (serverless)
"""

import os
import json
import gradio as gr
import requests
from typing import Optional, Dict, Any, List
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime
from huggingface_hub import InferenceClient

# Configuration
BLAXEL_API_URL = "https://run.blaxel.ai/kylebrodeur/functions/mcp-network-analyzer/mcp"
BLAXEL_API_KEY = os.environ.get("BLAXEL_API_KEY", "")
HF_TOKEN = os.environ.get("HF_TOKEN", "")
NEBIUS_MODEL = "Qwen/Qwen2.5-Coder-32B-Instruct"  # Default model

# Initialize HuggingFace client
hf_client = InferenceClient(token=HF_TOKEN, provider="nebius") if HF_TOKEN else None


def call_blaxel_mcp(tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Call the Blaxel MCP endpoint with a tool request."""
    if not BLAXEL_API_KEY:
        return {"error": "BLAXEL_API_KEY not configured"}
    
    headers = {
        "Authorization": f"Bearer {BLAXEL_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments
        }
    }
    
    try:
        response = requests.post(BLAXEL_API_URL, headers=headers, json=payload, timeout=120)
        response.raise_for_status()
        result = response.json()
        
        if "error" in result:
            return {"error": result["error"]}
        
        return result.get("result", {})
    except requests.exceptions.RequestException as e:
        return {"error": f"Request failed: {str(e)}"}
    except Exception as e:
        return {"error": f"Unexpected error: {str(e)}"}


def generate_code_with_ai(analysis_data: str, language: str, model: str) -> str:
    """Generate export code using HuggingFace + Nebius."""
    if not hf_client:
        return "Error: HF_TOKEN not configured. Please set your HuggingFace token."
    
    prompt = f"""You are an expert code generator. Generate a production-ready export script based on this API analysis.

Language: {language}
Use native HTTP clients only (fetch for TypeScript/JavaScript, requests for Python, net/http for Go).

Analysis Data:
{analysis_data}

Requirements:
- Include authentication handling
- Add retry logic with exponential backoff
- Handle pagination if detected
- Add rate limiting
- Include comprehensive error handling
- Add usage examples in comments

Generate ONLY the code, no explanations."""

    try:
        messages = [{"role": "user", "content": prompt}]
        response = hf_client.chat_completion(
            messages=messages,
            model=model,
            max_tokens=2048,
            temperature=0.3
        )
        
        return response.choices[0].message.content
    except Exception as e:
        return f"Error generating code: {str(e)}"


def analyze_with_ai(capture_data: str, model: str) -> str:
    """Analyze captured data using HuggingFace + Nebius."""
    if not hf_client:
        return "Error: HF_TOKEN not configured. Please set your HuggingFace token."
    
    prompt = f"""You are an expert API analyst. Analyze this network capture data and provide insights.

Capture Data:
{capture_data}

Provide:
1. API Endpoints Summary
2. Authentication Methods Detected
3. REST Patterns (list, detail, CRUD operations)
4. Pagination Patterns
5. Rate Limiting (if detected)
6. Data Relationships
7. Recommendations for export tool generation

Be concise but comprehensive."""

    try:
        messages = [{"role": "user", "content": prompt}]
        response = hf_client.chat_completion(
            messages=messages,
            model=model,
            max_tokens=1024,
            temperature=0.2
        )
        
        return response.choices[0].message.content
    except Exception as e:
        return f"Error analyzing data: {str(e)}"


# Tab 1: Capture
def capture_network_traffic(
    url: str,
    session_id: Optional[str],
    wait_time: int,
    ignore_static: bool
) -> tuple[str, str]:
    """Capture network traffic from a URL."""
    if not url:
        return "Error: Please enter a URL", ""
    
    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"
    
    arguments = {
        "url": url,
        "waitForNetworkIdleMs": wait_time * 1000,
        "ignoreStaticAssets": ignore_static
    }
    
    if session_id:
        arguments["sessionId"] = session_id
    
    result = call_blaxel_mcp("capture_network_requests", arguments)
    
    if "error" in result:
        return f"Error: {result['error']}", ""
    
    # Extract content from MCP response
    content = result.get("content", [{}])[0].get("text", "")
    
    try:
        data = json.loads(content)
        capture_id = data.get("captureId", "")
        summary = f"""✅ **Capture Successful!**

**Capture ID:** `{capture_id}`

**Statistics:**
- Total Requests: {data.get('totalRequests', 0)}
- Total Responses: {data.get('totalResponses', 0)}
- Domains: {', '.join(data.get('domains', []))}

**Next Steps:**
1. Use the "Review API" tab to analyze patterns
2. Generate export code in the "Generate Code" tab
"""
        return summary, capture_id
    except json.JSONDecodeError:
        return content, ""


# Tab 2: Generate Code
def generate_export_code(
    capture_id: str,
    language: str,
    model: str,
    incremental: bool
) -> str:
    """Generate export code using AI."""
    if not capture_id:
        return "Error: Please provide a capture ID"
    
    # First, get the analysis data from MCP
    analysis_result = call_blaxel_mcp("analyze_captured_data", {"captureId": capture_id})
    
    if "error" in analysis_result:
        return f"Error analyzing capture: {analysis_result['error']}"
    
    analysis_content = analysis_result.get("content", [{}])[0].get("text", "")
    
    # Generate code using AI
    code = generate_code_with_ai(analysis_content, language, model)
    
    return f"""```{language.lower()}
{code}
```

**Generated using:** {model}
**Capture ID:** {capture_id}
**Mode:** {"Incremental" if incremental else "Full export"}
"""


# Tab 3: Review API
def review_api_patterns(capture_id: str, model: str) -> tuple[str, Any]:
    """Analyze and review API patterns."""
    if not capture_id:
        return "Error: Please provide a capture ID", None
    
    # Get captured data
    analysis_result = call_blaxel_mcp("analyze_captured_data", {"captureId": capture_id})
    
    if "error" in analysis_result:
        return f"Error: {analysis_result['error']}", None
    
    analysis_content = analysis_result.get("content", [{}])[0].get("text", "")
    
    # Get AI analysis
    ai_analysis = analyze_with_ai(analysis_content, model)
    
    # Try to parse for visualization
    try:
        data = json.loads(analysis_content)
        
        # Create endpoint frequency chart
        endpoints = {}
        for group in data.get("summary", {}).get("requestGroups", []):
            domain = group.get("domain", "unknown")
            count = group.get("count", 0)
            endpoints[domain] = endpoints.get(domain, 0) + count
        
        fig = go.Figure(data=[
            go.Bar(x=list(endpoints.keys()), y=list(endpoints.values()))
        ])
        fig.update_layout(
            title="Requests by Domain",
            xaxis_title="Domain",
            yaxis_title="Request Count",
            template="plotly_white"
        )
        
        return ai_analysis, fig
    except:
        return ai_analysis, None


# Tab 4: Visualize
def visualize_capture_data(capture_id: str) -> tuple[Any, Any, str]:
    """Create visualizations for captured data."""
    if not capture_id:
        return None, None, "Error: Please provide a capture ID"
    
    # Get the raw capture data
    # Note: This would need a new MCP tool to fetch raw data, or we parse from analysis
    # For now, we'll create sample visualizations based on analysis
    
    analysis_result = call_blaxel_mcp("analyze_captured_data", {"captureId": capture_id})
    
    if "error" in analysis_result:
        return None, None, f"Error: {analysis_result['error']}"
    
    try:
        content = analysis_result.get("content", [{}])[0].get("text", "")
        data = json.loads(content)
        summary = data.get("summary", {})
        
        # Status code distribution
        status_dist = summary.get("statusCodeDistribution", {})
        fig1 = go.Figure(data=[
            go.Pie(labels=list(status_dist.keys()), values=list(status_dist.values()))
        ])
        fig1.update_layout(title="Status Code Distribution")
        
        # Content types
        content_types = summary.get("contentTypes", {})
        fig2 = go.Figure(data=[
            go.Bar(x=list(content_types.keys()), y=list(content_types.values()))
        ])
        fig2.update_layout(
            title="Content Types",
            xaxis_title="Content Type",
            yaxis_title="Count"
        )
        
        stats = f"""**Capture Statistics:**
- API Endpoints: {summary.get('apiEndpoints', 0)}
- Static Assets: {summary.get('staticAssets', 0)}
- Total Domains: {summary.get('totalDomains', 0)}
- Authentication: {summary.get('hasAuthentication', 'Unknown')}
"""
        
        return fig1, fig2, stats
    except Exception as e:
        return None, None, f"Error visualizing data: {str(e)}"


# Build the Gradio interface
with gr.Blocks(title="MCP Network Analyzer", theme=gr.themes.Soft()) as demo:
    gr.Markdown("""
    # 🔍 MCP Network Analyzer
    
    Capture, analyze, and generate export tools for any website's API using AI.
    
    **Powered by:** Blaxel MCP Server + HuggingFace Inference (Nebius)
    """)
    
    with gr.Tabs():
        # Tab 1: Capture
        with gr.Tab("📡 Capture"):
            gr.Markdown("### Capture Network Traffic")
            
            with gr.Row():
                with gr.Column():
                    url_input = gr.Textbox(
                        label="Website URL",
                        placeholder="https://api.example.com or example.com",
                        lines=1
                    )
                    session_input = gr.Textbox(
                        label="Session ID (optional)",
                        placeholder="my-capture-session",
                        lines=1
                    )
                    wait_time = gr.Slider(
                        minimum=1,
                        maximum=30,
                        value=5,
                        step=1,
                        label="Wait Time (seconds)"
                    )
                    ignore_static = gr.Checkbox(
                        label="Ignore Static Assets (images, CSS, etc.)",
                        value=True
                    )
                    capture_btn = gr.Button("🚀 Start Capture", variant="primary")
                
                with gr.Column():
                    capture_output = gr.Markdown(label="Results")
                    capture_id_output = gr.Textbox(label="Capture ID (use in other tabs)", visible=True)
            
            capture_btn.click(
                fn=capture_network_traffic,
                inputs=[url_input, session_input, wait_time, ignore_static],
                outputs=[capture_output, capture_id_output]
            )
        
        # Tab 2: Generate Code
        with gr.Tab("🤖 Generate Code"):
            gr.Markdown("### AI-Powered Export Code Generation")
            
            with gr.Row():
                with gr.Column():
                    gen_capture_id = gr.Textbox(label="Capture ID", placeholder="Enter capture ID from Capture tab")
                    gen_language = gr.Dropdown(
                        choices=["TypeScript", "Python", "JavaScript", "Go"],
                        value="TypeScript",
                        label="Target Language"
                    )
                    gen_model = gr.Dropdown(
                        choices=[
                            "Qwen/Qwen2.5-Coder-32B-Instruct",
                            "meta-llama/Llama-3.3-70B-Instruct",
                            "Qwen/QwQ-32B-Preview"
                        ],
                        value="Qwen/Qwen2.5-Coder-32B-Instruct",
                        label="AI Model"
                    )
                    gen_incremental = gr.Checkbox(label="Incremental Export Support", value=False)
                    gen_btn = gr.Button("✨ Generate Code", variant="primary")
                
                with gr.Column():
                    gen_output = gr.Markdown(label="Generated Code")
            
            gen_btn.click(
                fn=generate_export_code,
                inputs=[gen_capture_id, gen_language, gen_model, gen_incremental],
                outputs=gen_output
            )
        
        # Tab 3: Review API
        with gr.Tab("📊 Review API"):
            gr.Markdown("### AI-Powered API Analysis")
            
            with gr.Row():
                with gr.Column(scale=1):
                    review_capture_id = gr.Textbox(label="Capture ID")
                    review_model = gr.Dropdown(
                        choices=[
                            "Qwen/Qwen2.5-Coder-32B-Instruct",
                            "meta-llama/Llama-3.3-70B-Instruct",
                            "Qwen/QwQ-32B-Preview"
                        ],
                        value="Qwen/Qwen2.5-Coder-32B-Instruct",
                        label="AI Model"
                    )
                    review_btn = gr.Button("🔍 Analyze", variant="primary")
                
                with gr.Column(scale=2):
                    review_output = gr.Markdown(label="Analysis Results")
                    review_chart = gr.Plot(label="Request Distribution")
            
            review_btn.click(
                fn=review_api_patterns,
                inputs=[review_capture_id, review_model],
                outputs=[review_output, review_chart]
            )
        
        # Tab 4: Visualize
        with gr.Tab("📈 Visualize"):
            gr.Markdown("### Data Visualization")
            
            with gr.Row():
                with gr.Column(scale=1):
                    viz_capture_id = gr.Textbox(label="Capture ID")
                    viz_btn = gr.Button("📊 Generate Charts", variant="primary")
                
                with gr.Column(scale=2):
                    viz_stats = gr.Markdown(label="Statistics")
            
            with gr.Row():
                viz_chart1 = gr.Plot(label="Status Codes")
                viz_chart2 = gr.Plot(label="Content Types")
            
            viz_btn.click(
                fn=visualize_capture_data,
                inputs=[viz_capture_id],
                outputs=[viz_chart1, viz_chart2, viz_stats]
            )
    
    gr.Markdown("""
    ---
    **Note:** Requires `BLAXEL_API_KEY` and `HF_TOKEN` environment variables.
    
    [GitHub](https://github.com/kylebrodeur/mcp-network-analyzer) | 
    [Blaxel MCP](https://run.blaxel.ai/kylebrodeur/functions/mcp-network-analyzer/mcp)
    """)

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860, share=False)
