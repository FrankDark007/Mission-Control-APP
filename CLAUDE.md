# Mission Control - Claude Code Guidelines

## Project Overview
Flood Doctor Mission Control - A multi-agent AI orchestration platform with 52 features.

## Repository
- **GitHub**: https://github.com/FrankDark007/Mission-Control-APP
- **Branch Strategy**: Feature branches pushed to origin for backup

## Commit Policy

### Auto-Commit Intervals
Commit and push to GitHub at these checkpoints:

1. **After major feature completion** - Any new component, service, or API endpoint
2. **Every 30 minutes of active coding** - Time-based safety backup
3. **Before context compaction** - Preserve work before summarization
4. **Before switching projects** - Clean handoff state
5. **On user request** - Explicit save points
6. **After fixing critical bugs** - Lock in the fix

### Commit Message Format
```
type: brief description

- Detail 1
- Detail 2

🤖 Generated with Claude Code
Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `restore`

## Project Structure

```
/projects/              # AI Director projects (each gets own folder)
/ops/                   # Main Mission Control app
  /client/              # React frontend (Vite + TypeScript)
  /routes/              # Express API routes
  /services/            # Backend services
  /mcp/                 # MCP server tools
```

## Key Files (Do Not Delete)
- `ops/server.js` - Main Express server
- `ops/client/src/App.tsx` - Main React app
- `ops/services/aiCore.js` - Multi-model AI abstraction
- `ops/services/missionQueue.js` - Task orchestration

## Feature Count: 52
See `/ops/docs/` for full feature documentation.

## Never Commit
- `.env` files (secrets)
- `node_modules/`
- `ops/worktrees/` (ephemeral agent branches)
- `.mcp.json` (may contain API keys)
