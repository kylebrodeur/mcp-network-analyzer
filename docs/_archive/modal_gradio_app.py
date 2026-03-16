"""
Gradio Web Interface for MCP Network Analyzer
Deployed on Modal for global access and auto-scaling
"""
import json
from pathlib import Path
from typing import Optional

import modal

# Define the image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "gradio~=5.7.1",
        "pandas~=2.2.0",
        "plotly~=5.24.0",
    )
)

app = modal.App("network-analyzer-ui", image=image)

# Volume to access captured data
data_volume = modal.Volume.from_name("network-analyzer-data", create_if_missing=True)
DATA_PATH = "/data"

# Optional: Secret for accessing your Blaxel MCP server
# blaxel_secret = modal.Secret.from_name("blaxel-api-key")


@app.function(
    image=image,
    volumes={DATA_PATH: data_volume},
    # secrets=[blaxel_secret],  # Uncomment if calling Blaxel MCP
    max_containers=1,  # Gradio needs sticky sessions
    timeout=3600,  # 1 hour
)
@modal.concurrent(max_inputs=100)  # Handle many users
@modal.asgi_app()
def ui():
    """
    Gradio interface for viewing and interacting with captured network data.
    """
    import gradio as gr
    import pandas as pd
    import plotly.express as px
    from fastapi import FastAPI
    from gradio.routes import mount_gradio_app

    # Helper functions
    def list_captures():
        """List all available capture sessions."""
        captures_dir = Path(DATA_PATH) / "captures"
        if not captures_dir.exists():
            return []
        
        sessions = []
        for session_dir in captures_dir.iterdir():
            if session_dir.is_dir():
                metadata_file = session_dir / "metadata.json"
                if metadata_file.exists():
                    with open(metadata_file) as f:
                        metadata = json.load(f)
                    sessions.append({
                        "id": session_dir.name,
                        "url": metadata.get("url", "Unknown"),
                        "timestamp": metadata.get("timestamp", "Unknown"),
                        "total_requests": metadata.get("totalRequests", 0)
                    })
        
        return sorted(sessions, key=lambda x: x["timestamp"], reverse=True)

    def load_capture_data(capture_id: str):
        """Load capture data for analysis."""
        if not capture_id:
            return None, "Please select a capture session"
        
        session_dir = Path(DATA_PATH) / "captures" / capture_id
        
        if not session_dir.exists():
            return None, f"Capture {capture_id} not found"
        
        # Load requests
        requests_file = session_dir / "requests.json"
        responses_file = session_dir / "responses.json"
        
        try:
            with open(requests_file) as f:
                requests = json.load(f)
            
            with open(responses_file) as f:
                responses = json.load(f)
            
            return {
                "requests": requests,
                "responses": responses
            }, None
        except Exception as e:
            return None, f"Error loading data: {str(e)}"

    def analyze_capture(capture_id: str):
        """Analyze a capture and return insights."""
        data, error = load_capture_data(capture_id)
        
        if error:
            return error, None, None
        
        requests = data["requests"]
        responses = data["responses"]
        
        # Create DataFrame for analysis
        df = pd.DataFrame([
            {
                "method": r["method"],
                "url": r["url"],
                "domain": r["url"].split("/")[2] if len(r["url"].split("/")) > 2 else "unknown",
                "resourceType": r.get("resourceType", "unknown")
            }
            for r in requests
        ])
        
        # Summary stats
        summary = f"""
        ## 📊 Capture Analysis
        
        **Total Requests:** {len(requests)}  
        **Total Responses:** {len(responses)}  
        **Unique Domains:** {df['domain'].nunique()}  
        **Request Methods:** {', '.join(df['method'].unique())}  
        
        ### Top Domains
        {df['domain'].value_counts().head(5).to_string()}
        """
        
        # Create visualizations
        method_fig = px.pie(
            df, 
            names='method', 
            title='Requests by HTTP Method',
            hole=0.3
        )
        
        resource_fig = px.bar(
            df['resourceType'].value_counts().reset_index(),
            x='resourceType',
            y='count',
            title='Resource Types Distribution'
        )
        
        return summary, method_fig, resource_fig

    def search_requests(capture_id: str, query: str):
        """Search through captured requests."""
        if not query:
            return "Please enter a search query"
        
        data, error = load_capture_data(capture_id)
        
        if error:
            return error
        
        # Simple text search
        matches = [
            r for r in data["requests"]
            if query.lower() in r["url"].lower()
        ]
        
        if not matches:
            return "No matches found"
        
        result = f"Found {len(matches)} matching requests:\n\n"
        for match in matches[:20]:  # Limit to 20
            result += f"- {match['method']} {match['url']}\n"
        
        if len(matches) > 20:
            result += f"\n... and {len(matches) - 20} more"
        
        return result

    # Build Gradio Interface
    with gr.Blocks(
        title="API Archaeologist - Network Capture Analyzer",
        theme=gr.themes.Soft()
    ) as interface:
        
        gr.Markdown("""
        # 🏺 API Archaeologist
        ### Explore and analyze captured network traffic
        
        Powered by [Modal](https://modal.com) | Data from MCP Network Analyzer
        """)
        
        with gr.Tab("📋 Browse Captures"):
            refresh_btn = gr.Button("🔄 Refresh Captures List")
            captures_display = gr.JSON(label="Available Captures")
            
            refresh_btn.click(
                fn=list_captures,
                outputs=captures_display
            )
            
            # Auto-load on startup
            interface.load(
                fn=list_captures,
                outputs=captures_display
            )
        
        with gr.Tab("🔍 Analyze"):
            with gr.Row():
                capture_id_input = gr.Textbox(
                    label="Capture ID",
                    placeholder="e.g., session_1763244439188_dab545d2"
                )
                analyze_btn = gr.Button("Analyze", variant="primary")
            
            analysis_summary = gr.Markdown(label="Summary")
            
            with gr.Row():
                method_chart = gr.Plot(label="HTTP Methods")
                resource_chart = gr.Plot(label="Resource Types")
            
            analyze_btn.click(
                fn=analyze_capture,
                inputs=capture_id_input,
                outputs=[analysis_summary, method_chart, resource_chart]
            )
        
        with gr.Tab("🔎 Search"):
            with gr.Row():
                search_capture_id = gr.Textbox(label="Capture ID")
                search_query = gr.Textbox(label="Search Query", placeholder="e.g., /api/")
            
            search_btn = gr.Button("Search", variant="primary")
            search_results = gr.Textbox(label="Results", lines=20)
            
            search_btn.click(
                fn=search_requests,
                inputs=[search_capture_id, search_query],
                outputs=search_results
            )
        
        with gr.Tab("⚙️ Settings"):
            gr.Markdown("""
            ### Configuration
            
            - **Data Location:** `/data/captures`
            - **Platform:** Modal (auto-scaling, serverless)
            - **MCP Server:** Deployed on Blaxel
            
            ### Next Steps
            
            1. Run network capture via your MCP tools
            2. Data automatically syncs to Modal Volume
            3. Analyze and explore here
            """)

    # Mount to FastAPI
    web_app = FastAPI()
    return mount_gradio_app(app=web_app, blocks=interface, path="/")


# Deployment command
if __name__ == "__main__":
    print("Deploy with: modal deploy modal_gradio_app.py")
    print("After deployment, access at: https://WORKSPACE--network-analyzer-ui.modal.run")
