# MISSION CONTROL V7 — BUILDER MANUAL

**Version:** 2.0 FINAL  
**Date:** December 26, 2025

This document is the **single authoritative Builder Manual** for executing Mission Control V7 upgrades in Builder Mode. It consolidates all supporting documents, guardrails, playbooks, contracts, schemas, error codes, examples, and failure scenarios into **one uploadable file**.

---

## SECTION 0 — PRECEDENCE & AUTHORITY

### Order of Authority
1. **Mission-Control-V7-FINAL-Specification.md** — Source of truth for architecture and behavior.
2. **This Builder Manual** — Operational execution rules and scaffolding.
3. Inline examples and templates — Illustrative unless explicitly marked CANONICAL.

**Conflict Rule:**  
If any instruction in this manual conflicts with the FINAL Specification, **STOP** and defer to the FINAL Specification.

---

## SECTION 1 — GUARDRAILS (ABSOLUTE)

### DO NOT MODIFY WITHOUT EXPLICIT HUMAN APPROVAL
- ops/server.js (production entrypoint)
- Any OAuth credentials or secrets
- Any .env file
- Any existing Google, Ads, GA, GSC configuration
- Any file under /client unless explicitly instructed

### HUMAN-GATED OPERATIONS
- Google Cloud project creation
- OAuth consent flows
- API key generation for third-party services
- launchctl load / unload
- Any destructive Google Admin action

---

## SECTION 2 — BUILDER MODE PRIME DIRECTIVE

Builder Mode rules are **mandatory**:

- All changes must be **atomic**
- All changes must be **reversible**
- Every completed unit of work must produce:
  - a diff
  - a clear summary
- If a task requires credentials, browser interaction, or approvals → **STOP AND REPORT**

---

## SECTION 3 — PROJECT PATHS

| Item | Path |
|------|------|
| Project Root | `/Users/ghost/flood-doctor/Mission-Control-APP` |
| Server Directory | `/Users/ghost/flood-doctor/Mission-Control-APP/ops` |
| Main Server | `/Users/ghost/flood-doctor/Mission-Control-APP/ops/server.js` |
| MCP stdio Proxy | `/Users/ghost/flood-doctor/Mission-Control-APP/ops/mcp-stdio-server.js` |
| Environment File | `/Users/ghost/flood-doctor/Mission-Control-APP/ops/.env` |
| Package JSON | `/Users/ghost/flood-doctor/Mission-Control-APP/ops/package.json` |
| Dashboard Source | `/Users/ghost/flood-doctor/Mission-Control-APP/ops/client/` |
| Dashboard Build | `/Users/ghost/flood-doctor/Mission-Control-APP/ops/client/dist/` |
| Agent Manager | `/Users/ghost/flood-doctor/Mission-Control-APP/ops/services/agentManager.js` |
| Integrations | `/Users/ghost/flood-doctor/Mission-Control-APP/ops/services/integrations/` |

### Commands

**Start Server:**
```bash
cd ~/flood-doctor/Mission-Control-APP/ops && NODE_ENV=production npm start
```

**Kill Port 3001:**
```bash
lsof -ti:3001 | xargs kill -9
```

### Environment
- Node Version: v24.11.1
- Package Manager: npm
- Server Port: 3001

---

## SECTION 4 — BUILDER PLAYBOOKS

### Playbook: Phase 1 — State Authority

**Objective:**  
Implement StateStore as the single source of truth.

**Files to Create**
- ops/state/StateStore.js
- ops/state/schema.js
- ops/state/storage/JsonStore.js
- ops/state/ArtifactTypes.js
- ops/state/validators/missionValidator.js
- ops/state/validators/artifactValidator.js
- ops/state/snapshots/ (directory)
- ops/state/audit/ (directory)

**File Creation Order**
1. Create directory structure
2. ArtifactTypes.js (no dependencies)
3. schema.js (imports ArtifactTypes)
4. storage/JsonStore.js (no dependencies)
5. validators/artifactValidator.js (imports ArtifactTypes, schema)
6. validators/missionValidator.js (imports ArtifactTypes, schema)
7. StateStore.js (imports all above)

**Success Criteria**
- All state mutations go through StateStore
- Snapshots written before irreversible or destructive actions
- No direct file writes bypassing StateStore

