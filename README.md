# Mission Control V6

**Flood Doctor SEO Orchestration Platform**

Mission Control enables Claude Desktop to act as a Project Manager, orchestrating agents, sub-agents, and AI providers to research competitors, generate optimized content, create graphics, and continuously monitor and outrank local competitors.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CLAUDE DESKTOP (Project Manager)                  │
│  Connectors: Filesystem, Chrome Control, Mac Control, PDF Tools     │
│  Connects to Mission Control via MCP protocol                        │
└─────────────────────────────────────────────────────────────────────┘
                              │ MCP (SSE/HTTP)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     MISSION CONTROL                                  │
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ MCP SERVER  │  │  REST API   │  │ DASHBOARD   │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
│         │                                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ INTEGRATIONS: Perplexity, GSC, GA4, Ahrefs, Refract          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│         │                                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ AGENT SPAWNING: Claude Code in git worktrees + Auto-Pilot    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## MCP Tools Available to Claude Desktop

| Tool | Description |
|------|-------------|
| `call_gemini` | Call Gemini Pro 3 with prompt |
| `call_perplexity` | Real-time web search |
| `check_serp` | Live Google rankings for keyword+location |
| `get_gsc_data` | Search Console data |
| `get_analytics` | GA4 data |
| `get_ahrefs_data` | Backlinks, keywords, competitors |
| `generate_location_page` | Create city service pages |
| `generate_blog_post` | SEO blog content |
| `generate_svg` | Refract AI graphics |
| `spawn_agent` | Start Claude Code in worktree |
| `get_agent_status` | Check agent status |
| `send_to_agent` | Send input to agent |
| `stop_agent` | Stop running agent |
| `get_agent_logs` | Get recent agent logs |

## Quick Start

### 1. Install Dependencies

```bash
cd ops
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Start Server

```bash
npm start
# or for development with auto-reload:
npm run dev
```

### 4. Connect Claude Desktop

Copy `.mcp.json` to your home directory or Claude Desktop config location.

Claude Desktop will connect to `http://localhost:3001/mcp/sse` and receive all the tools listed above.

## Key Features

### Auto-Pilot Agent Management

When spawning Claude Code agents, the auto-pilot system:
- Detects permission prompts (`[y/n]`, `confirm?`, etc.)
- Uses Gemini to evaluate safety of the request
- Automatically approves safe operations
- Escalates dangerous requests to the dashboard

### Self-Healing

When an agent crashes:
- Logs are analyzed by Gemini
- Root cause is diagnosed
- Fix command is proposed
- Dashboard shows repair option

### Integrations

| Service | Status | Notes |
|---------|--------|-------|
| Perplexity | API Key | Real-time web search |
| Google Search Console | OAuth | Search performance data |
| Google Analytics 4 | OAuth | Traffic and conversion data |
| Ahrefs | API Key | Backlinks and competitor analysis |
| Refract AI | API Key | SVG generation (fallback: built-in) |
| SERP Checker | API/Scrape | Live ranking checks |

## File Structure

```
ops/
├── server.js              # Main server with MCP mount
├── package.json           # Dependencies (v6.0.0)
├── models.json            # AI model registry
├── mcp/
│   └── mcpServer.js       # MCP Server with tool registration
├── routes/
│   └── restoredApi.js     # 51 REST routes
├── services/
│   ├── agentManager.js    # Claude spawning, auto-pilot, self-healing
│   ├── autopilotService.js
│   ├── autopilotController.js
│   ├── gitService.js
│   ├── missionQueue.js
│   └── integrations/
│       ├── index.js       # Integration exports
│       ├── perplexity.js  # Perplexity API
│       ├── gsc.js         # Google Search Console
│       ├── ga4.js         # Google Analytics 4
│       ├── ahrefs.js      # Ahrefs API
│       ├── refract.js     # SVG generation
│       └── serp.js        # SERP checking
└── client/                # React dashboard
```

## API Endpoints

### Integration Status
```
GET /api/integrations/status
```

### OAuth URLs
```
GET /api/integrations/oauth-urls
```

### OAuth Callback
```
GET /api/oauth/callback?code=...&state=gsc|ga4
```

### MCP SSE Stream
```
GET /mcp/sse
```

### MCP Tool Call
```
POST /mcp/message
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "check_serp",
    "arguments": {
      "keyword": "water damage restoration",
      "location": "Arlington, VA",
      "domain": "flood.doctor"
    }
  }
}
```

## Version History

- **V6.0.0** - MCP Server integration, Claude Code spawning with auto-pilot and self-healing
- **V5.11** - Restored API routes, dashboard components
- **V5.0** - Initial Mission Control with swarm architecture

---

**Flood Doctor LLC** | DPOR Class A License No. 27-05155505
