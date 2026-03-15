# Blaxel Deployment Guide

## Overview

The MCP Network Analyzer can be deployed to [Blaxel](https://blaxel.ai), a serverless hosting platform optimized for Model Context Protocol (MCP) servers. This guide covers deploying your MCP server to Blaxel's global infrastructure with private workspace-based authentication.

## What is Blaxel?

Blaxel is a serverless computing platform that provides:

- **MCP Server Hosting**: Deploy MCP servers as auto-scalable serverless APIs
- **Streamable HTTP Transport**: Uses HTTP with Server-Sent Events (SSE) for MCP communication
- **Global Endpoints**: Automatically deployed to Blaxel's Global Agentics Network
- **Private Authentication**: Workspace-based auth where each user brings their own credentials
- **Full Observability**: Built-in tracing and monitoring for all requests
- **Zero Infrastructure**: No servers to manage, automatic scaling

## Authentication Model

Blaxel uses **private workspace-based authentication** by default:

- ✅ **Each user authenticates with their own Blaxel API key**
- ✅ **No need to share your credentials** with end users
- ✅ **Workspace access control** managed by Blaxel
- ✅ **Users create free Blaxel accounts** and generate their own API keys
- ✅ **Secure by default** - no public endpoints without explicit configuration

### How It Works

1. You deploy the MCP server to your Blaxel workspace
2. End users create their own free Blaxel accounts
3. Users generate API keys from their Blaxel profile (`Profile > Security`)
4. Users authenticate to your deployed MCP server with their own API keys
5. Blaxel handles all authorization automatically

## Prerequisites

1. **Blaxel CLI**: Install the Blaxel command-line tool
   ```bash
   npm install -g @blaxel/cli
   # or
   pnpm add -g @blaxel/cli
   ```

2. **Blaxel Account**: Create an account at [blaxel.ai](https://blaxel.ai)

3. **Authentication**: Log in via CLI
   ```bash
   bl login
   ```

## Deployment Configuration

The project includes a `blaxel.toml` configuration file:

```toml
# Blaxel MCP Server Deployment Configuration
name = "mcp-network-analyzer"
type = "function"

# Environment variables (non-secrets)
[env]
MCP_STORAGE_MODE = "local"

# HTTP trigger configuration
[[triggers]]
  id = "trigger-mcp-network-analyzer"
  type = "http"

[triggers.configuration]
  path = "functions/mcp-network-analyzer"
  # Private authentication - users bring their own API keys
  authenticationType = "private"
```

### Key Settings

- **`type = "function"`**: Deploys as an MCP server (function)
- **`authenticationType = "private"`**: Requires user authentication (default, secure)
- **Path**: Creates endpoint at `https://run.blaxel.ai/{YOUR-WORKSPACE}/functions/mcp-network-analyzer/mcp`

## Deployment Steps

### 1. Build Locally

First, ensure your server builds successfully:

```bash
pnpm install
pnpm run build
```

### 2. Test Locally with HTTP Mode

Test the HTTP transport locally before deploying:

```bash
# Terminal 1: Start HTTP server
PORT=3001 node dist/index-http.js

# Terminal 2: Test with MCP Inspector
npx @modelcontextprotocol/inspector http://localhost:3001/mcp --transport streamable-http
```

### 3. Deploy to Blaxel

Deploy with a single command:

```bash
bl deploy
```

Blaxel will:
- Build your TypeScript project automatically
- Package dependencies
- Deploy to Global Agentics Network
- Provide a global HTTPS endpoint

### 4. Get Your Endpoint

After deployment, your MCP server is available at:

```
https://run.blaxel.ai/{YOUR-WORKSPACE}/functions/mcp-network-analyzer/mcp
```

## Usage for End Users

### Step 1: Create Blaxel Account

End users should:
1. Visit [blaxel.ai](https://blaxel.ai) and create a free account
2. Navigate to `Profile > Security`
3. Generate an API key

### Step 2: Connect to the MCP Server

Users can connect using any MCP client with streamable HTTP support:

#### Claude Desktop Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "network-analyzer": {
      "transport": {
        "type": "streamableHttp",
        "url": "https://run.blaxel.ai/YOUR-WORKSPACE/functions/mcp-network-analyzer/mcp",
        "headers": {
          "X-Blaxel-Authorization": "Bearer USER_API_KEY_HERE"
        }
      }
    }
  }
}
```

#### MCP Inspector

Test with Inspector:

```bash
npx @modelcontextprotocol/inspector \
  https://run.blaxel.ai/YOUR-WORKSPACE/functions/mcp-network-analyzer/mcp \
  --transport streamable-http \
  -H "X-Blaxel-Authorization: Bearer USER_API_KEY_HERE"
```

#### cURL Example

```bash
curl -X POST \
  "https://run.blaxel.ai/YOUR-WORKSPACE/functions/mcp-network-analyzer/mcp" \
  -H "Content-Type: application/json" \
  -H "X-Blaxel-Authorization: Bearer USER_API_KEY_HERE" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Local Development

### Serve Locally with Blaxel CLI

Test your MCP server locally with hot reload:

```bash
# Start local development server with hot reload
bl serve --hotreload
```

This starts the server on `http://localhost:1338` and automatically reloads on code changes.

### Test with Inspector (Local)

Connect Inspector to your local server:

```bash
# In another terminal
npx @modelcontextprotocol/inspector http://localhost:1338/mcp --transport streamable-http
```

## Deployment Management

### View Deployments

List all deployments in your workspace:

```bash
bl list functions
```

### View Logs

Monitor your deployed MCP server:

```bash
bl logs mcp-network-analyzer --follow
```

### Update Deployment

Redeploy with changes:

```bash
# Make code changes
pnpm run build

# Deploy update
bl deploy
```

### Traffic Management

