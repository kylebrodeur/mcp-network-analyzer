"""
Modal deployment configuration for MCP Network Analyzer Gradio UI

Deploy with: modal deploy modal_app.py
"""

import modal

# Create Modal app
app = modal.App("mcp-network-analyzer-ui")

# Create image with dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install([
        "gradio>=5.0.0",
        "requests>=2.31.0",
        "plotly>=5.18.0",
        "huggingface-hub>=0.24.0",
    ])
)

# Mount the app code
mount = modal.Mount.from_local_dir(
    ".",
    remote_path="/root/app"
)

@app.function(
    image=image,
    mounts=[mount],
    secrets=[
        modal.Secret.from_name("blaxel-api-key"),  # BLAXEL_API_KEY
        modal.Secret.from_name("huggingface-token"),  # HF_TOKEN
    ],
    allow_concurrent_inputs=100,
    timeout=600,
)
@modal.web_server(port=7860, startup_timeout=60)
def serve():
    """Serve the Gradio app."""
    import sys
    sys.path.insert(0, "/root/app")
    
    from app import demo
    return demo


@app.local_entrypoint()
def main():
    """Local entrypoint for testing."""
    print("🚀 Deploying MCP Network Analyzer UI to Modal...")
    print("📦 Image includes: Gradio, Plotly, HuggingFace Hub")
    print("🔐 Using secrets: blaxel-api-key, huggingface-token")
    print("✅ Deployment complete!")
    print("🌐 Access your app at the URL provided by Modal")
