# Remote MCP Server Setup Guide

This guide covers setting up and connecting to a remote MCP Network Analyzer server.

## Overview

Remote mode allows you to:
- Run the MCP server on cloud infrastructure (Blaxel, AWS, GCP, etc.)
- Share network captures across your team
- Access the same data from multiple clients
- Keep your local machine lightweight

## Deployment Options

### Option 1: Blaxel (Recommended)

Blaxel provides serverless MCP hosting with built-in HTTP transport.

**Steps:**

1. Deploy to Blaxel (if not already deployed):
```bash
# Ensure blaxel.toml is configured
blaxel deploy
```

2. Note your server URL:
```
https://run.blaxel.ai/YOUR_USERNAME/functions/mcp-network-analyzer/mcp
```

3. Run setup and configure remote connection:
```bash
pnpm run setup
# Choose "Remote" when prompted
# Enter your Blaxel URL
# Configure authentication if needed
```

4. Install to Claude Desktop:
```bash
./scripts/install-claude.sh
```

**Example mcp.json output:**
```json
{
  "mcpServers": {
    "network-analyzer": {
      "transport": {
        "type": "http",
        "url": "https://run.blaxel.ai/username/functions/mcp-network-analyzer/mcp"
      }
    }
  }
}
```

### Option 2: Custom Server

Deploy the HTTP transport server on your own infrastructure.

**Steps:**

1. Build the project:
```bash
pnpm run build
```

2. Deploy `dist/index-http.js` to your server:
```bash
# Example: Deploy to your server
scp -r dist/ user@your-server.com:/opt/mcp-network-analyzer/
```

3. Run the server:
```bash
# On your server
cd /opt/mcp-network-analyzer
PORT=3000 node dist/index-http.js
```

4. Configure reverse proxy (nginx/caddy) with SSL

5. Run setup on your local machine:
```bash
pnpm run setup
# Choose "Remote"
# Enter: https://your-server.com/mcp
```

## Authentication Options

The setup wizard supports three authentication methods:

### 1. Bearer Token
Best for: API-based authentication

```bash
# Setup will prompt:
Bearer token: your_secret_token
```

Result:
```json
{
  "transport": {
    "type": "http",
    "url": "https://your-server.com/mcp",
    "headers": {
      "Authorization": "Bearer your_secret_token"
    }
  }
}
```

### 2. API Key (Custom Header)
Best for: Custom authentication schemes

```bash
# Setup will prompt:
Header name: X-API-Key
Header value: your_api_key
```

Result:
```json
{
  "transport": {
    "type": "http",
    "url": "https://your-server.com/mcp",
    "headers": {
      "X-API-Key": "your_api_key"
    }
  }
}
```

### 3. Basic Auth
Best for: Simple username/password auth

```bash
# Setup will prompt:
Username: admin
Password: secret123
```

Result:
```json
{
  "transport": {
    "type": "http",
    "url": "https://your-server.com/mcp",
    "headers": {
      "Authorization": "Basic YWRtaW46c2VjcmV0MTIz"
    }
  }
}
```

## Storage Configuration

Remote servers still need storage configuration. The server itself (not the client) determines where data is stored.

**On the remote server**, set environment variables:

```bash
# Local storage on server
MCP_STORAGE_MODE=local

# Or cloud storage
MCP_STORAGE_MODE=cloud
MCP_CLOUD_PROVIDER=aws-s3
MCP_CLOUD_BUCKET=team-captures
MCP_CLOUD_REGION=us-east-1
MCP_CLOUD_ACCESS_KEY_ID=${AWS_ACCESS_KEY}
MCP_CLOUD_SECRET_ACCESS_KEY=${AWS_SECRET_KEY}

# Or HuggingFace Dataset
MCP_STORAGE_MODE=hf-dataset
HF_TOKEN=${HF_TOKEN}
HF_DATASET_REPO=team/network-captures
HF_DATASET_PRIVATE=true
```

## Profile Management

You can save both local and remote profiles:

```bash
# Create local profile
pnpm run setup
# Choose "Local" → Saved as "local"

# Create remote profile
pnpm run setup
# Choose "Remote" → Saved as "remote-blaxel"

# Switch between them
pnpm run setup -- --switch local
pnpm run setup -- --switch remote-blaxel

# List profiles
pnpm run setup -- --list
```

## Troubleshooting

### Connection Refused

**Symptom:** Cannot connect to remote server

**Solution:**
1. Verify URL is correct and accessible
2. Check if server is running: `curl https://your-server.com/health`
3. Verify authentication headers
4. Check server logs

### Authentication Failed

**Symptom:** 401 Unauthorized errors

**Solution:**
1. Verify authentication credentials
2. Check if token/key has expired
3. Ensure headers are correct format
4. Test with curl:
```bash
curl -H "Authorization: Bearer your_token" https://your-server.com/mcp
```

### Data Not Persisting

**Symptom:** Captures disappear after server restart

**Solution:**
1. Check server's `MCP_STORAGE_MODE` environment variable
2. Verify cloud credentials on server
3. Check server has write permissions to local storage path
4. Review server logs for storage errors

## Example Deployment: Blaxel + HuggingFace Dataset

Complete setup for team collaboration:

**1. On Blaxel (Server Side):**

Set environment variables in `blaxel.toml`:
```toml
[env]
MCP_STORAGE_MODE = "hf-dataset"
HF_TOKEN = "${HF_TOKEN}"
HF_DATASET_REPO = "team/network-captures"
HF_DATASET_PRIVATE = "true"
```

**2. On Local Machine (Client Side):**

```bash
# Run setup
pnpm run setup

# Choose "Remote"
# Enter: https://run.blaxel.ai/username/functions/mcp-network-analyzer/mcp
# Choose authentication method
# Save as "team-shared"

# Install to Claude
./scripts/install-claude.sh
```

**3. Result:**

All team members can:
- Connect to same remote server
- Access shared captures in HF Dataset
- Collaborate on API analysis
- Generate tools from shared discoveries

## Security Best Practices

1. **Always use HTTPS** for remote connections
2. **Rotate tokens regularly** - Update profiles when credentials change
3. **Use private datasets** - Keep sensitive captures private
4. **Limit token scope** - Use read-only tokens where possible
5. **Monitor access logs** - Track who's accessing the server
6. **Use VPN** - For extra security, deploy server on private network

## Next Steps

- [Main README](../README.md)
- [Project Status](./PROJECT_STATUS.md)
- [Blaxel Integration](./BLAXEL_INTEGRATION.md)
