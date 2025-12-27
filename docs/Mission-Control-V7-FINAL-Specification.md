# Mission Control V7 — FINAL Specification

**Version:** 4.0 FINAL  
**Date:** December 26, 2025  

---

## Table of Contents

1. State Authority
2. Mission Contracts
3. Artifact Normalization
4. Hybrid Execution Model
5. Task Graph with Dependencies
6. Self-Healing Proposals
7. Watchdog & Autonomous Triggers
8. Circuit Breaker
9. Policy-Based Auto-Approval
10. Agent Heartbeat System
11. Server Persistence
12. Security Hardening
13. SEO & Ads Sovereignty Module
14. Google Admin Sovereignty
15. Cost Estimator
16. Rate Limits & Quotas
17. Integration Health & Connection Tests
18. Immutable Audit Log
19. Dashboard UI Requirements
20. Visualizations
21. Mobile Pager View
22. MCP Tools — Final List
23. Folder Structure
24. Implementation Order
25. Non-Negotiables

---

## 1. State Authority

**Problem:** State scattered across sockets, files, memory.

**Solution:** StateStore as single source of truth.

**Components:**
- ops/state/StateStore.js — Central authority
- ops/state/schema.js — Mission, Task, Agent, Artifact schemas
- ops/state/storage/JsonStore.js — JSON persistence (SQLite later)
- ops/state/ArtifactTypes.js — Artifact type constants
- ops/state/validators/missionValidator.js — Contract enforcement
- ops/state/validators/artifactValidator.js — Artifact validation

**Rule:** MCP handlers call StateStore. No random file writes.

### 1.1 State Versioning & Snapshots

**Required fields on all top-level state objects:**
- _stateVersion: number
- _lastSnapshotAt: ISOString

**Snapshot rule:** Before any of these operations, StateStore writes snapshot to ops/state/snapshots/YYYY-MM-DD_HH-mm-ss.json:
- spawn_agent_immediate
- Self-heal application
- mission.complete
- Any destructive Google Admin action

---

## 2. Mission Contracts

**Required Contract Fields:**
- requiredArtifacts: string[]
- verification.checks: string[]
- riskLevel: low / medium / high
- allowedTools: string[]
- completionGate: "artifacts"
- missionClass: see below
- maxEstimatedCost: number (optional)
- maxCostPerHour: number (optional)

### 2.1 Mission Class

- exploration — Tolerates missing artifacts
- implementation — Standard artifact gates
- maintenance — Standard gates
- destructive — Never auto-complete, human approval required
- continuous — Long-running, no single completion

**Mission Statuses:** queued → running → blocked → needs_review → complete → failed → locked

### 2.2 Tool Permission Matrix (Defaults by missionClass)

| missionClass | Default allowedTools |
|--------------|---------------------|
| exploration | Read-only tools only (*.list, *.get, ranking.*, gsc.inspect_url) |
| implementation | Read + non-destructive write (spawn_agent, task.*, mission.*, artifact.*) |
| maintenance | Read + non-destructive write + approval-gated writes |
| destructive | All tools including destructive, but never auto-approve |
| continuous | Watchdog, logging, reporting only (signal_report, append_log, ranking.*) |

**Rule:** Explicit allowedTools in mission contract override defaults.

---

## 3. Artifact Normalization

**Artifact Object Structure:**
id, missionId, taskId, type, label, payload, files, provenance, createdAt, artifactMode

**Provenance:** producer, worktree, commitHash, agentId

### 3.1 Artifact Mutability

- immutable — Cannot modify after creation (git_diff, agent_recipe, verification_report)
- append-only — Can add content, never overwrite (runtime_log, build_log)

### 3.2 Core Artifact Types

git_diff, git_commit, build_log, runtime_log, lighthouse_report, console_errors, screenshot_desktop, screenshot_mobile

### 3.3 Autonomy/Safety Artifact Types

plan, verification_report, failure_report, self_heal_proposal, approval_record, agent_recipe, exit_status, signal_report, circuit_breaker_trip, policy_match_report, pre_flight_snapshot, change_plan, cost_estimate, rate_limit_event

