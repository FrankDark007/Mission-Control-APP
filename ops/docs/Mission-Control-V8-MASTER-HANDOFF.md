# Mission Control V8 — Master Handoff Document

**Created:** December 27, 2025  
**V7 Status:** COMPLETE (8,914 lines, 70+ MCP tools)  
**V8 Goal:** Make delegation mandatory and execution impossible anywhere except Claude Code

---

## V8 IN ONE SENTENCE

> **V8 makes delegation mandatory and execution impossible anywhere except Claude Code.**

---

## Table of Contents

1. V7 Completion Summary
2. V8 Core Requirements (Execution Authority)
3. V8 Vision
4. Critical Problems to Solve
5. Mobile UI Requirements
6. Dynamic AI Model Registry
7. Director AI Pattern
8. Design System & CSS Extraction
9. Asset Pipeline
10. Reference Pages
11. Implementation Phases
12. Project Paths & Commands
13. Non-Negotiables
14. Session Resume Instructions

---

## 1. V7 Completion Summary

### What Was Built

| Phase | Component | Status |
|-------|-----------|--------|
| 1 | StateStore, schema, ArtifactTypes, storage | ✅ Complete |
| 2 | missionValidator, artifactValidator | ✅ Complete |
| 3 | rateLimitService, costEstimatorService, approvalPolicyService | ✅ Complete |
| 4 | spawn_agent vs spawn_agent_immediate split | ✅ Complete |
| 5 | taskGraphService (dependency resolution, task gates) | ✅ Complete |
| 6 | selfHealingService (diagnosis, proposals, rollback) | ✅ Complete |
| 7 | watchdogService, rankingWatchdogService | ✅ Complete |
| 8 | MCP tools (11 files, 70+ tools) | ✅ Complete |
| 9 | Integration healthCheck() methods (7 integrations) | ✅ Complete |

### MCP Tools Created (70+)

| Category | Tools |
|----------|-------|
| mission | create, get, list, update_status, delete, get_contract, check_gates |
| task | create, get, list, update_status, get_ready, check_gates, get_dependencies, create_batch |
| artifact | create, get, list, query, validate, check_gates |
| agent | spawn_agent, spawn_agent_immediate, list, get, heartbeat, update_status, check_stale |
| approval | request, decide, list_pending, get, auto_approve, get_policy, check_budget |
| state | get_snapshot, get_mission_summary, is_armed, arm, disarm, get_circuit_breaker, reset_circuit_breaker, get_system_health |
| ranking | ingest, get, list, create_artifact, get_history, compare |
| selfHeal | diagnose, propose, apply, block, get_proposals, rollback, clear_history |
| watchdog | start, stop, force_tick, get_status, get_signals, get_active_issues, recover_agent, get_all_status, start_all, stop_all |
| provider | check_rate_limit, record_call, record_throttle, get_rate_status, get_quota_remaining, estimate_task_cost, estimate_agent_cost, record_actual_cost, get_cost_history, list_models, list_providers, health |

### Services with healthCheck()

- perplexity.js — API key validation + test query
- serp.js — Scrape/API validation with latency tracking
- gsc.js — OAuth status + listSites API check
- ga4.js — OAuth status + client initialization
- ahrefs.js — subscription-info endpoint validation
- refract.js — health endpoint validation
- index.js — Unified healthCheck() aggregating all services

---

## 2. V8 Core Requirements (Execution Authority)

**These are the ONLY changes for V8. No feature creep.**

### 2.1 Execution Authority Flag (MUST-HAVE)

Add to mission schema:

```javascript
{
  // ... existing fields
  executionAuthority: 'CLAUDE_CODE' | 'DESKTOP',  // Who can execute
  executionMode: 'RECIPE_ONLY' | 'IMMEDIATE_ONLY', // How execution happens
}
```

**Enforcement:**
- If `executionAuthority === 'CLAUDE_CODE'`, inline execution is FORBIDDEN
- Claude Desktop cannot write files, run commands, or generate code inline

### 2.2 Mandatory Delegation Gate

Before ANY task execution, enforce:

```javascript
if (mission.executionAuthority === 'CLAUDE_CODE') {
  // ONLY these are allowed:
  // - agent.spawn_agent (recipe mode)
  // - agent.spawn_agent_immediate (armed mode)
  
  // REJECT:
  // - Inline code generation
  // - Direct file writes
  // - Command execution
  
  if (attemptedInlineExecution) {
    throw new ExecutionViolationError('Delegation required');
  }
}
```

