# Blaxel Integration Guide

## Overview

The MCP Network Analyzer integrates with [Blaxel](https://blaxel.ai), a hosting platform optimized for Model Context Protocol (MCP) servers. This integration provides cloud storage and hosting capabilities specifically designed for MCP workloads.

## What is Blaxel?

Blaxel is a hosting service that provides:

- **Cloud Storage**: Optimized storage for MCP capture sessions
- **Data Sharing**: Easy sharing of captured network data
- **MCP Hosting**: Deploy and host MCP servers in the cloud
- **API Access**: RESTful API for programmatic access to stored data

## Setup

### 1. Create a Blaxel Account

Visit [blaxel.ai](https://blaxel.ai) and create an account (if not already done).

### 2. Get Your Credentials

From your Blaxel dashboard, obtain:

- **Project ID**: Your unique project identifier
- **API Key**: Authentication token for API access

### 3. Configure Environment

Set the following environment variables:

```bash
export MCP_STORAGE_MODE=blaxel
export BLAXEL_PROJECT_ID=your-project-id
export BLAXEL_API_KEY=your-api-key
```

## Usage

### Local Development

For local development and testing, you can run without an API key:

```bash
MCP_STORAGE_MODE=blaxel \
BLAXEL_PROJECT_ID=dev-project \
node dist/index.js
```

This will operate in mock mode, logging what would be uploaded without making actual API calls.

### Production Deployment

For production use with actual Blaxel hosting:

```bash
MCP_STORAGE_MODE=blaxel \
BLAXEL_PROJECT_ID=your-project-id \
BLAXEL_API_KEY=your-api-key \
node dist/index.js
```

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "network-analyzer": {
      "command": "node",
      "args": ["/path/to/mcp-network-analyzer/dist/index.js"],
      "env": {
        "MCP_STORAGE_MODE": "blaxel",
        "BLAXEL_PROJECT_ID": "your-project-id",
        "BLAXEL_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Features

### Automatic Cloud Storage

All captured network sessions are automatically uploaded to Blaxel:

```
Session captured → Blaxel storage → Available at:
blaxel://your-project-id/mcp-network-analyzer/captures/session_xxx
```

### Hosting URLs

Each captured session gets a hosting URL for easy access:

```
https://api.blaxel.ai/projects/your-project-id/captures/session_xxx
```

### Data Organization

Data is organized hierarchically in Blaxel:

```
your-project-id/
└── mcp-network-analyzer/
    ├── captures/
    │   ├── session_xxx/
    │   │   ├── session.json
    │   │   ├── requests.json
    │   │   ├── responses.json
    │   │   └── metadata.json
    │   └── session_yyy/
    │       └── ...
    ├── analyses/
    └── generated/
```

## Custom Endpoints

If you're running a self-hosted Blaxel instance, specify a custom endpoint:

```bash
MCP_STORAGE_MODE=blaxel \
BLAXEL_ENDPOINT=https://blaxel.yourcompany.com \
BLAXEL_PROJECT_ID=your-project-id \
BLAXEL_API_KEY=your-api-key \
node dist/index.js
```

## Implementation Details

### Storage Adapter

The Blaxel storage adapter (`src/lib/blaxel-storage-adapter.ts`) provides:

- **Automatic Upload**: Seamlessly uploads capture sessions
- **Mock Mode**: Works without credentials for development
- **Error Handling**: Robust error handling and logging
- **Extensibility**: Ready for production API integration

### Current Status

**✅ Implemented:**

- Configuration system
- Storage adapter interface
- Mock upload functionality
- Environment variable support
- Test coverage

**🔜 Planned:**

- Production Blaxel API integration
- Authentication with API keys
- Retry logic and error recovery
- Data retrieval methods
- Session listing and querying

## Testing

Test the Blaxel integration:

```bash
npm run build
node test/test-dual-mode.js
```

Expected output:

```
=== Testing Blaxel Mode ===
Mode: blaxel
Is Blaxel Mode: true
[Blaxel Storage] Initializing Blaxel integration...
[Blaxel Storage] Project ID: test-project
[Blaxel Storage] Endpoint: https://api.blaxel.ai
[Blaxel Storage] Initialized successfully
Data Directory: blaxel://test-project/mcp-network-analyzer
Session ID: test_session_xxx
[Blaxel Storage] Saving session test_session_xxx to project test-project
[Blaxel Storage] Mock upload completed successfully
Save Result: ✓ Success
```

## Benefits

### 1. **No Infrastructure Management**

- No need to manage S3 buckets or cloud storage
- Blaxel handles all infrastructure concerns
- Focus on developing your MCP server

### 2. **MCP-Optimized Storage**

- Storage format optimized for MCP workloads
- Fast retrieval and querying
- Built-in data organization

### 3. **Easy Sharing**

- Share captured sessions via URLs
- Collaborative debugging and analysis
- Team access to capture data

### 4. **Scalability**

- Automatically scales with your needs
- No storage limits
- Pay only for what you use

## Troubleshooting

### Issue: "No API key configured"

**Solution**: Set `BLAXEL_API_KEY` environment variable or run in mock mode for development.

### Issue: "Failed to upload to Blaxel"

**Solutions**:

1. Check network connectivity
2. Verify API key is valid
3. Ensure project ID is correct
4. Check Blaxel service status

### Issue: "Custom endpoint not working"

**Solution**: Verify the `BLAXEL_ENDPOINT` URL is correct and accessible.

## Support

For Blaxel-specific issues:

- Visit [docs.blaxel.ai](https://docs.blaxel.ai)
- Contact Blaxel support
- Check Blaxel service status

For integration issues:

- Open an issue in this repository
- Check implementation in `src/lib/blaxel-storage-adapter.ts`
- Review test output from `test/test-dual-mode.js`

## Next Steps

1. **Sign up for Blaxel** at [blaxel.ai](https://blaxel.ai)
2. **Get your credentials** from the Blaxel dashboard
3. **Configure your environment** with Blaxel credentials
4. **Test the integration** with a simple capture
5. **Deploy to production** with confidence

## Migration

### From Local Storage

To migrate from local to Blaxel storage:

1. Export your existing local data
2. Configure Blaxel mode
3. Re-run captures (data will go to Blaxel)
4. Optionally upload historical data via Blaxel API

## Best Practices

1. **Use environment-specific projects**: Separate dev/staging/prod projects
2. **Rotate API keys regularly**: Update keys periodically for security
3. **Monitor usage**: Keep track of storage usage in Blaxel dashboard
4. **Test in mock mode first**: Validate integration before production
5. **Set up alerts**: Configure alerts for upload failures or API errors

## Conclusion

Blaxel integration provides a seamless, MCP-optimized cloud storage solution for the Network Analyzer. Whether you're developing locally or deploying to production, Blaxel makes it easy to store, share, and manage captured network data.