**Stop Conditions**
- Missing schema fields
- Any attempt to bypass validators

---

### Playbook: Phase 2 — Mission Contracts

**Objective:**  
Enforce artifact gates and tool permission matrix.

**Files to Modify**
- ops/state/validators/missionValidator.js
- ops/state/StateStore.js

**Success Criteria**
- mission.update cannot complete without required artifacts
- Destructive missions always block without approval
- Tool permission matrix defaults applied by missionClass

---

### Playbook: Phase 3 — Circuit Breaker

**Objective:**  
Implement safety limits and budget controls.

**Files to Create**
- ops/services/rateLimitService.js
- ops/services/costEstimatorService.js

**Files to Modify**
- ops/state/validators/missionValidator.js (add breaker logic)

**Success Criteria**
- Breaker trips after 3 failures
- Locked missions cannot proceed
- circuit_breaker_trip artifacts emitted
- Cost limits enforced

---

## SECTION 5 — INTERFACE CONTRACTS

### StateStore.createMission(data)

**Guarantees**
- Generates unique ID
- Sets _stateVersion = 1
- Validates against schema
- Persists via JsonStore

**Must Throw**
- ValidationError (invalid data)

---

### StateStore.updateMission(missionId, patch)

**Guarantees**
- Enforces requiredArtifacts gate on completion
- Enforces missionClass rules
- Writes snapshot before destructive or irreversible transitions
- Increments _stateVersion

**Must Throw**
- MissingArtifactError (completing without artifacts)
- CircuitBreakerError (mission locked)
- NotFoundError (invalid missionId)

---

### StateStore.createArtifact(data)

**Guarantees**
- Generates unique ID
- Validates type against ArtifactTypes
- Sets artifactMode based on type
- Records provenance

**Must Throw**
- ValidationError (invalid type or data)

---

### StateStore.createSnapshot(reason)

**Guarantees**
- Writes full state to ops/state/snapshots/
- Filename: YYYY-MM-DD_HH-mm-ss.json
- Returns snapshotId

---

## SECTION 6 — SCHEMA DEFINITIONS

### Mission

```javascript
{
  id: string,                    // "mission-{timestamp}-{random}"
  name: string,
  description: string,
  missionClass: "exploration" | "implementation" | "maintenance" | "destructive" | "continuous",
  status: "queued" | "running" | "blocked" | "needs_review" | "complete" | "failed" | "locked",
  blockedReason: string | null,
  requiredArtifacts: string[],
  verification: { checks: string[] },
  riskLevel: "low" | "medium" | "high",
  allowedTools: string[] | null,
  completionGate: "artifacts",
  maxEstimatedCost: number | null,
  maxCostPerHour: number | null,
  triggerSource: "manual" | "watchdog" | "scheduled",
  tasks: string[],
  artifacts: string[],
  _stateVersion: number,
  _lastSnapshotAt: string,
  createdAt: string,
  updatedAt: string,
  completedAt: string | null
}
```

### Task

```javascript
{
  id: string,
  missionId: string,
  title: string,
  description: string,
  taskType: "work" | "verification" | "finalization",
  status: "pending" | "ready" | "running" | "complete" | "failed" | "blocked",
  deps: string[],
  requiredArtifacts: string[],
  assignedAgent: string | null,
  _stateVersion: number,
  createdAt: string,
  updatedAt: string
}
```

### Artifact

```javascript
{
  id: string,
  missionId: string,
  taskId: string | null,
  type: string,
  artifactMode: "immutable" | "append-only",
  label: string,
  payload: object | null,
  files: string[],
  provenance: {
    producer: "agent" | "watchdog" | "system" | "human",
    agentId: string | null,
    worktree: string | null,
    commitHash: string | null
  },
  createdAt: string
}
```

### CircuitBreakerState

```javascript
{
  missionId: string,
  failureCount: number,
  immediateExecCount: number,
  tripped: boolean,
  trippedAt: string | null,
  trippedReason: string | null,
  lockedUntil: string | null
}
```

---

## SECTION 7 — ERROR CODES