### 2.3 Execution Mode Lock

| Mode | Allowed Tools | Behavior |
|------|---------------|----------|
| `RECIPE_ONLY` | `spawn_agent` only | Returns recipe, human executes |
| `IMMEDIATE_ONLY` | `spawn_agent_immediate` only | Auto-executes via Claude Code |

**Enforcement:** Tool availability controlled by mode, not honor system.

### 2.4 Bootstrap Artifact

Create once per mission at startup:

```json
{
  "id": "artifact-bootstrap-xxx",
  "type": "mission_bootstrap",
  "missionId": "mission-xxx",
  "payload": {
    "executionAuthority": "CLAUDE_CODE",
    "executionMode": "RECIPE_ONLY",
    "resumePolicy": "continue_from_last_task",
    "delegationRequired": true,
    "createdAt": "2025-12-27T...",
    "createdBy": "system"
  }
}
```

**Purpose:** Persistent, immutable proof of execution policy.

### 2.5 Resume-on-Reconnect

On Claude Desktop reconnect or crash recovery:

```javascript
async function resumeSession() {
  // 1. Read StateStore
  const state = await stateStore.getState();
  
  // 2. Find active missions
  const activeMissions = state.missions.filter(m => 
    m.status === 'running' || m.status === 'blocked'
  );
  
  // 3. Find last task per mission
  for (const mission of activeMissions) {
    const lastTask = getLastActiveTask(mission);
    const lastAgent = getLastActiveAgent(mission);
    
    // 4. Resume from where we left off
    if (lastAgent?.status === 'running') {
      await pollAgentStatus(lastAgent.id);
    } else if (lastTask?.status === 'ready') {
      await delegateTask(lastTask);
    }
  }
  
  // 5. NEVER restart from scratch
}
```

### 2.6 Claude Desktop Demotion

**Allowed tools for Claude Desktop:**

| Category | Tools | Purpose |
|----------|-------|---------|
| Mission | `mission.create`, `mission.get`, `mission.list`, `mission.update_status` | Control plane |
| Approval | `approval.request`, `approval.decide`, `approval.list_pending` | Human gates |
| State | `state.get_snapshot`, `state.get_mission_summary`, `state.is_armed` | Visibility |
| Agent | `agent.spawn_agent`, `agent.spawn_agent_immediate`, `agent.get`, `agent.list` | Delegation only |

**Forbidden for Claude Desktop:**

| Action | Why |
|--------|-----|
| Inline code generation | Must delegate to Claude Code |
| Direct file writes | Must delegate to Claude Code |
| Command execution | Must delegate to Claude Code |
| Artifact creation (code type) | Must come from Claude Code |

### 2.7 Inline Failure = Persisted Violation

If Claude Desktop attempts inline execution:

```javascript
async function handleExecutionViolation(attempt) {
  // 1. Create violation artifact (immutable)
  await stateStore.createArtifact({
    type: 'execution_violation',
    missionId: attempt.missionId,
    payload: {
      attemptedAction: attempt.action,
      attemptedBy: 'DESKTOP',
      requiredAuthority: 'CLAUDE_CODE',
      timestamp: new Date().toISOString(),
      blocked: true
    }
  });
  
  // 2. Abort the task
  await stateStore.updateTask(attempt.taskId, {
    status: 'blocked',
    blockedReason: 'EXECUTION_VIOLATION: Delegation required'
  });
  
  // 3. Wait for proper delegation
  return {
    error: 'EXECUTION_VIOLATION',
    message: 'Use spawn_agent or spawn_agent_immediate',
    blocked: true
  };
}
```

### What NOT to Add in V8

| Do NOT Add | Reason |
|------------|--------|
| New services | V7 services are complete |
| New watchdogs | V7 watchdogs are complete |
| More MCP tools | 70+ tools is enough |
| Mobile UI | Move to V9 |
| Model registry | Move to V9 |
| Design system | Move to V9 |
| CSS extraction | Move to V9 |

**V8 is surgical. One purpose: enforce execution authority.**

### V8 Implementation Checklist