### 3.4 Rankings Artifact Types

visibility_map, local_pack_snapshot, organic_serp_snapshot, rank_delta_report, scan_metadata, competitor_analysis

---

## 4. Hybrid Execution Model

| Tool | Behavior | When Available |
|------|----------|----------------|
| spawn_agent | Returns recipe only | Always |
| spawn_agent_immediate | Executes immediately | Armed mode only |

**Default (Recipe Mode):**
1. spawn_agent returns recipe
2. Claude Desktop executes
3. Claude Desktop reports artifacts
4. Mission Control enforces contracts

**Armed Mode:**
1. spawn_agent_immediate checks gates
2. If pass, executes immediately
3. Still produces all artifacts
4. Failure → blocked + reason artifact

**Hard Gates for spawn_agent_immediate:**
- armedMode === true
- riskLevel ≤ threshold
- allowedTools includes tool
- requiredArtifacts defined
- Rollback strategy present
- Cost estimate within budget

### 4.1 Cooldown & Rate Limits

- Per-mission cooldown: 60 seconds after each immediate exec
- Max immediate execs: 3 per mission
- Max spawns per hour: 10 global

**Enforced in StateStore, not UI.**

---

## 5. Task Graph with Dependencies

**Task Structure:** id, title, status, deps[], requiredArtifacts[], taskType

**Task Statuses:** pending → ready → running → complete → failed → blocked

**Enforcement:**
- Task cannot start if any dep not complete
- task.update status=complete enforces requiredArtifacts

### 5.1 Task Types

- work — Standard task
- verification — Cannot have dependents
- finalization — Must complete before mission completes

---

## 6. Self-Healing Proposals

**Stage 1 — Generate Proposal:**
- failure_report artifact
- self_heal_proposal artifact with: diagnosis, proposed commands, files touched, risk rating, rollback plan

**Stage 2 — Apply or Block:**
- If armedMode=true AND risk ≤ medium: auto-enqueue fix
- Else: mission → needs_review

### 6.1 Idempotency Keys

**Field:** selfHealKey: hash(failure_signature)

**Rules:**
- If proposal with same key exists and applied, block duplicate
- Surface as "previously attempted fix"

---

## 7. Watchdog & Autonomous Triggers

**Purpose:** Create missions without human initiation.

**Service:** ops/services/watchdogService.js

**Triggers:**
- Cron-based polling
- File watchers
- Integration polling (GSC, GA4, Ads, LSA, SERP)

**Watchdog May:**
- Observe signals
- Create missions with predefined contracts
- Attach signal_report artifacts

**Watchdog Must NOT:**
- Execute fixes
- Spawn agents
- Bypass contracts
- Call destructive tools

### 7.1 Example Triggers

- Local pack average drops across grid
- Organic rank loss for primary keyword set
- Google Ads spend spikes with ROAS drop
- GA4 conversion events decline
- GSC clicks drop > 10% over 7 days
- Error logs grow abnormally fast

### 7.2 Watchdog Configuration (UI-Driven)

Each watchdog includes:
- Name
- Signal source (GSC, GA4, Ads, filesystem, logs, SERP)
- Threshold
- Poll interval
- Mission template to spawn
- Enabled/disabled toggle

---

## 8. Circuit Breaker

**Purpose:** Prevent runaway loops, budget burns, system damage.

**Location:** ops/state/validators/missionValidator.js

### 8.1 Mission-Level Limits

- maxFailuresPerMission (3) → Mission locked
- maxImmediateExecsPerMission (3) → Block further immediate
- cooldownAfterFailure (60s) → Delay next attempt

### 8.2 Time-Window Limits

- maxSpawnPerHour (10)
- maxArtifactsPerHour (100)
- maxStateMutationsPerHour (500)

### 8.3 Budget Limits

- Cost estimate exceeds mission maxEstimatedCost → Block
- Hourly spend exceeds maxCostPerHour → Block

### 8.4 Enforcement

- Transition mission → locked
- Require human unlock via approval.record
- Log circuit_breaker_trip artifact
- Lives below tools — no MCP tool can bypass