Control traffic routing between revisions:

```bash
# Deploy new revision with 0% traffic (canary)
bl deploy --traffic 0

# Gradually increase traffic
bl deploy --traffic 50   # 50% to new revision
bl deploy --traffic 100  # Full traffic to new revision
```

## Configuration Options

### Environment Variables

Add environment variables in `blaxel.toml`:

```toml
[env]
MCP_STORAGE_MODE = "local"
DEBUG = "false"
```

Or set them via CLI during deployment:

```bash
bl deploy --env DEBUG=true
```

### Runtime Configuration

Adjust memory and timeout in `blaxel.toml`:

```toml
[runtime]
memory = 512    # Memory in MB (default: 256)
timeout = 60    # Timeout in seconds (default: 30)
```

### Public vs Private Endpoints

To make your MCP server public (not recommended):

```toml
[triggers.configuration]
  authenticationType = "public"
```

⚠️ **Warning**: Public endpoints bypass Blaxel authentication. You'll need to implement your own auth.

## Monitoring & Observability

### Built-in Tracing

Blaxel automatically traces all requests:

1. Visit [Blaxel Dashboard](https://console.blaxel.ai)
2. Navigate to your workspace
3. Select `Functions > mcp-network-analyzer`
4. View traces, latency, and error rates

### Health Checks

The HTTP server includes a health check endpoint:

```bash
curl https://run.blaxel.ai/YOUR-WORKSPACE/functions/mcp-network-analyzer/health
```

Returns:

```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

## Troubleshooting

### Deployment Fails

**Check logs:**
```bash
bl logs mcp-network-analyzer
```

**Common issues:**
- TypeScript compilation errors: Run `pnpm run type-check`
- Missing dependencies: Ensure `pnpm install` succeeds
- Invalid `blaxel.toml`: Validate TOML syntax

### Authentication Errors

**User sees "Unauthorized":**
- Verify user has valid Blaxel API key
- Check API key hasn't expired
- Ensure correct header: `X-Blaxel-Authorization: Bearer KEY`

### Connection Timeouts

**Increase timeout in `blaxel.toml`:**
```toml
[runtime]
timeout = 120  # 2 minutes
```

### Cold Start Issues

Blaxel optimizes cold starts, but for large dependencies:
- Keep dependencies minimal
- Use lazy loading where possible
- Consider pre-warming strategies

## Cost & Limits

### Pricing Model

Blaxel charges based on:
- **Compute time**: Duration of request processing
- **Memory**: Memory allocated to function
- **Network**: Data transfer (egress)

Free tier available for development and testing.

### Resource Limits

Default limits (can be increased):
- Memory: 256MB - 2GB
- Timeout: 30s - 300s
- Concurrent requests: Auto-scaled

## Security Best Practices

1. **Never commit API keys**: Use environment variables
2. **Use private auth**: Keep default `authenticationType = "private"`
3. **Rotate keys regularly**: Update user API keys periodically
4. **Monitor access**: Review logs for unusual activity
5. **Limit workspace access**: Only grant access to trusted users

## Migration from Local/Cloud

### From Local Storage

No migration needed! Data capture works the same way:
- Captured sessions stored locally on the serverless instance
- Each session is ephemeral (exists during function execution)
- For persistent storage, integrate cloud storage separately

### From Cloud Storage (S3/GCS)

Update environment variables in `blaxel.toml`:

```toml
[env]
MCP_STORAGE_MODE = "cloud"
MCP_CLOUD_PROVIDER = "aws-s3"
MCP_CLOUD_BUCKET = "your-bucket"
```

Add cloud credentials as Blaxel secrets (not in `blaxel.toml`).

## Support & Resources

### Documentation

- **Blaxel Docs**: [docs.blaxel.ai](https://docs.blaxel.ai)
- **MCP Specification**: [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **Project README**: [README.md](../README.md)

### Community

- Blaxel Discord: Join for support and discussions
- GitHub Issues: Report bugs or request features

### Getting Help

For deployment issues:
1. Check Blaxel docs: [docs.blaxel.ai/Functions](https://docs.blaxel.ai/Functions)
2. Review logs: `bl logs mcp-network-analyzer`
3. Test locally first: `bl serve --hotreload`
4. Contact Blaxel support

## Next Steps

1. ✅ **Deploy**: Run `bl deploy` to deploy your first version
2. ✅ **Test**: Use MCP Inspector to verify functionality
3. ✅ **Share**: Give users your endpoint URL
4. ✅ **Monitor**: Watch logs and traces in Blaxel dashboard
5. ✅ **Iterate**: Make changes and redeploy with `bl deploy`

## Example: Complete Deployment Flow

```bash
# 1. Install dependencies
pnpm install

# 2. Build locally
pnpm run build

# 3. Test locally
PORT=3001 node dist/index-http.js

# 4. Test with Inspector (in another terminal)
npx @modelcontextprotocol/inspector http://localhost:3001/mcp --transport streamable-http

# 5. Deploy to Blaxel
bl deploy

# 6. Test deployed version
npx @modelcontextprotocol/inspector \
  https://run.blaxel.ai/YOUR-WORKSPACE/functions/mcp-network-analyzer/mcp \
  --transport streamable-http \
  -H "X-Blaxel-Authorization: Bearer YOUR_API_KEY"

# 7. Monitor logs
bl logs mcp-network-analyzer --follow
```

## Conclusion

Blaxel provides a seamless, serverless hosting solution for your MCP Network Analyzer. With private workspace-based authentication, users can securely access your deployed MCP server without you sharing credentials. Deploy once with `bl deploy`, and your MCP server is globally available with automatic scaling, monitoring, and zero infrastructure management.

**Ready to deploy?** Run `bl deploy` and your MCP server will be live in minutes! 🚀