- [ ] Add `executionAuthority` to mission schema
- [ ] Add `executionMode` to mission schema
- [ ] Add `mission_bootstrap` artifact type
- [ ] Add `execution_violation` artifact type
- [ ] Implement delegation gate in MCP router
- [ ] Implement resume-on-reconnect in StateStore
- [ ] Restrict Claude Desktop tool access
- [ ] Add violation persistence
- [ ] Update missionValidator for new fields
- [ ] Test: Desktop inline execution blocked
- [ ] Test: Resume after crash works
- [ ] Test: Violation creates artifact

---

## 3. V8 Vision

**Mission Control becomes the ONLY interface.** No Claude Desktop for execution.

```
User → Mission Control Dashboard → Director AI → Specialist AIs/Tools → Pixel-Perfect Output
                ↓
        https://mc.vaserv.pro (mobile accessible)
```

### Key Shifts from V7

| V7 | V8 |
|----|-----|
| Claude Desktop could execute | Claude Desktop CANNOT execute |
| Delegation was optional | Delegation is MANDATORY |
| Inline code was allowed | Inline code is BLOCKED |
| Crashes lost state | Resume-on-reconnect |
| Honor system | Architectural enforcement |

---

## 3. Critical Problems to Solve

### Problem 1: Graphics Quality

**Current Issue:** Claude-generated SVGs and images look amateur, not Google-quality.

| Enhancement | Description | Priority |
|-------------|-------------|----------|
| Google Fonts Icon Library | Use Material Symbols (700+ icons) instead of generating custom SVGs | HIGH |
| Lucide/Heroicons Integration | Pre-built, professional icon sets already in React ecosystem | HIGH |
| SVG Template Library | Build `/assets/svg-templates/` folder with Google-style patterns | HIGH |
| Asset Scraper Agent | Scrape Google pages for exact SVG patterns, color values, spacing | MEDIUM |
| Figma MCP Integration | Pull assets directly from Figma designs | MEDIUM |
| Lottie Animations | Use pre-built Lottie files instead of CSS animations | LOW |

### Problem 2: Layout Replication

**Current Issue:** Claude doesn't know your existing Elementor/WPBakery layouts.

| Enhancement | Description | Priority |
|-------------|-------------|----------|
| Page Scraper Tool | MCP tool that fetches flood.doctor pages, extracts HTML structure, Tailwind-izes it | HIGH |
| Layout Schema File | Document existing layouts in JSON: sections, spacing, components | HIGH |
| Screenshot + Vision | Screenshot existing pages → Claude Vision → extract layout specs | MEDIUM |
| Component Mapper | Map WPBakery shortcodes → React components automatically | LOW |

### Problem 3: Mobile Dashboard Unusable

**Current Issue:** mc.vaserv.pro is not usable on mobile devices.

| Requirement | Description |
|-------------|-------------|
| Single-column layout | Responsive design that stacks on mobile |
| Large tap targets | Minimum 44px touch targets |
| Bottom navigation | Thumb-friendly navigation |
| Status cards | Replace tables with cards |
| Sticky actions | Approve/Reject buttons always visible |

---

## 4. Mobile UI Requirements

### Mobile Views (Required)

```
┌─────────────────────────────────────────────────────────┐
│  🟢 Mission Control Online          [Settings]          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  📄 Phase 6: selfHealingService.js              │   │
│  │  ████████████░░░░░░░░ 67%                       │   │
│  │  Running for 12 minutes                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ⚠️ NEEDS ATTENTION (1)                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Approval Required: Deploy to production        │   │
│  │  Cost estimate: $0.45                           │   │
│  │  [Approve] [Reject] [View Details]              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Recent Activity                                        │
│  • 10:45 PM - Phase 5 completed ✓                      │
│  • 10:32 PM - taskGraphService.js created              │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [Dashboard]  [Tasks]  [Approvals]  [Alerts]           │
└─────────────────────────────────────────────────────────┘
```

### UX Rules

- Single-column layouts
- Large tap targets (44px minimum)
- No hover interactions
- Explicit Approve and Reject buttons
- Sticky cost + risk summary at bottom
- PWA installable

---

## 5. Dynamic AI Model Registry

Add/remove AI models via UI without code changes.

### Model Schema

```javascript
{
  id: "model-uuid",
  name: "Claude Opus 4",
  provider: "anthropic",
  apiEndpoint: "https://api.anthropic.com/v1/messages",
  apiKeyRef: "encrypted-key-ref",
  capabilities: ["reasoning", "code", "long_context", "vision"],
  costPer1kInput: 0.015,
  costPer1kOutput: 0.075,
  maxTokens: 200000,
  rateLimit: { rpm: 50, tpm: 100000 },
  status: "active",
  lastHealthCheck: "2025-12-27T...",
  createdAt: "...",
  updatedAt: "..."
}
```