---

## 9. Policy-Based Auto-Approval

**Purpose:** Approve safe fixes without human intervention.

**Service:** ops/services/approvalPolicyService.js

### 9.1 Auto-Approve Conditions (Path-Based)

- Files only in /logs/ or /temp/ → Auto-approve
- Files only in /cache/ → Auto-approve
- All other paths → Require review

### 9.2 Requirements

- Auto-approved actions must create approval_record + policy_match_report
- Auto-approval is revocable: if fix causes later failure, block that policy class until human reset

---

## 10. Agent Heartbeat System

**Thresholds:**
- Heartbeat received (every N sec) → Mark alive
- No heartbeat 2×N → Mark stale
- No heartbeat 5×N → Mark dead, trigger recovery

**Responsibility:**
- Claude Desktop agents send heartbeats via agent.report_status
- Server-side immediate agents also send heartbeats
- Mission Control never assumes liveness without heartbeat

---

## 11. Server Persistence (launchd)

**Files:**
- ~/Library/LaunchAgents/com.flooddoctor.missioncontrol.plist
- ops/scripts/check-and-start-server.sh
- ops/logs/server.out.log, server.err.log

**Behavior:**
- RunAtLoad — starts on boot
- KeepAlive — restarts on crash
- ThrottleInterval: 30 — prevents restart storms

---

## 12. Security Hardening

- Bind to localhost: server.listen(3001, '127.0.0.1')
- CORS whitelist: localhost and 127.0.0.1 only
- Tool allowlists: Enforced at MCP router, not tool handler

---

## 13. SEO & Ads Sovereignty Module

### 13.1 Rankings Sovereignty

**Problem:** Google APIs don't expose competitor rankings or true local pack visibility.

**Solution:** SERP Intelligence API + RankingWatchdog with geo-coordinated grid scans.

**Components:**
- ops/services/integrations/serpIntelligenceService.js
- ops/services/rankingWatchdogService.js
- ops/mcp/tools/ranking.tools.js

### 13.2 Location Model

Each tracked location includes:
- locationId
- label (e.g., Vienna HQ)
- center latitude/longitude
- radiusMiles (default 30)
- checkpoints array (5–10 GPS coordinates)
- keywords array
- myUrl (city landing page or subdomain)
- competitors array (domains, optional GBP IDs)
- scanCadence (daily, weekly, on-demand)

### 13.3 Grid Versioning (First-Class Entity)

Grid definitions stored in StateStore with:
- gridProfileId
- gridVersion
- checkpointsHash

**Rules:**
- Grid checkpoints must be deterministic and versioned
- Any change to grid definition increments gridVersion
- Historical scans reference gridVersion for valid comparison
- Old grid versions retained for trend analysis

### 13.4 Required Artifacts per Scan

- visibility_map
- local_pack_snapshot
- organic_serp_snapshot
- rank_delta_report
- scan_metadata (provider, params, timestamps, estimated cost, gridVersion)

### 13.5 Competitor Tracking

- Track top 10 competitors per location
- Editable competitor list via UI
- Progress visualization: your rank vs competitors over time
- Time ranges: 7 / 30 / 90 / 120 days / 12 months

### 13.6 Keyword Intelligence

- Google Trends: best-effort via approved provider or internal adapter (non-critical dependency)
- Google Keyword Planner: via Google Ads API (requires active account)
- Ahrefs keyword data as fallback
- Agents propose keyword updates based on volume + trends
- Human approval required for keyword list changes

---

## 14. Google Admin Sovereignty

### 14.1 Dual-Lane Credential Model

- Monitor Lane: Read-only scopes for Watchdogs
- Admin Lane: Write scopes, approval gated

### 14.2 Required APIs

- Search Console API
- Google Analytics Admin API
- Google Analytics Data API
- Google Ads API
- Local Services Ads endpoints

### 14.3 OAuth Scopes

- https://www.googleapis.com/auth/webmasters (GSC full)
- https://www.googleapis.com/auth/analytics.edit (GA4 edit)
- https://www.googleapis.com/auth/analytics.manage.users (GA4 admin)
- https://www.googleapis.com/auth/adwords (Keyword Planner + Ads)