| Code | Message | When |
|------|---------|------|
| VALIDATION_ERROR | Field validation failed | Invalid input |
| NOT_FOUND | Resource not found | Invalid ID |
| COMPLETION_BLOCKED | Missing required artifacts | Artifact gate |
| CIRCUIT_BREAKER_TRIPPED | Mission locked | Breaker active |
| COST_LIMIT_EXCEEDED | Over budget | Cost gate |
| ARMED_MODE_REQUIRED | Needs armed mode | Wrong mode |
| DEPENDENCY_NOT_MET | Task deps pending | Task gate |
| TOOL_NOT_ALLOWED | Permission denied | Tool gate |
| NOT_CONFIGURED | Missing credentials | No API key |
| RATE_LIMITED | Provider throttled | 429 response |
| DESTRUCTIVE_BLOCKED | Needs approval | Destructive gate |

---

## SECTION 8 — CANONICAL ARTIFACT EXAMPLES

### approval_record (CANONICAL)
```json
{
  "id": "artifact-1735123456804-apr1",
  "missionId": "mission-1735123456789-xyz",
  "type": "approval_record",
  "artifactMode": "immutable",
  "label": "Approval: Self-heal fix",
  "payload": {
    "targetType": "self_heal",
    "targetId": "artifact-1735123456803-heal1",
    "decision": "approve",
    "approvedBy": "human",
    "reason": "Reviewed diff and cost estimate",
    "timestamp": "2025-12-26T14:44:00.000Z"
  },
  "provenance": { "producer": "system" },
  "createdAt": "2025-12-26T14:44:00.000Z"
}
```

### circuit_breaker_trip (CANONICAL)
```json
{
  "id": "artifact-1735123456807-cb1",
  "missionId": "mission-1735123456789-xyz",
  "type": "circuit_breaker_trip",
  "artifactMode": "immutable",
  "label": "Circuit breaker tripped",
  "payload": {
    "reason": "MAX_FAILURES_EXCEEDED",
    "failureCount": 3,
    "maxFailures": 3,
    "trippedAt": "2025-12-26T15:00:00.000Z",
    "requiredAction": "Human approval via approval.record"
  },
  "provenance": { "producer": "system" },
  "createdAt": "2025-12-26T15:00:00.000Z"
}
```

### signal_report (CANONICAL)
```json
{
  "id": "artifact-1735123456806-sig1",
  "missionId": "mission-1735123456810-mnt",
  "type": "signal_report",
  "artifactMode": "immutable",
  "label": "Signal: GSC traffic drop",
  "payload": {
    "source": "gsc",
    "metric": "clicks",
    "value": 850,
    "previousValue": 1000,
    "delta": "-15%",
    "threshold": "-10%",
    "window": "7d",
    "triggered": true
  },
  "provenance": { "producer": "watchdog" },
  "createdAt": "2025-12-26T06:00:00.000Z"
}
```

---

## SECTION 9 — FAILURE SCENARIOS

### Scenario: Runaway Agent Spawn

**Trigger**
- spawn_agent_immediate called repeatedly

**Expected Behavior**
- Circuit breaker trips after 3 immediate execs
- Mission status → locked
- circuit_breaker_trip artifact emitted

**What Must NOT Happen**
- Unlimited spawning
- Budget exhaustion
- System resource exhaustion

---

### Scenario: OAuth Token Expired

**Trigger**
- OAuth refresh token expired or revoked

**Expected Behavior**
- provider.health reports `authStatus: "expired"`
- Watchdogs skip polling (no crash)
- Missions requiring this integration move to blocked
- Dashboard shows red status indicator

**Recovery**
- Human completes OAuth re-authorization via Secrets tab
- Blocked missions can resume after approval

**What Must NOT Happen**
- Silent failures
- Repeated auth attempts causing rate limits
- Missions completing without required data

---

### Scenario: Circuit Breaker Budget Exceeded

**Trigger**
- Estimated or actual cost exceeds maxEstimatedCost

**Expected Behavior**
- spawn_agent_immediate blocked before execution
- Mission status → blocked
- cost_estimate + circuit_breaker_trip artifacts emitted
- Approval queue shows pending budget approval

**Recovery**
- Human increases budget or approves override

**What Must NOT Happen**
- Execution proceeding despite budget block
- Silent cost overruns
- Auto-approval of budget overrides

---

### Scenario: Watchdog Creates Duplicate Mission