### Models Tab UI

```
┌─────────────────────────────────────────────────────────┐
│  AI MODELS                               [+ Add Model]  │
├─────────────────────────────────────────────────────────┤
│  Model              │ Provider  │ Capabilities │ Status │
│  ───────────────────┼───────────┼──────────────┼────────│
│  Claude Opus 4      │ Anthropic │ reason,code  │ ● Active│
│  Claude Sonnet 4    │ Anthropic │ reason,code  │ ● Active│
│  GPT-5.2            │ OpenAI    │ reason,vision│ ● Active│
│  Gemini 2 Flash     │ Google    │ reason,fast  │ ● Active│
│  Perplexity Sonar   │ Perplexity│ research     │ ● Active│
│  DALL-E 3           │ OpenAI    │ image-gen    │ ○ Ready │
│  Refract            │ Refract   │ svg-gen      │ ● Active│
├─────────────────────────────────────────────────────────┤
│  [Click model to edit API key, set rate limits, test]   │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Director AI Pattern

One AI plans and delegates, others execute.

### The Flow

```
User Input: "Create Alexandria location page"
                    │
                    ▼
┌─────────────────────────────────────────┐
│           DIRECTOR (Claude Opus)         │
│  - Understands full task                 │
│  - Creates execution plan                │
│  - Assigns sub-tasks to specialists      │
│  - Monitors progress                     │
│  - Handles failures and retries          │
│  - Assembles final output                │
└─────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┬───────────┐
        ▼           ▼           ▼           ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
   │Perplexity│ │ Ahrefs  │ │ Refract │ │ Claude  │
   │Research │ │Keywords │ │ Images  │ │  Code   │
   └─────────┘ └─────────┘ └─────────┘ └─────────┘
        │           │           │           │
        └───────────┴───────────┴───────────┘
                    │
                    ▼
            ┌─────────────┐
            │  Assembled  │
            │   Output    │
            └─────────────┘
```

### Example Director Plan

```yaml
Task: Create Alexandria VA location page

Director Plan:
  1. Research Phase (parallel):
     - Perplexity: "water damage restoration Alexandria VA local market"
     - Ahrefs: keywords for "water damage Alexandria VA"
     - SERP: current rankings and competitors
  
  2. Content Generation:
     - Claude Sonnet: Generate page content using research
       - H1, H2 structure
       - Service descriptions
       - Local references
       - FAQ section
  
  3. Image Generation (parallel):
     - Refract: Hero SVG with Alexandria landmarks + water theme
     - Refract: Service icons (extraction, drying, restoration)
  
  4. Technical Implementation:
     - Claude Code: 
       - Create page file at alexandria.flood.doctor
       - Apply Google-style layout from CSS extracts
       - Insert content and images
       - Add LocalBusiness schema
       - Add FAQ schema
       - Optimize Core Web Vitals
  
  5. Verification:
     - Lighthouse audit
     - Schema validation
     - Mobile responsive check
  
  6. Deployment (requires approval):
     - Push to staging
     - Human review
     - Push to production

Estimated Cost: $0.85
Estimated Time: 4 minutes
```

---

## 7. Design System & CSS Extraction

### CSS Scan Integration Flow

```
Google Page → Chrome + CSS Scan → JSON Extract → Mission Control → Claude Code → Pixel-Perfect Component
```

### Integration Options

| Option | Approach | Effort | Status |
|--------|----------|--------|--------|
| A | Load CSS Scan .crx in Puppeteer, automate clicks | Medium | Phase 4 |
| B | Use CSS Scan's API (if available) | Low | Research |
| C | Build custom CSS extractor mimicking CSS Scan | High | Not recommended |
| D | Export CSS Scan data manually → import to Mission Control | Immediate | Ready now |

### Option D — Immediate Workaround

1. You scan a Google page section with CSS Scan
2. Export/copy the CSS
3. Save to `/assets/css-extracts/google-hero.json`
4. Claude Code reads that file as reference

### Folder Structure

```
/assets/
├── css-extracts/
│   ├── google-ads-hero.json
│   ├── google-workspace-cards.json
│   ├── google-analytics-cta.json
│   └── flood-doctor-elementor-sections.json
├── design-system/
│   ├── tokens.js          # Colors, spacing, fonts
│   ├── icons/             # Material Symbols subset
│   └── patterns/          # Reusable SVG backgrounds
└── svg-templates/
    ├── hero-patterns/
    ├── icons/
    └── illustrations/