### 14.4 Secrets Manager Requirements

- UI-based OAuth connect
- Encrypted refresh token storage
- Token rotation without restart
- Audit logging
- Scoped secrets (global, provider-specific, mission-specific)

### 14.5 Destructive Actions

**Definition:** Any action that deletes properties, removes access, unlinks integrations, or disables tracking.

**Requirements:**
- missionClass must be destructive
- Human approval required (even in armed mode)
- Pre-flight snapshot required
- Rollback plan artifact required

**Required Artifacts:**
- pre_flight_snapshot
- approval_record
- change_plan
- verification_report

---

## 15. Cost Estimator

**Service:** ops/services/costEstimatorService.js

### 15.1 Cost Model Registry

Extend Models tab with:
- Price per 1K input tokens
- Price per 1K output tokens
- Minimum billing unit
- Rounding rules

### 15.2 Pre-Flight Estimator

**Inputs:** model, context token estimate, output limit, retry count, task count

**Output:**
- min cost
- max cost
- confidence score

### 15.3 Where It Appears

- Approval Queue
- spawn_agent_immediate confirmation
- High-risk mission creation
- Mobile approval view (sticky footer)

### 15.4 Safety Integration

Optional mission contract fields:
- maxEstimatedCost
- maxCostPerHour

If exceeded: auto-block, require explicit approval.

---

## 16. Rate Limits & Quotas

**Purpose:** Prevent API bans and rate-limit lockouts.

**Service:** ops/services/rateLimitService.js

### 16.1 Per-Provider Limits

| Provider | QPS Limit | Daily Quota |
|----------|-----------|-------------|
| SERP API | 1 req/sec | 1000/day |
| GSC API | 5 req/sec | 25000/day |
| GA4 API | 10 req/sec | 50000/day |
| Google Ads | 1 req/sec | 15000/day |
| Ahrefs | 1 req/sec | per plan |
| Perplexity | 1 req/sec | per plan |

### 16.2 Backoff & Retry Policy

- On 429 response: exponential backoff (1s, 2s, 4s, 8s, max 60s)
- Max retries: 3
- After max retries: log rate_limit_event artifact, pause provider for cooldown period

### 16.3 Quota Tracking

- Track daily usage per provider in StateStore
- Alert at 80% quota
- Hard stop at 100% quota
- Reset at midnight UTC

### 16.4 Artifacts

- rate_limit_event: logged on any throttle or quota breach

---

## 17. Integration Health & Connection Tests

**Purpose:** Eliminate silent failures from expired tokens or misconfigured integrations.

### 17.1 Provider Health Endpoint

Every integration must expose: provider.health

**Returns:**
- authStatus: valid / expired / missing
- scopesDetected: string[]
- lastSuccessfulCall: ISOString
- rateLimitStatus: ok / warning / exceeded
- quotaRemaining: number (if available)

### 17.2 Implementation

Each service in ops/services/integrations/ implements:
- healthCheck() method
- Called on dashboard load
- Called before watchdog polls
- Called on manual "Test Connection" button

### 17.3 UI Display

Secrets tab shows per-provider:
- Connection status indicator (green/yellow/red)
- Last successful call timestamp
- Scopes granted
- "Test Connection" button

---

## 18. Immutable Audit Log

**Purpose:** Append-only record of all destructive actions and approvals.

**Location:** ops/state/audit/

### 18.1 What Gets Logged

- Every destructive tool call
- Every approval (human or policy-based)
- Every armed mode toggle
- Every circuit breaker trip/unlock

### 18.2 Audit Record Structure

- timestamp: ISOString
- action: string (tool name or event type)
- actor: string (user, policy, or system)
- approvedBy: string (if applicable)
- paramsHash: string
- beforeSnapshotId: string
- resultArtifactId: string
- outcome: success / failure / blocked

### 18.3 Rules

- Append-only: records cannot be modified or deleted
- Separate from artifacts: audit log is not an artifact type
- Retained indefinitely
- Exportable for compliance

