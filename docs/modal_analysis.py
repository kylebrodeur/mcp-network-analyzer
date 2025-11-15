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
    
    # Cluster similar endpoints using TF-IDF
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
    has_id_pattern = any(
        ':id' in url or any(c.isdigit() for c in url) for url in urls
    )
    
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
- Clear comments explaining each section
- Robust error handling for network failures
- Progress logging so users know what's happening
- Type definitions (if TypeScript)
- Configuration options at the top of the file

Return ONLY the code, no markdown code blocks or explanations."""

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
    import sys
    from pathlib import Path
    
    capture_path = Path(capture_file)
    
    if not capture_path.exists():
        print(f"Error: {capture_file} not found")
        print("Usage: modal run modal_analysis.py --capture-file <path>")
        sys.exit(1)
    
    with open(capture_path) as f:
        capture_data = {"requests": json.load(f)}
    
    print("🔍 Running deep pattern analysis...")
    analysis = analyze_patterns.remote(capture_data)
    print("\n📊 Analysis Results:")
    print(json.dumps(analysis, indent=2))
    
    print("\n🤖 Generating TypeScript export code with Claude...")
    code = generate_export_code.remote(analysis, "typescript")
    print("\n📝 Generated Code:")
    print("=" * 80)
    print(code)
    print("=" * 80)
    
    # Save generated code
    output_path = Path("generated_export.ts")
    output_path.write_text(code)
    print(f"\n✅ Code saved to: {output_path}")