```

### CSS Extract Data Format

```json
{
  "source": "https://business.google.com/us/google-ads/how-ads-work/",
  "section": "hero",
  "extracted": "2025-12-26",
  "styles": {
    "container": {
      "maxWidth": "1280px",
      "padding": "80px 24px",
      "background": "#ffffff"
    },
    "heading": {
      "fontSize": "56px",
      "fontWeight": "400",
      "lineHeight": "64px",
      "fontFamily": "Google Sans, sans-serif",
      "color": "#202124"
    },
    "subheading": {
      "fontSize": "18px",
      "lineHeight": "28px",
      "color": "#5f6368",
      "maxWidth": "640px"
    },
    "cta": {
      "background": "#1a73e8",
      "borderRadius": "4px",
      "padding": "12px 24px",
      "fontSize": "14px",
      "fontWeight": "500"
    }
  },
  "tailwind": {
    "container": "max-w-7xl mx-auto py-20 px-6",
    "heading": "text-6xl font-normal leading-tight text-gray-900",
    "subheading": "text-lg leading-7 text-gray-600 max-w-2xl",
    "cta": "bg-blue-600 rounded px-6 py-3 text-sm font-medium text-white"
  }
}
```

### New MCP Tools for Design System

| Tool | Input | Output |
|------|-------|--------|
| `scrape_google_page` | Google URL | Color palette, spacing values, typography, component structure |
| `scrape_existing_page` | flood.doctor URL | Section structure, classes, layout pattern |
| `extract_css_from_page` | URL + selectors | Computed styles + Tailwind mapping |
| `validate_design_compliance` | Component file | Pass/fail against Google design specs |
| `fetch_material_icon` | Icon name | SVG code from Material Symbols |
| `generate_asset_manifest` | Page requirements | List of required icons, images, animations with sources |

### Option A — Full Automation Code

```javascript
// ops/mcp/tools/cssExtractor.js

