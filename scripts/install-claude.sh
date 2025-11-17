#!/bin/bash

# Install MCP Network Analyzer to Claude Desktop
# Automatically merges configuration into Claude Desktop config

set -e

echo "🔧 Installing MCP Network Analyzer to Claude Desktop..."
echo ""

# Detect OS
OS="$(uname -s)"
case "$OS" in
  Darwin*)
    CONFIG_DIR="$HOME/Library/Application Support/Claude"
    ;;
  Linux*)
    CONFIG_DIR="$HOME/.config/Claude"
    ;;
  *)
    echo "❌ Unsupported operating system: $OS"
    exit 1
    ;;
esac

CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Check if Claude Desktop config exists
if [ ! -d "$CONFIG_DIR" ]; then
  echo "❌ Claude Desktop not found at: $CONFIG_DIR"
  echo ""
  echo "Please install Claude Desktop first:"
  echo "https://claude.ai/download"
  exit 1
fi

# Create config directory if it doesn't exist
mkdir -p "$CONFIG_DIR"

# Backup existing config
if [ -f "$CONFIG_FILE" ]; then
  BACKUP_FILE="$CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"
  echo "📋 Backing up existing config to:"
  echo "   $BACKUP_FILE"
  cp "$CONFIG_FILE" "$BACKUP_FILE"
  echo ""
fi

# Read existing config or create new one
if [ -f "$CONFIG_FILE" ]; then
  EXISTING_CONFIG=$(cat "$CONFIG_FILE")
else
  EXISTING_CONFIG='{}'
fi

# Load environment variables from .env if it exists
ENV_VARS='{}'
if [ -f "$PROJECT_ROOT/.env" ]; then
  echo "📦 Loading configuration from .env file..."
  
  # Parse .env file and create JSON
  ENV_VARS=$(node -e "
    const fs = require('fs');
    const envFile = fs.readFileSync('$PROJECT_ROOT/.env', 'utf-8');
    const env = {};
    envFile.split('\\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        env[match[1].trim()] = match[2].trim();
      }
    });
    console.log(JSON.stringify(env));
  ")
  echo ""
fi

# Build new server config
SERVER_CONFIG=$(node -e "
const existing = $EXISTING_CONFIG;
const env = $ENV_VARS;

if (!existing.mcpServers) {
  existing.mcpServers = {};
}

existing.mcpServers['network-analyzer'] = {
  command: 'node',
  args: ['$PROJECT_ROOT/dist/index.js'],
  env: env
};

console.log(JSON.stringify(existing, null, 2));
")

# Write new config
echo "$SERVER_CONFIG" > "$CONFIG_FILE"

echo "✅ Installation complete!"
echo ""
echo "📍 Configuration saved to:"
echo "   $CONFIG_FILE"
echo ""
echo "🔄 Next steps:"
echo "1. Restart Claude Desktop"
echo "2. Look for 'network-analyzer' in available MCP servers"
echo "3. Try: 'Capture network traffic from https://example.com'"
echo ""
echo "💡 Tip: Run 'pnpm run status' to check your setup"
echo ""