---

## 19. Dashboard UI Requirements

### 19.1 Required Tabs

- Dashboard (overview)
- Missions
- Tasks
- Models
- Secrets
- Rankings
- Approvals
- Safety
- Worktrees
- Watchdogs
- Server
- Artifacts
- Audit Log

### 19.2 Models Tab

- Add/edit/disable models via API key
- Capability tags: reasoning, code, vision, long_context, cheap, fast
- Cost per token display
- Task-level model selection (Auto default, explicit override)

### 19.3 Secrets Tab

- Add secret (API key, token)
- Masked display
- Enable/disable
- Scope: global, provider-specific, mission-specific
- Encrypted at rest, never in .env
- Connection status indicator per provider
- "Test Connection" button
- Last successful call timestamp

### 19.4 Server Tab

- Start/stop/restart controls
- Uptime, memory, port bindings
- Last crash reason
- Status indicators: Running, Restarting, Down, Degraded

### 19.5 Worktrees Tab

- Active worktrees list
- Mission/task ownership
- Branch name, dirty status, last commit
- Actions: Open in Finder, Archive, Delete, Diff, Promote

### 19.6 Mission/Task Builder

- Form-based creation (no YAML/JSON)
- Contract editor
- Trigger source: manual, watchdog, scheduled
- Drag-and-drop task dependencies
- Model selection per task

### 19.7 Approval Queue

- Pending approvals list
- Side-by-side diff viewer (syntax highlighted)
- Cost estimate displayed
- Risk summary
- Required artifacts highlighted
- Approve/Reject buttons
- Comment log

### 19.8 Audit Log Tab

- Filterable by action type, actor, date range
- Searchable
- Export to CSV/JSON
- Links to related snapshots and artifacts

### 19.9 What NOT to Add

- No inline code editors
- No shell command boxes
- No "run arbitrary command" buttons

---

## 20. Visualizations

### 20.1 System Health Dashboard

- Server status
- Integration status (all connections with health indicators)
- Active agents count
- Circuit breaker status

### 20.2 Mission Pipeline View

Kanban-style: queued → running → review → complete → failed → locked

### 20.3 Task Progress Bars

- Per-task completion percentage
- Time estimates
- Blocked indicators

### 20.4 Agent Activity Feed

Live stream of agent actions with timestamps

### 20.5 SEO Visualizations

- Traffic sparklines: 7 / 30 / 90 / 120 days / 12 months
- Lighthouse scores cards
- Core Web Vitals gauges
- Keyword rankings table with trend arrows
- Competitor comparison graphs (your rank vs top 10)
- Local pack visibility heatmap (grid view)
- City-specific subdomain performance

### 20.6 Cost Tracker

- API spend by model
- Spend by mission
- Spend over time (daily/weekly/monthly)

### 20.7 Failure Heatmap

Where/when things break most often

### 20.8 Artifact Timeline

Visual history of artifacts with filtering

### 20.9 Rate Limit Dashboard

- Per-provider usage vs quota
- Throttle events timeline
- Quota reset countdown

---

## 21. Mobile Pager View

**Purpose:** Approve and monitor from phone.

### 21.1 Mobile-First Views (Required)

- Approval Queue
- Circuit Breaker Status
- Active Mission Summary
- Diff Viewer (read-only)
- Approve/Reject actions

### 21.2 UX Rules

- Single-column layouts
- Large tap targets
- No hover interactions
- Explicit Approve and Reject buttons
- Sticky cost + risk summary at bottom

### 21.3 Security

- Optional re-auth on mobile approve
- Biometric confirmation if supported

---

## 22. MCP Tools — Final List

### Governance

tools/list, tools/call, mission.create, mission.update, mission.get_status, mission.append_log, mission.submit_artifact

### Task Graph

task.create, task.update, task.list

### Agent

spawn_agent, spawn_agent_immediate, agent.report_status, agent.submit_diff, agent.submit_build_log

### Safety & Cost

safety.set_armed_mode, safety.get_status, approval.record, cost.estimate_task, circuit.status, circuit.unlock