**Trigger**
- Watchdog attempts to create duplicate mission for same signal

**Expected Behavior**
- Idempotency key detected
- Duplicate suppressed
- Log entry created
- No new mission spawned

**What Must NOT Happen**
- Multiple identical missions running in parallel
- Resource waste
- Conflicting fixes applied

---

## SECTION 10 — DEPENDENCY MAP

### Load Order

```
1. State Layer (no dependencies)
   ├── ArtifactTypes.js
   ├── schema.js
   ├── storage/JsonStore.js
   ├── validators/artifactValidator.js
   ├── validators/missionValidator.js
   └── StateStore.js

2. Core Services (depends on State)
   ├── rateLimitService.js
   ├── costEstimatorService.js
   ├── approvalPolicyService.js
   └── taskGraphService.js

3. Agent Services (depends on State + Core)
   ├── agentManager.js
   └── selfHealingService.js

4. Integration Services (depends on State + RateLimit)
   └── integrations/*.js

5. Watchdog Services (depends on State + Integrations)
   ├── watchdogService.js
   └── rankingWatchdogService.js

6. MCP Tools (depends on all services)
   └── tools/*.tools.js

7. MCP Server (depends on Tools)
   └── mcpServer.js

8. HTTP Server (depends on everything)
   └── server.js
```

### Circular Dependency Prevention

**Rules:**
1. State layer imports nothing from services
2. Services import from state, never from tools
3. Tools import from services and state
4. MCP server imports from tools only
5. HTTP server is the only entry point that imports everything

---

## SECTION 11 — CODE TEMPLATES

### Service Template

```javascript
// ops/services/exampleService.js
import { StateStore } from '../state/StateStore.js';
import { ArtifactTypes } from '../state/ArtifactTypes.js';

class ExampleService {
  constructor(stateStore) {
    this.stateStore = stateStore || new StateStore();
  }

  async doSomething(param, options = {}) {
    if (!param) throw new Error('param is required');
    // Implementation
    return { success: true };
  }

  async healthCheck() {
    return { service: 'ExampleService', status: 'ok' };
  }
}

export { ExampleService };
export default ExampleService;
```

### Validator Template

```javascript
// ops/state/validators/exampleValidator.js
export function validateExample(data) {
  const errors = [];
  
  if (!data.id) errors.push('id is required');
  if (!data.name) errors.push('name is required');
  
  return { valid: errors.length === 0, errors };
}
```

### MCP Tool Template

```javascript
// ops/mcp/tools/example.tools.js
import { StateStore } from '../../state/StateStore.js';

const stateStore = new StateStore();

export const exampleTools = {
  'example.create': {
    description: 'Create example resource',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name']
    },
    handler: async (args) => {
      try {
        const result = await stateStore.createExample(args);
        return { success: true, id: result.id };
      } catch (error) {
        return { success: false, error: error.code, message: error.message };
      }
    }
  }
};
```

---

## SECTION 12 — HANDOFF & STOP CHECKLIST

Before stopping, Builder Mode must output:

1. **Completed components list**
2. **Files modified or created**
3. **Diffs ready for review**
4. **Explicit list of human-required actions:**
   - OAuth setup
   - API key entry
   - launchctl load
   - Google Cloud project creation

---

## SECTION 13 — INTEGRATION HEALTH TEMPLATE

Every integration service must implement:

```javascript
async healthCheck() {
  if (!this.isConfigured()) {
    return {
      provider: 'example',
      authStatus: 'missing',
      scopesDetected: [],
      lastSuccessfulCall: null,
      rateLimitStatus: 'ok',
      quotaRemaining: null,
      checkedAt: new Date().toISOString()
    };
  }
  
  // Check auth validity
  return {
    provider: 'example',
    authStatus: 'valid',
    scopesDetected: ['read', 'write'],
    lastSuccessfulCall: this.lastSuccessfulCall,
    rateLimitStatus: this.rateLimitStatus,
    quotaRemaining: this.quotaRemaining,
    checkedAt: new Date().toISOString()
  };
}
```

---

## FINAL RULE

If at any point you are unsure whether an action is allowed:

**STOP. DO NOT GUESS. REQUEST HUMAN INPUT.**

---

*End of Builder Manual*