export async function extractCSS(url, selectors) {
  // 1. Launch Chrome with CSS Scan extension
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--load-extension=/path/to/css-scan-extension`,
      `--disable-extensions-except=/path/to/css-scan-extension`
    ]
  });

  // 2. Navigate to page
  const page = await browser.newPage();
  await page.goto(url);

  // 3. For each selector, extract computed styles
  const results = {};
  for (const selector of selectors) {
    results[selector] = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return window.getComputedStyle(el);
    }, selector);
  }

  // 4. Return Tailwind-mapped values
  return mapToTailwind(results);
}
```

### Find CSS Scan Extension

```bash
ls -la ~/Library/Application\ Support/Google/Chrome/Default/Extensions/

find ~/Library/Application\ Support/Google/Chrome -name "manifest.json" -exec grep -l "CSS Scan" {} \; 2>/dev/null
```

---

## 8. Asset Pipeline

### New Services

| Service | Purpose |
|---------|---------|
| `assetManager.js` | Central registry for all icons, images, animations |
| `designTokens.js` | Google color palette, spacing scale, typography |
| `componentLibrary.js` | Pre-built Google-style components (cards, CTAs, headers) |
| `browserAgent.js` | Puppeteer with CSS Scan extension for extraction |

---

## 9. Reference Pages

### Google Business Pages (Use as Design Templates)

| URL | Use Case |
|-----|----------|
| https://business.google.com/us/google-ads/how-ads-work/ | Hero + feature sections |
| https://business.google.com/us/google-ads/campaign-budget/ | Pricing/budget layout |
| https://business.google.com/us/resources/ | Service hub card layout |
| https://business.google.com/us/support/ads-expert/ | Support/contact layout |
| https://business.google.com/us/ad-solutions/performance-max/ | Product feature page |
| https://business.google.com/us/ad-solutions/youtube-ads/ | Video integration layout |
| https://business.google.com/us/google-analytics/ | Analytics dashboard promo |
| https://workspace.google.com/ | Main product page |
| https://workspace.google.com/business/small-business/ | SMB landing page |
| https://workspace.google.com/blog/small-business/make-time-things-matter-your-small-business-using-google-workspace | Blog post template |
| https://workspace.google.com/blog/gmail | Blog article list |
| https://workspace.google.com/industries/healthcare/ | Industry vertical page |

### Existing Flood Doctor Pages (Extract Layouts)

| URL | Content |
|-----|---------|
| https://flood.doctor/ | Main site (WPBakery) |
| https://flood.doctor/google-business/ | Google Business style (Elementor) |
| https://flood.doctor/google-restaurant/ | Restaurant vertical (Elementor) |
| https://flood.doctor/google-retail/ | Retail vertical (Elementor) |
| https://flood.doctor/merchant-center/ | Merchant Center style (Elementor) |

---

## 10. Implementation Phases

### V8: Execution Authority (CURRENT PRIORITY)

**Goal:** Make delegation mandatory, inline execution impossible.

| Task | File | Priority |
|------|------|----------|
| Add `executionAuthority` to schema | `ops/state/schema.js` | CRITICAL |
| Add `executionMode` to schema | `ops/state/schema.js` | CRITICAL |
| Add `mission_bootstrap` artifact type | `ops/state/ArtifactTypes.js` | CRITICAL |
| Add `execution_violation` artifact type | `ops/state/ArtifactTypes.js` | CRITICAL |
| Implement delegation gate | `ops/mcp/mcpServer.js` | CRITICAL |
| Implement resume-on-reconnect | `ops/state/StateStore.js` | CRITICAL |
| Restrict Desktop tool access | `ops/mcp-stdio-server.js` | CRITICAL |
| Add violation persistence | `ops/state/StateStore.js` | CRITICAL |
| Update missionValidator | `ops/state/validators/missionValidator.js` | CRITICAL |

**V8 Deliverable:** Claude Desktop cannot execute, only delegate.

---

### V9: Mobile UI + UX (NEXT)

| Task | Priority |
|------|----------|
| Responsive dashboard layout | HIGH |
| Mobile navigation (bottom tabs) | HIGH |
| Touch-friendly controls | HIGH |
| PWA manifest | HIGH |
| Status cards instead of tables | MEDIUM |
| Push notifications (Ntfy) | MEDIUM |

---

### V10: Model Registry + Director

| Task | Priority |
|------|----------|
| Model CRUD API | HIGH |
| Encrypted key storage | HIGH |
| Director prompt templates | HIGH |
| Plan generation | HIGH |
| Step execution engine | MEDIUM |
| Add GPT-5.2, Gemini, etc. | MEDIUM |

---

### V11: Design System + CSS Extraction

| Task | Priority |
|------|----------|
| browserAgent.js with Puppeteer | HIGH |
| CSS Scan extension integration | HIGH |
| `extract_css_from_page` MCP tool | HIGH |
| Auto Tailwind mapper | MEDIUM |
| Design token system | MEDIUM |
| `/assets/` folder structure | MEDIUM |

---

### V12: Component Library + Deployment

| Task | Priority |
|------|----------|
| Pre-built Google-style components | HIGH |
| Asset manager | HIGH |
| Material Symbols integration | MEDIUM |
| WordPress API integration | MEDIUM |
| Staging environment | LOW |
| Visual regression testing | LOW |

---

## 11. Project Paths & Commands

### Paths

| Item | Path |
|------|------|
| Project Root | `/Users/ghost/flood-doctor/Mission-Control-APP` |
| Server Directory | `/Users/ghost/flood-doctor/Mission-Control-APP/ops` |
| Main Server | `/Users/ghost/flood-doctor/Mission-Control-APP/ops/server.js` |
| Dashboard Source | `/Users/ghost/flood-doctor/Mission-Control-APP/ops/client/` |
| State Layer | `/Users/ghost/flood-doctor/Mission-Control-APP/ops/state/` |
| Services | `/Users/ghost/flood-doctor/Mission-Control-APP/ops/services/` |
| MCP Tools | `/Users/ghost/flood-doctor/Mission-Control-APP/ops/mcp/tools/` |
| Handoffs | `/Users/ghost/flood-doctor/Mission-Control-APP/ops/handoffs/` |
| Docs | `/Users/ghost/flood-doctor/Mission-Control-APP/ops/docs/` |

### Commands

**Start Server:**
```bash
cd ~/flood-doctor/Mission-Control-APP/ops && NODE_ENV=production npm start
```

**Start Cloudflare Tunnel:**
```bash
cloudflared tunnel run --url http://localhost:3001 mission-control
```

**Remote Access:**
```
https://mc.vaserv.pro
```

**Kill Port 3001:**
```bash
lsof -ti:3001 | xargs kill -9
```

**Check V7 Status:**
```bash
cat ~/flood-doctor/Mission-Control-APP/ops/handoffs/latest.json | jq .
```

---

## 12. Non-Negotiables

### Carry Forward from V7

1. Claude Desktop is NOT the executor — Mission Control is
2. Artifacts are mandatory — no completion without proof
3. State is authoritative — StateStore is single source of truth
4. Failures block, not hide
5. Destructive actions require human approval
6. All integrations must expose health checks
7. Audit log is immutable
8. Mobile must work for approvals

### V8 Execution Authority (NEW)

9. **Execution Authority is schema-enforced** — not optional, not honor system
10. **Delegation gate is mandatory** — inline execution blocked at router level
11. **Violations are persisted** — attempted inline execution creates immutable artifact
12. **Resume-on-reconnect required** — crashes continue, never restart
13. **Claude Desktop is demoted** — control plane only, no execution
14. **Bootstrap artifact required** — every mission declares execution policy
15. **Mode lock enforced** — RECIPE_ONLY or IMMEDIATE_ONLY, no mixing

### Future (V9+)

16. Models are pluggable — add/remove without code changes
17. Director pattern mandatory — one AI plans, others execute
18. Cost visibility everywhere — know what you're spending
19. Mobile-first for critical actions
20. Recipes are shareable and versioned
21. Design tokens enforced — no amateur graphics
22. CSS extracts required for Google-style pages

---

## 13. Session Resume Instructions

### For Claude Code (V8 Build)

```
Resume Mission Control V8 build.

Read: ~/flood-doctor/Mission-Control-APP/ops/docs/Mission-Control-V8-MASTER-HANDOFF.md

V7 is COMPLETE. Start V8: Execution Authority Enforcement.

V8 SCOPE (no feature creep):
1. Add executionAuthority + executionMode to mission schema
2. Add mission_bootstrap + execution_violation artifact types
3. Implement delegation gate in MCP router
4. Implement resume-on-reconnect in StateStore
5. Restrict Claude Desktop tool access
6. Add violation persistence

DO NOT ADD:
- Mobile UI (V9)
- Model registry (V10)
- Design system (V11)
- New services
- New watchdogs

Update handoffs/latest.json when complete.
```

### For Claude Desktop (Control Plane Only)

```
EXECUTION POLICY - MANDATORY

You are a CONTROLLER, not an EXECUTOR.

ALLOWED TOOLS:
- mission.create, mission.get, mission.list, mission.update_status
- approval.request, approval.decide, approval.list_pending
- state.get_snapshot, state.get_mission_summary, state.is_armed
- agent.spawn_agent, agent.spawn_agent_immediate, agent.get, agent.list

FORBIDDEN ACTIONS:
- Inline code generation
- Direct file writes
- Command execution
- Any execution without spawn_agent

If you attempt inline execution, a violation artifact will be created
and the task will be blocked until proper delegation occurs.
```

### V8 Test Checklist

```bash
# Test 1: Verify execution authority in schema
grep -n "executionAuthority" ~/flood-doctor/Mission-Control-APP/ops/state/schema.js

# Test 2: Verify bootstrap artifact type
grep -n "mission_bootstrap" ~/flood-doctor/Mission-Control-APP/ops/state/ArtifactTypes.js

# Test 3: Verify violation artifact type
grep -n "execution_violation" ~/flood-doctor/Mission-Control-APP/ops/state/ArtifactTypes.js

# Test 4: Verify delegation gate
grep -n "delegationGate\|ExecutionViolation" ~/flood-doctor/Mission-Control-APP/ops/mcp/mcpServer.js

# Test 5: Verify resume-on-reconnect
grep -n "resumeSession\|resumeOnReconnect" ~/flood-doctor/Mission-Control-APP/ops/state/StateStore.js
```

---

## Owner

**Company:** Flood Doctor LLC  
**Owner:** Frank  
**Domain:** flood.doctor  
**Mission Control:** mc.vaserv.pro  

---

*End of V8 Master Handoff Document*