### Server

server.ensure_running, server.health, server.restart

### Diagnostics

state.export_snapshot, integrations.status_overview

### Rankings

ranking.scan_radius, ranking.analyze_competitor, ranking.get_visibility_map, ranking.compare_periods

### Search Console

gsc.list_properties, gsc.create_property, gsc.delete_property (Destructive), gsc.inspect_url, gsc.submit_sitemap, gsc.health

### GA4

ga4.list_accounts, ga4.list_properties, ga4.create_property, ga4.create_stream, ga4.update_stream, ga4.delete_property (Destructive), ga4.create_link_gsc, ga4.health

### Ads & LSA

ads.get_performance, ads.toggle_campaign, ads.adjust_budget, ads.set_bid_strategy, ads.health, lsa.get_performance, lsa.toggle_campaign, lsa.health

### Integration Health

provider.health (per provider)

---

## 23. Folder Structure

```
ops/
  mcp/
    mcpServer.js
    transport/
      sse.js
      jsonrpc.js
    tools/
      mission.tools.js
      task.tools.js
      agent.tools.js
      artifact.tools.js
      safety.tools.js
      server.tools.js
      ranking.tools.js
      gsc.tools.js
      ga4.tools.js
      ads.tools.js
      integrations.tools.js
  state/
    StateStore.js
    schema.js
    ArtifactTypes.js
    storage/
      JsonStore.js
    validators/
      missionValidator.js
      artifactValidator.js
    snapshots/
    audit/
  services/
    taskGraphService.js
    selfHealingService.js
    watchdogService.js
    rankingWatchdogService.js
    approvalPolicyService.js
    costEstimatorService.js
    rateLimitService.js
    agentManager.js
    integrations/
      serpIntelligenceService.js
      gscService.js
      ga4Service.js
      adsService.js
      lsaService.js
      perplexityService.js
      ahrefsService.js
      trendsService.js
      keywordPlannerService.js
  scripts/
    check-and-start-server.sh
  logs/
  client/
```

---

## 24. Implementation Order

| Phase | Components | Priority |
|-------|------------|----------|
| 1 | StateStore, JsonStore, schemas, validators, snapshots | Critical |
| 2 | Secrets Manager, OAuth flows, connection tests | Critical |
| 3 | launchd persistence, health endpoint | Critical |
| 4 | Mission contracts, artifact gates, mission class, tool permission matrix | Critical |
| 5 | Circuit Breaker + Cost Estimator + Rate Limit Service | Critical |
| 6 | Immutable Audit Log | Critical |
| 7 | spawn_agent (recipe), spawn_agent_immediate (armed) | High |
| 8 | Task graph with dependencies, task types | High |
| 9 | Self-healing with idempotency | High |
| 10 | Watchdog service | High |
| 11 | SERP API + RankingWatchdog + Grid Versioning | High |
| 12 | Google Admin tools (GSC, GA4, Ads, LSA) | High |
| 13 | Policy-based auto-approval | Medium |
| 14 | Agent heartbeat system | Medium |
| 15 | Security hardening | Medium |
| 16 | Dashboard UI (all tabs) | Medium |
| 17 | Visualizations | Medium |
| 18 | Mobile Pager view | Medium |
| 19 | Diff viewer | Medium |

---

## 25. Non-Negotiables

1. Claude Desktop is Operator — default path is recipe-only
2. Artifacts are mandatory — no completion without proof
3. Two tools, not flags — spawn_agent vs spawn_agent_immediate
4. State is authoritative — StateStore is single source of truth
5. Failures block, not hide — blocked status + reason artifact
6. Provenance on everything — who produced it, where, when
7. Autonomous initiation required — system must create missions from signals without human input
8. Autonomy must be self-limiting — circuit breakers and policy gates mandatory for all execution paths
9. Destructive actions require human approval — even in armed mode
10. Approvals must be possible without terminal, even from mobile
11. All integrations must expose health checks — silent failures are not acceptable
12. Audit log is immutable — destructive actions and approvals are permanently recorded

---

*End of FINAL Specification*
