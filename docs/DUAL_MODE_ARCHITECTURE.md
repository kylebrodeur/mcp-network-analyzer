# Multi-Mode Storage Architecture

This document explains the multi-mode storage architecture implemented in MCP Network Analyzer.

## Overview

MCP Network Analyzer supports three storage modes:
1. **Local Mode** - Stores data in the local file system (default)
2. **Cloud Mode** - Stores data in cloud storage (AWS S3, GCS, Azure Blob, etc.)
3. **Blaxel Mode** - Integrates with Blaxel hosting service for optimized MCP storage

## Architecture

### Component Structure

```
┌─────────────────────────────────────────────────────────┐
│                    Storage Facade                       │
│                   (storage.ts)                          │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌──▼────────┐ ┌─▼──────────────┐
│Local Adapter │ │Cloud      │ │Blaxel Adapter  │
│(local-       │ │Adapter    │ │(blaxel-storage-│
│ storage-     │ │(cloud-    │ │ adapter.ts)    │
│ adapter.ts)  │ │storage-   │ │                │
│              │ │adapter.ts)│ │                │
└──────┬───────┘ └─────┬─────┘ └────────┬───────┘
       │               │                │
┌──────▼───────┐ ┌─────▼────────┐ ┌────▼────────┐
│File System   │ │Cloud Storage │ │Blaxel API   │
│(local disk)  │ │(S3/GCS/Azure)│ │(MCP Hosting)│
└──────────────┘ └──────────────┘ └─────────────┘
```

### Configuration

Configuration is managed by `Config` class (config.ts):

- Singleton pattern for global configuration
- Loads settings from environment variables
- Supports both local and cloud configurations
- Can be updated programmatically for testing

### Storage Adapters

All storage adapters implement the `IStorageAdapter` interface:

```typescript
interface IStorageAdapter {
  initialize(): Promise<void>;
  saveCaptureSession(session: CaptureSession): Promise<StorageResult>;
  saveData(relativePath: string, data: unknown): Promise<StorageResult>;
  getSessionPath(sessionId: string): string;
  getDataDirectory(): string;
}
```

#### Local Storage Adapter

- Stores data in local file system
- Uses configurable data directory
- Default location: `./data` (development) or `./mcp-network-data` (production)
- Creates hierarchical directory structure for organized storage

#### Cloud Storage Adapter

- Stores data in cloud storage services
- Supports multiple providers (AWS S3, GCS, Azure Blob)
- Uses provider-specific SDKs for uploads
- Includes retry logic and error handling

#### Blaxel Storage Adapter

- Integrates with Blaxel MCP hosting platform
- Optimized for MCP workloads and data sharing
- Provides hosting URLs for captured sessions
- Mock implementation ready for production API integration
- Supports custom endpoints for self-hosted Blaxel instances

## Configuration

### Environment Variables

#### Local Mode
```bash
MCP_STORAGE_MODE=local
MCP_NETWORK_ANALYZER_DATA=/path/to/data  # Optional, defaults to ./data
```

#### Cloud Mode
```bash
MCP_STORAGE_MODE=cloud
MCP_CLOUD_PROVIDER=aws-s3
MCP_CLOUD_BUCKET=my-bucket
MCP_CLOUD_REGION=us-east-1
MCP_CLOUD_ACCESS_KEY_ID=xxx
MCP_CLOUD_SECRET_ACCESS_KEY=yyy
```

#### Blaxel Mode
```bash
MCP_STORAGE_MODE=blaxel
BLAXEL_PROJECT_ID=your-project-id
BLAXEL_API_KEY=your-api-key  # Optional for local dev
BLAXEL_ENDPOINT=https://api.blaxel.ai  # Optional, custom endpoint
MCP_CLOUD_ACCESS_KEY_ID=xxx
MCP_CLOUD_SECRET_ACCESS_KEY=yyy
```

### Programmatic Configuration

```typescript
import { Config } from './lib/config.js';

const config = Config.getInstance();

// Switch to cloud mode
config.updateConfig({
  mode: 'cloud',
  cloudStorage: {
    provider: 'aws-s3',
    bucket: 'my-bucket',
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'xxx',
      secretAccessKey: 'yyy'
    }
  }
});
```

## Usage

The Storage facade automatically selects the appropriate adapter based on configuration:

```typescript
import { Storage } from './lib/storage.js';

// Initialize storage (creates directories or validates cloud config)
await Storage.ensureDirectories();

// Save a capture session (works in both modes)
const result = await Storage.saveCaptureSession(session);

// Get storage mode
const mode = Storage.getMode(); // 'local' or 'cloud'
```

## Migration Between Modes

To switch between local and cloud modes:

1. Export data from current storage
2. Update configuration
3. Import data to new storage
4. Verify data integrity

## Future Enhancements

### Phase 1 (Current)
- ✅ Configuration system
- ✅ Storage adapter interface
- ✅ Local storage adapter
- ✅ Cloud storage adapter (basic implementation)
- ✅ Documentation

### Phase 2 (Planned)
- [ ] Complete cloud provider implementations
  - [ ] AWS S3 with AWS SDK
  - [ ] Google Cloud Storage with GCS SDK
  - [ ] Azure Blob Storage with Azure SDK
- [ ] Storage migration tools
- [ ] Data synchronization between modes
- [ ] Caching layer for cloud mode

### Phase 3 (Future)
- [ ] Hybrid mode (local cache + cloud backup)
- [ ] Multi-region support
- [ ] Encryption at rest
- [ ] Compression for large captures
- [ ] Cost optimization features

## Security Considerations

### Credentials Management
- Never commit credentials to source control
- Use environment variables or secure credential stores
- Support IAM roles for cloud providers
- Implement least-privilege access policies

### Data Privacy
- All captured data may contain sensitive information
- Use encryption in transit and at rest
- Implement access controls for cloud storage
- Consider data retention policies

## Testing

### Unit Tests
```typescript
// Test local storage
Config.reset();
process.env.MCP_STORAGE_MODE = 'local';
const localStorage = new LocalStorageAdapter();
await localStorage.initialize();

// Test cloud storage
Config.reset();
process.env.MCP_STORAGE_MODE = 'cloud';
const cloudStorage = new CloudStorageAdapter();
await cloudStorage.initialize();
```

### Integration Tests
- Test mode switching
- Verify data consistency
- Test error handling
- Validate configuration loading

## Troubleshooting

### Common Issues

**Issue: Cloud mode not working**
- Check environment variables are set correctly
- Verify cloud credentials have proper permissions
- Check network connectivity to cloud provider
- Review logs for specific error messages

**Issue: Local mode directory permissions**
- Ensure write permissions to data directory
- Check disk space availability
- Verify path configuration

**Issue: Mode switching not taking effect**
- Restart the MCP server
- Call `Storage.resetAdapter()` to force reinitialization
- Clear any cached configuration

## Best Practices

1. **Use local mode for development** - Faster, easier to debug
2. **Use cloud mode for production** - Better scalability, backup, and sharing
3. **Set up proper monitoring** - Track storage usage and errors
4. **Implement backup strategies** - Regular backups regardless of mode
5. **Test both modes** - Ensure your application works in both configurations

## References

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [Google Cloud Storage Documentation](https://cloud.google.com/storage/docs)
- [Azure Blob Storage Documentation](https://docs.microsoft.com/en-us/azure/storage/blobs/)
