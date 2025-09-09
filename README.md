# Whoop MCP Server

A lightweight MCP (Model Context Protocol) server for integrating with the Whoop API v2. Built for use with Claude Desktop and other MCP clients.

## Features

- 🔐 OAuth 2.0 authentication with Whoop
- 🔄 Automatic token refresh
- 📊 Access to all major Whoop data endpoints:
  - User profile and body measurements
  - Sleep, recovery, and cycle data
  - Workout information
- 🐳 Docker support for easy deployment
- 💾 Persistent token storage

## Quick Start

### Prerequisites

- Node.js >= 22.0.0 (for Method 1) OR Docker (for Method 2)
- pnpm >= 10.0.0 (for Method 1 only)
- [Whoop Developer Account](https://developer-dashboard.whoop.com)

### Setup for Claude Desktop

Choose one of the two methods below to integrate with Claude Desktop. The MCP server runs as part of Claude Desktop - you don't need to start it separately.

#### Method 1: Using Node.js

1. **Clone and install:**

   ```bash
   git clone https://github.com/alacore/whoop-tracker-mcp-server.git
   cd whoop-tracker-mcp-server
   pnpm install
   ```

2. **Build the server:**
   ```bash
   pnpm run build
   ```

3. **Configure Claude Desktop** - see [Claude Desktop Configuration](#claude-desktop-configuration) section below

#### Method 2: Using Docker

1. **Clone the repository:**

   ```bash
   git clone https://github.com/alacore/whoop-tracker-mcp-server.git
   cd whoop-tracker-mcp-server
   ```

2. **Build Docker image:**
   ```bash
   docker build -t whoop-mcp .
   ```

3. **Configure Claude Desktop** - see [Claude Desktop Configuration](#claude-desktop-configuration) section below

### Development Mode (Optional)

For testing the MCP server independently or during development:

1. **Configure environment:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your Whoop OAuth credentials:

   ```env
   WHOOP_CLIENT_ID=your_whoop_client_id
   WHOOP_CLIENT_SECRET=your_whoop_client_secret
   WHOOP_REDIRECT_URI=http://localhost:3000/callback
   WHOOP_SCOPES=offline read:profile read:body_measurement read:cycles read:recovery read:sleep read:workout
   ```

2. **Run in development mode:**
   ```bash
   pnpm run dev
   ```

   Note: This runs the server standalone for testing. For actual use with Claude Desktop, follow the configuration instructions below.

## Usage

### Claude Desktop Configuration

#### Method 1: Direct Node.js Execution

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "whoop": {
      "command": "node",
      "args": ["/path/to/whoop-tracker-mcp-server/dist/mcp-standalone.js"],
      "env": {
        "WHOOP_CLIENT_ID": "your_client_id",
        "WHOOP_CLIENT_SECRET": "your_client_secret",
        "WHOOP_REDIRECT_URI": "http://localhost:3000/callback",
        "WHOOP_SCOPES": "offline read:profile read:body_measurement read:cycles read:recovery read:sleep read:workout"
      }
    }
  }
}
```

**Prerequisites:**
- Node.js >= 22.0.0 installed
- Built server (`pnpm run build`)
- Replace `/path/to/whoop-tracker-mcp-server` with your actual project path

**Note:** The `offline` scope in `WHOOP_SCOPES` is required to receive a refresh token during the OAuth2 flow, enabling automatic token renewal without re-authentication.

#### Method 2: Docker Container

First, build the Docker image:

```bash
# Build the Docker image
docker build -t whoop-mcp .
```

Then add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "whoop": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e",
        "WHOOP_CLIENT_ID=your_client_id",
        "-e",
        "WHOOP_CLIENT_SECRET=your_client_secret",
        "-e",
        "WHOOP_REDIRECT_URI=http://localhost:3000/callback",
        "-e",
        "WHOOP_SCOPES=offline read:profile read:body_measurement read:cycles read:recovery read:sleep read:workout",
        "-v",
        "${HOME}/.whoop-mcp:/home/node/.whoop-mcp",
        "whoop-mcp"
      ]
    }
  }
}
```

**Prerequisites:**
- Docker installed and running
- Built Docker image (`docker build -t whoop-mcp .`)

**Notes:** 
- The `-v` flag mounts a local directory for persistent token storage across container restarts. First create the directory on your host machine (e.g., `mkdir -p ~/.whoop-mcp`), then mount it using the `-v` flag - this is where auth tokens will be stored
- The `offline` scope in `WHOOP_SCOPES` is required to receive a refresh token during the OAuth2 flow, enabling automatic token renewal without re-authentication

### Testing Your Setup

To test either configuration:

1. Restart Claude Desktop after updating the configuration
2. In Claude, use the Whoop tools:
   - Start with `whoop_auth_url` to begin authentication
   - Follow the OAuth flow to authorize
   - Use other tools like `whoop_get_profile` to verify access

## Available MCP Tools

### Authentication

- **whoop_auth_url** - Generate OAuth authorization URL
- **whoop_exchange_token** - Exchange auth code for access token
- **whoop_refresh_token** - Refresh expired access token

### Data Access

- **whoop_get_profile** - Get user profile
- **whoop_get_body_measurement** - Get body measurements
- **whoop_get_cycles** - Get physiological cycles
- **whoop_get_recovery** - Get recovery data
- **whoop_get_sleep** - Get sleep data
- **whoop_get_workouts** - Get workout data

## Authentication Flow

1. Use `whoop_auth_url` to get authorization URL
2. Open URL in browser and authorize
3. Copy the `code` parameter from callback URL
4. Use `whoop_exchange_token` with the code
5. Tokens are automatically saved and refreshed

## Development

```bash
# Development with hot reload
pnpm run dev

# Build for production
pnpm run build

# Run built version
pnpm start
```

## License

MIT
