# Mission Control Enhancement Plan

> **Status**: Research Complete | Implementation: NOT STARTED
> **Created**: 2026-01-05
> **Purpose**: Transform Mission Control from SEO monitoring tool to full-stack website development and multi-domain blog network orchestration platform

---

## Executive Summary

Mission Control currently excels at SEO auditing and AI research orchestration. This plan extends it to:

1. **Website Development Hub** — Project scaffolding, component library, deployment automation
2. **Enhanced SEO Intelligence** — Competitor tracking, content gap analysis, ranking forecasts
3. **Unified AI Layer** — Model routing, prompt engineering, cost optimization
4. **Blog Network Engine** — Multi-domain publishing, content syndication, interlinking strategy

---

## Part 1: Website Design & Development Projects

### Current State
- Project definitions in `/ops/state/projects.json` (basic metadata only)
- No design system management
- No component scaffolding
- No deployment automation

### Proposed Enhancements

#### 1.1 Project Workspace Manager
**Purpose**: Each project gets a dedicated workspace with templates, assets, and CI/CD.

```
/projects/{projectId}/
├── designs/                 # Figma exports, wireframes
├── components/              # Reusable React components
├── pages/                   # Page templates
├── assets/                  # Images, fonts, icons
├── config/
│   ├── theme.json          # Colors, fonts, spacing
│   ├── seo-defaults.json   # Default meta, schema
│   └── deploy.json         # Vercel/Cloudflare config
└── .generated/             # AI-generated content staging
```

**New Service**: `workspaceService.js`
- `createWorkspace(projectId, template)` — Scaffold from templates
- `syncAssets(projectId, source)` — Pull from Figma/Google Drive
- `getComponentRegistry(projectId)` — List available components
- `generatePage(projectId, pageSpec)` — AI-powered page generation

#### 1.2 Design System Integration
**Purpose**: Maintain consistent UI across all Flood Doctor properties.

**New Service**: `designSystemService.js`
- Import design tokens from Figma API
- Generate Tailwind config from tokens
- Validate component adherence to design system
- A/B test variant management

**UI Addition**: Design Lab tab
- Token browser (colors, typography, spacing)
- Component playground
- Design audit checker

#### 1.3 Deployment Automation
**Purpose**: One-click deploys with preview environments.

**Integrations to Add**:
- **Vercel API** — Deploy React/Next.js projects
- **Cloudflare Pages** — Alternative deploy target
- **GitHub Actions** — CI/CD pipeline triggers

**New Service**: `deploymentService.js`
- `createPreview(projectId, branch)` — Spin up preview URL
- `promote(previewId, environment)` — Promote preview to production
- `rollback(projectId, version)` — Instant rollback
- `getDeployHistory(projectId)` — Audit trail

---

## Part 2: SEO Research, Monitoring & Competitor Tracking

### Current State
- SEO Audit with Rank-Math Parity Scoring (16 enhancements) ✅
- Ranking Watchdog with anomaly detection ✅
- Ahrefs integration (needs Enterprise API) ⚠️
- SERP checking (needs API key) ⚠️
- Basic competitor comparison in audits

### Proposed Enhancements

#### 2.1 Competitor Intelligence Center
**Purpose**: Track competitor SEO strategies, content, and rankings in real-time.

**New Service**: `competitorIntelService.js`
```javascript
// Core methods:
- addCompetitor(projectId, domain, options)
- trackKeywords(competitorId, keywords[])
- getContentGaps(projectId)                // What competitors rank for that we don't
- getBacklinkOpportunities(projectId)      // Sites linking to competitors
- getContentVelocity(competitorId)         // Publishing frequency
- generateCompetitorReport(projectId)      // Weekly digest
```

**Data Tracked per Competitor**:
- Top 100 ranking keywords
- New/lost keywords (weekly delta)
- Content published (sitemap monitoring)
- Backlink acquisition rate
- Page speed scores
- Schema types used
- Internal linking structure

**UI Addition**: Competitor Lab tab
- Competitor dashboard with key metrics
- Keyword overlap matrix
- Content gap report with AI-generated briefs
- Backlink opportunity list
- Alert configuration

#### 2.2 SERP Feature Tracking
**Purpose**: Monitor and win featured snippets, PAA, local packs.

**New Service**: `serpFeatureService.js`
- Track which SERP features appear for target keywords
- Identify owned vs. competitor features
- Generate optimization recommendations
- Historical feature ownership tracking

**SERP Features to Track**:
- Featured snippets
- People Also Ask
- Local pack / map pack
- Image pack
- Video carousel
- Knowledge panel
- Top stories

#### 2.3 Predictive Ranking Model
**Purpose**: Forecast ranking changes based on content and backlink velocity.

**New Service**: `rankingForecastService.js`
- Analyze historical ranking data patterns
- Correlate with content updates, backlinks, competitor activity
- Generate probability scores for ranking improvements
- Alert on predicted drops before they happen

#### 2.4 Content Gap & Opportunity Engine
**Purpose**: Identify high-value content opportunities.

**New Service**: `contentOpportunityService.js`
- Analyze competitor content vs. own coverage
- Identify keyword clusters without content
- Score opportunities by traffic potential and difficulty
- Generate content briefs with AI assistance
- Queue opportunities to content calendar

---

## Part 3: AI Integration Improvements

### Current State
- Director Engine for autonomous task orchestration ✅
- Research Engine with multi-model support ✅
- Perplexity integration for web research ✅
- Claude, GPT-4, Gemini available ✅
- No unified prompt management
- No cost tracking
- No model performance comparison

### Proposed Enhancements

#### 3.1 Unified AI Gateway
**Purpose**: Single interface for all AI operations with routing, caching, and fallbacks.

**New Service**: `aiGatewayService.js`
```javascript
// Core methods:
- route(request, options)              // Smart model selection
- estimate(request)                    // Cost/latency estimation
- execute(request, options)            // Unified execution
- compare(request, models[])           // A/B test models
- getUsage(timeframe)                  // Cost reporting
```

**Features**:
- **Smart Routing**: Select model based on task type, cost, latency requirements
- **Semantic Caching**: Cache similar requests to reduce costs
- **Automatic Fallbacks**: Switch models on rate limits or errors
- **Cost Budgets**: Set daily/monthly limits per project
- **Response Quality Scoring**: Track which models perform best per task

**Routing Rules Example**:
| Task Type | Primary | Fallback | Reason |
|-----------|---------|----------|--------|
| Content generation | Claude Opus | GPT-4 | Quality |
| Quick classification | Haiku | Gemini Flash | Speed/cost |
| Web research | Perplexity | Claude + search | Accuracy |
| Code generation | Claude Sonnet | GPT-4 | Context |
| Summarization | Gemini 1.5 | Claude Haiku | Cost |

#### 3.2 Prompt Engineering Workbench
**Purpose**: Develop, test, and version prompts systematically.

**New Service**: `promptLabService.js`
- Prompt template library with variables
- A/B testing framework for prompts
- Version control for prompts
- Performance metrics per prompt
- Prompt chaining for complex workflows

**Storage Structure**:
```
/ops/state/prompts/
├── templates/
│   ├── content-brief.md
│   ├── seo-audit-summary.md
│   └── competitor-analysis.md
├── experiments/
│   └── {experimentId}.json
└── metrics/
    └── prompt-performance.json
```

**UI Addition**: Prompt Lab
- Template editor with variable highlighting
- Test runner with multiple inputs
- Comparison view for A/B results
- Usage analytics

#### 3.3 AI Agent Specialization
**Purpose**: Pre-configured agents for specific tasks.

**New Agents**:
| Agent | Purpose | Models Used |
|-------|---------|-------------|
| Content Writer | Blog posts, landing pages | Claude Opus |
| SEO Analyst | Audit interpretation, recommendations | Claude Sonnet |
| Competitor Researcher | Competitive intelligence gathering | Perplexity + Claude |
| Code Generator | Component scaffolding | Claude Sonnet |
| Data Analyst | Analytics interpretation | Gemini 1.5 Pro |

**New Service**: `agentSpecializationService.js`
- Agent personality definitions
- Task-specific system prompts
- Knowledge base injection per agent
- Cross-agent collaboration protocols

---

## Part 4: Blog Network Development

### Current State
- Cloudflare DNS management available ✅
- Content exists in uploads/ (blog posts for Flood Doctor)
- No multi-domain management
- No publishing pipeline
- No interlinking strategy
- No content distribution

### Proposed Enhancements

#### 4.1 Domain Portfolio Manager
**Purpose**: Manage all owned domains from a single interface.

**New Service**: `domainPortfolioService.js`
```javascript
// Core methods:
- addDomain(domain, config)
- getDomainHealth(domain)              // DNS, SSL, uptime
- getContentStatus(domain)             // Posts, pages, updates
- getLinkProfile(domain)               // Internal + external links
- getSEOScore(domain)                  // Aggregate SEO health
- suggestInterlinks(domain)            // AI-powered link opportunities
```

**Domain Registry Structure**:
```json
{
  "domains": [
    {
      "domain": "flood.doctor",
      "type": "primary",
      "platform": "react",
      "cloudflareZoneId": "xxx",
      "purpose": "Main brand site"
    },
    {
      "domain": "mclean.flood.doctor",
      "type": "subdomain",
      "platform": "react",
      "purpose": "Location page"
    },
    {
      "domain": "water-damage-guide.com",
      "type": "satellite",
      "platform": "wordpress",
      "purpose": "Educational blog",
      "linkTo": ["flood.doctor"]
    }
  ]
}
```

**UI Addition**: Domain Lab
- Domain health dashboard
- DNS configuration panel
- Domain grouping and tagging
- Quick actions (add DNS record, check propagation)

#### 4.2 Content Publishing Pipeline
**Purpose**: Create, schedule, and distribute content across the network.

**New Service**: `publishingPipelineService.js`
```javascript
// Core methods:
- createContent(spec)                  // AI-assisted content creation
- reviewContent(contentId)             // Quality + SEO checks
- schedulePublish(contentId, targets)  // Multi-platform scheduling
- distribute(contentId, channels)      // Syndication
- trackPerformance(contentId)          // Analytics
```

**Publishing Targets**:
- Self-hosted React sites (via deployment service)
- WordPress sites (new integration needed)
- Medium (for syndication)
- LinkedIn Articles (for B2B reach)

**New Integration**: `wordpressService.js`
- Connect via REST API or XML-RPC
- CRUD for posts, pages, categories
- Media library sync
- Plugin status checks

**Content States**:
```
DRAFT → REVIEW → APPROVED → SCHEDULED → PUBLISHED → MONITORING
                    ↓
                REVISION
```

#### 4.3 Interlinking Strategy Engine
**Purpose**: Build topical authority through strategic internal linking.

**New Service**: `interlinkingService.js`
```javascript
// Core methods:
- analyzeTopicalClusters(domains[])
- suggestInternalLinks(pageUrl)        // Within-site links
- suggestCrossLinks(pageUrl)           // Cross-domain links
- detectOrphanPages(domain)            // Pages with no links
- optimizeLinkEquity(domain)           // PageRank flow analysis
- generateLinkingReport(domains[])
```

**Linking Strategies**:
- **Pillar-Cluster**: Hub pages link to related content
- **Topic Silo**: Strict category-based linking
- **Cross-Domain PBN**: Strategic satellite site links
- **Contextual**: AI-selected anchor text

**UI Addition**: Link Lab
- Network visualization (nodes = pages, edges = links)
- Orphan page detector
- Link opportunity queue
- Anchor text optimization

#### 4.4 Content Calendar & Editorial Workflow
**Purpose**: Plan and coordinate content across the network.

**New Service**: `contentCalendarService.js`
- Visual calendar with drag-drop scheduling
- Topic clustering and gap identification
- Writer assignment and due dates
- Review/approval workflow
- Performance retrospectives

**UI Addition**: Calendar view in Content Lab
- Month/week/day views
- Kanban board for editorial workflow
- Content briefs attached to calendar items
- Integration with content opportunity engine

#### 4.5 Blog Network Analytics Dashboard
**Purpose**: Unified view of all network performance.

**Metrics Tracked**:
- Traffic per domain (GA4)
- Ranking distribution per domain
- Content velocity (posts/week)
- Internal link density
- Cross-domain referrals
- Revenue attribution (if monetized)

**UI Addition**: Network Overview dashboard
- Aggregate metrics cards
- Domain comparison charts
- Traffic flow visualization (Sankey diagram)
- Alert summary

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Domain Portfolio Service
- [ ] Cloudflare DNS management UI
- [ ] Basic WordPress integration
- [ ] AI Gateway with routing

### Phase 2: Content Engine (Week 3-4)
- [ ] Publishing Pipeline Service
- [ ] Content Calendar UI
- [ ] Editorial workflow states
- [ ] WordPress CRUD operations

### Phase 3: SEO Intelligence (Week 5-6)
- [ ] Competitor Intelligence Service
- [ ] SERP Feature Tracking
- [ ] Content Gap Engine
- [ ] Competitor Lab UI

### Phase 4: Network Optimization (Week 7-8)
- [ ] Interlinking Strategy Engine
- [ ] Cross-domain link suggestions
- [ ] Network Analytics Dashboard
- [ ] Link visualization

### Phase 5: AI Enhancement (Week 9-10)
- [ ] Prompt Engineering Workbench
- [ ] Agent Specialization
- [ ] Cost optimization
- [ ] A/B testing framework

---

## Technical Architecture

### New Services Summary

| Service | Purpose | Priority |
|---------|---------|----------|
| `domainPortfolioService.js` | Multi-domain management | P0 |
| `publishingPipelineService.js` | Content publishing workflow | P0 |
| `wordpressService.js` | WordPress API integration | P0 |
| `competitorIntelService.js` | Competitor tracking | P1 |
| `aiGatewayService.js` | Unified AI routing | P1 |
| `interlinkingService.js` | Link strategy | P1 |
| `contentCalendarService.js` | Editorial planning | P2 |
| `promptLabService.js` | Prompt engineering | P2 |
| `serpFeatureService.js` | SERP tracking | P2 |
| `rankingForecastService.js` | Predictive rankings | P3 |
| `workspaceService.js` | Project scaffolding | P3 |
| `deploymentService.js` | Deploy automation | P3 |
| `designSystemService.js` | Design tokens | P3 |

### New UI Components

| Component | Location | Priority |
|-----------|----------|----------|
| Domain Lab | Main nav | P0 |
| Content Lab (Calendar) | Main nav | P0 |
| Competitor Lab | SEO Lab sub-tab | P1 |
| Link Lab | SEO Lab sub-tab | P1 |
| Prompt Lab | AI Lab sub-tab | P2 |
| Network Dashboard | Home | P2 |

### Database Considerations
Current JSON file storage works for MVP. Consider migration to:
- **SQLite** — For complex queries, relationships
- **PostgreSQL** — For production scale
- **Redis** — For caching AI responses

### External Integrations Needed

| Integration | Purpose | API |
|-------------|---------|-----|
| WordPress REST API | Publish to WP sites | Per-site keys |
| Vercel | Deploy React sites | Team token |
| Figma | Design sync | OAuth |
| Ahrefs | Backlink data | Enterprise key |
| SerpAPI/ValueSERP | SERP features | API key |
| Medium | Syndication | Integration token |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| WordPress sites vary widely | Medium | Start with WP.com, expand to self-hosted |
| Ahrefs API expensive | High | Use free alternatives (MOZ, Majestic) for MVP |
| AI costs could spike | High | Implement cost budgets, caching |
| Complex interlinking creates spam signals | Medium | Follow natural linking patterns, limit cross-domain |
| Too many features at once | High | Strict phased rollout |

---

## Success Metrics

| Metric | Target | Timeframe |
|--------|--------|-----------|
| Domains managed | 10+ | Phase 1 |
| Content pieces published/week | 5 | Phase 2 |
| Competitor keywords tracked | 1000+ | Phase 3 |
| AI cost reduction | 30% | Phase 5 |
| Cross-domain referral traffic | +50% | Phase 4 |

---

## Appendix: Domain Portfolio Analysis

**Full inventory saved to**: `/ops/state/domain-portfolio.json`

### Portfolio Summary

| Category | Count | Purpose |
|----------|-------|---------|
| **Primary Brand** | 3 | flood.doctor, flooddoctorva.com, flooddoctor.us |
| **Water Damage Network** | 19 | Geo-targeted PBN/satellite domains |
| **Restoration Network** | 10 | General restoration + competitor domains |
| **Personal/Family** | 14 | Darakhshan family sites |
| **Other Business** | 10 | Law, StarLabs, media, orgs |
| **Total** | **50** | |

### High-Value Domains for Blog Network (P0/P1)

| Domain | Traffic | Blog Strategy |
|--------|---------|---------------|
| **flooddoctorva.com** | 48.19k | Hub - Virginia service content |
| **flood.doctor** | 13.18k | Brand hub - pillar content |
| **flood.repair** | 8.83k | Educational flood repair guides |
| **dc.contractors** | 7.29k | DC contractor directory + reviews |
| **floodrepair.org** | 7.97k | Non-profit style educational content |
| **waterdamage.cc** | 5.69k | Generic water damage how-tos |
| **vawaterdamage.com** | 5.28k | Virginia-focused local content |
| **mdwaterdamage.com** | 4.7k | Maryland-focused local content |
| **basementflood.repair** | 3.69k | Niche: basement flooding |
| **dmvwaterdamage.com** | 2.38k | DMV regional content |

### Proposed Network Structure

```
                    ┌─────────────────┐
                    │  flood.doctor   │ ◄── Brand Hub
                    │   (13.18k)      │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│flooddoctorva  │   │vawaterdamage  │   │mdwaterdamage  │
│  (48.19k)     │   │  (5.28k)      │   │  (4.7k)       │
│  Virginia Hub │   │ VA Satellite  │   │ MD Satellite  │
└───────────────┘   └───────────────┘   └───────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ flood.repair  │   │ waterdamage   │   │dc.contractors │
│  (8.83k)      │   │   .cc (5.69k) │   │  (7.29k)      │
│ Educational   │   │  How-To Blog  │   │ Directory     │
└───────────────┘   └───────────────┘   └───────────────┘
```

### Interlinking Strategy

| Link Type | Pattern | Example |
|-----------|---------|---------|
| Hub → Spoke | Footer + service links | flood.doctor → flooddoctorva.com |
| Spoke → Hub | Header logo + about | flooddoctorva.com → flood.doctor |
| Satellite → Hub | Resource + author bio | waterdamage.cc → flood.doctor |
| Cross-spoke | Local overlap only | vawaterdamage.com ↔ flooddoctorva.com |

### Risk Domains (Trademark)

These domains may have legal risk - use carefully:
- servpro.services
- servpro.claims
- servprova.com
- puroclean.services

**Recommendation**: Redirect to comparison content on main site, don't build standalone.

### Domains Needing Attention

| Domain | Issue | Action |
|--------|-------|--------|
| residentialwaterdamage.com | No traffic | Build content or redirect |
| waterdamage.cleaning | Parked | Develop or sell |
| waterdamagerestoration.cc | Parked | Develop or sell |
| 7 personal domain variants | Duplicative | Consolidate redirects |

---

## Revised Implementation Priority

### Phase 1A: Core Infrastructure (Week 1)
- [ ] Domain Portfolio Service with Cloudflare API
- [ ] Domain health dashboard UI
- [ ] DNS management from Mission Control

### Phase 1B: Content Publishing (Week 2)
- [ ] WordPress REST API integration
- [ ] Content publishing pipeline
- [ ] Basic content calendar

### Phase 2: Blog Network Launch (Weeks 3-4)
- [ ] Deploy blog templates to top 10 domains
- [ ] Interlinking engine
- [ ] AI content generation for initial posts
- [ ] Cross-domain analytics dashboard

### Phase 3: SEO Intelligence (Weeks 5-6)
- [ ] Competitor tracking for water damage keywords
- [ ] SERP feature monitoring
- [ ] Content gap analysis

---

## Part 5: Content Strategy for Blog Network

### Content Pillars by Domain Type

| Domain Type | Content Focus | Post Frequency | Word Count |
|-------------|---------------|----------------|------------|
| **Hub** (flood.doctor) | Pillar guides, company news | 2/week | 2500-4000 |
| **Spoke** (flooddoctorva) | Local case studies, service pages | 3/week | 1500-2500 |
| **Satellite** (waterdamage.cc) | How-tos, educational, informational | 5/week | 1000-2000 |
| **Niche** (basementflood.repair) | Deep-dive niche content | 2/week | 1500-2500 |

### Topic Clusters for Water Damage Network

#### Cluster 1: Emergency Response
- What to do in first 24 hours after flood
- DIY vs professional water damage restoration
- Insurance claims process guide
- Emergency water extraction methods
- Documenting damage for insurance

#### Cluster 2: Types of Water Damage
- Category 1/2/3 water damage explained
- Sewage backup cleanup
- Burst pipe damage
- Appliance leak damage
- Storm and flood damage
- Groundwater intrusion

#### Cluster 3: Restoration Process
- Water damage restoration timeline
- Drying equipment explained (dehumidifiers, air movers)
- Moisture testing and monitoring
- Mold prevention after water damage
- Structural drying techniques
- Content restoration

#### Cluster 4: Location-Specific Content
- Water damage restoration [City] VA
- Flood cleanup services [City] MD
- Emergency plumber vs restoration company
- Local building codes for water damage
- Regional flooding patterns (DMV area)

#### Cluster 5: Prevention & Maintenance
- Basement waterproofing guide
- Sump pump maintenance
- Signs of hidden water damage
- Annual home water damage inspection
- Smart water leak detectors

### Content Production Workflow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Research   │───▶│   Draft     │───▶│   Review    │───▶│  Publish    │
│  (AI+Human) │    │  (AI Gen)   │    │  (Human QA) │    │ (Automated) │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
 • Keyword gap      • Claude Opus      • Fact check       • WordPress API
 • Competitor       • Template-based   • Brand voice      • Schema markup
 • SERP analysis    • SEO optimized    • Legal review     • Internal links
 • Topic brief      • Images (DALL-E)  • E-E-A-T check    • Social share
```

### AI Content Generation Specs

**New Service**: `contentGeneratorService.js`

```javascript
// Content generation pipeline
async generatePost(spec) {
  // 1. Research phase
  const research = await this.researchTopic(spec.keyword);
  const competitors = await this.analyzeCompetitorContent(spec.keyword);
  const serpFeatures = await this.getSerpFeatures(spec.keyword);

  // 2. Brief generation
  const brief = await this.generateBrief({
    keyword: spec.keyword,
    intent: spec.searchIntent,
    targetLength: spec.wordCount,
    competitorGaps: competitors.gaps,
    featuredSnippetOpportunity: serpFeatures.hasSnippet
  });

  // 3. Draft generation
  const draft = await this.generateDraft(brief, {
    model: 'claude-opus',
    style: spec.brandVoice,
    includeSchema: true,
    optimizeFor: ['readability', 'seo', 'eeat']
  });

  // 4. Enhancement
  const enhanced = await this.enhance(draft, {
    addInternalLinks: true,
    addImages: true,
    addFAQ: serpFeatures.hasPAA,
    addTableOfContents: draft.wordCount > 1500
  });

  return enhanced;
}
```

### E-E-A-T Compliance Checklist

| Signal | Implementation |
|--------|----------------|
| **Experience** | Case study references, "we've handled X+ jobs" |
| **Expertise** | IICRC certification mentions, technical accuracy |
| **Authority** | Link to flood.doctor, author bios, citations |
| **Trust** | BBB rating, reviews, license numbers, contact info |

---

## Part 6: Technical Architecture Deep Dive

### New Database Schema (SQLite/PostgreSQL)

```sql
-- Domain management
CREATE TABLE domains (
  id TEXT PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  platform TEXT,
  cloudflare_zone_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Content management
CREATE TABLE content (
  id TEXT PRIMARY KEY,
  domain_id TEXT REFERENCES domains(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content_type TEXT DEFAULT 'post',
  status TEXT DEFAULT 'draft',
  keyword TEXT,
  word_count INTEGER,
  seo_score INTEGER,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(domain_id, slug)
);

-- Internal links tracking
CREATE TABLE internal_links (
  id TEXT PRIMARY KEY,
  source_content_id TEXT REFERENCES content(id),
  target_content_id TEXT REFERENCES content(id),
  anchor_text TEXT,
  link_type TEXT, -- contextual, navigation, footer
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cross-domain links
CREATE TABLE cross_domain_links (
  id TEXT PRIMARY KEY,
  source_domain_id TEXT REFERENCES domains(id),
  target_domain_id TEXT REFERENCES domains(id),
  source_path TEXT,
  target_path TEXT,
  anchor_text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Competitor tracking
CREATE TABLE competitors (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  name TEXT,
  category TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE competitor_rankings (
  id TEXT PRIMARY KEY,
  competitor_id TEXT REFERENCES competitors(id),
  keyword TEXT NOT NULL,
  position INTEGER,
  url TEXT,
  checked_at TIMESTAMP DEFAULT NOW()
);

-- Content calendar
CREATE TABLE calendar_items (
  id TEXT PRIMARY KEY,
  domain_id TEXT REFERENCES domains(id),
  title TEXT NOT NULL,
  keyword TEXT,
  content_type TEXT,
  assigned_to TEXT,
  due_date DATE,
  status TEXT DEFAULT 'planned',
  content_id TEXT REFERENCES content(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Architecture Expansion

```
/api/v2/
├── domains/
│   ├── GET    /                    # List all domains
│   ├── POST   /                    # Add domain
│   ├── GET    /:id                 # Get domain details
│   ├── PUT    /:id                 # Update domain
│   ├── DELETE /:id                 # Remove domain
│   ├── GET    /:id/health          # DNS, SSL, uptime check
│   ├── GET    /:id/content         # List content for domain
│   └── GET    /:id/links           # Get link profile
│
├── content/
│   ├── GET    /                    # List all content
│   ├── POST   /                    # Create content
│   ├── GET    /:id                 # Get content
│   ├── PUT    /:id                 # Update content
│   ├── DELETE /:id                 # Delete content
│   ├── POST   /:id/publish         # Publish to platform
│   ├── POST   /:id/schedule        # Schedule publish
│   └── GET    /:id/performance     # Analytics for content
│
├── content-gen/
│   ├── POST   /brief               # Generate content brief
│   ├── POST   /draft               # Generate draft from brief
│   ├── POST   /enhance             # Add links, images, schema
│   ├── POST   /optimize            # SEO optimization pass
│   └── GET    /queue               # Content generation queue
│
├── calendar/
│   ├── GET    /                    # Get calendar view
│   ├── POST   /                    # Add calendar item
│   ├── PUT    /:id                 # Update item
│   ├── DELETE /:id                 # Remove item
│   └── GET    /gaps                # Content gap opportunities
│
├── competitors/
│   ├── GET    /                    # List competitors
│   ├── POST   /                    # Add competitor
│   ├── GET    /:id                 # Get competitor detail
│   ├── GET    /:id/keywords        # Competitor keywords
│   ├── GET    /:id/content         # Competitor content
│   └── GET    /gaps                # Keyword gaps vs competitors
│
├── links/
│   ├── GET    /internal            # All internal links
│   ├── GET    /cross-domain        # Cross-domain links
│   ├── POST   /suggest             # AI link suggestions
│   ├── GET    /orphans             # Orphan pages
│   └── GET    /equity              # Link equity analysis
│
└── network/
    ├── GET    /overview            # Network-wide stats
    ├── GET    /traffic             # Aggregate traffic
    ├── GET    /rankings            # Ranking distribution
    └── GET    /health              # All domain health
```

### UI Component Architecture

```
/ops/client/src/components/
├── labs/
│   ├── DomainLab/
│   │   ├── DomainLab.tsx           # Main container
│   │   ├── DomainList.tsx          # Domain grid/table
│   │   ├── DomainDetail.tsx        # Single domain view
│   │   ├── DomainHealth.tsx        # Health metrics
│   │   ├── DNSManager.tsx          # DNS record CRUD
│   │   └── NetworkGraph.tsx        # D3 network visualization
│   │
│   ├── ContentLab/
│   │   ├── ContentLab.tsx          # Main container
│   │   ├── ContentCalendar.tsx     # Calendar view (react-big-calendar)
│   │   ├── ContentEditor.tsx       # Rich text editor
│   │   ├── ContentBriefForm.tsx    # Brief generation form
│   │   ├── ContentQueue.tsx        # Generation queue
│   │   ├── ContentList.tsx         # Content inventory
│   │   └── PublishModal.tsx        # Multi-platform publish
│   │
│   ├── CompetitorLab/
│   │   ├── CompetitorLab.tsx       # Main container
│   │   ├── CompetitorList.tsx      # Competitor grid
│   │   ├── KeywordMatrix.tsx       # Keyword overlap heatmap
│   │   ├── ContentGaps.tsx         # Gap analysis view
│   │   └── RankingChart.tsx        # Position tracking charts
│   │
│   └── LinkLab/
│       ├── LinkLab.tsx             # Main container
│       ├── LinkGraph.tsx           # Force-directed graph
│       ├── OrphanDetector.tsx      # Orphan page list
│       ├── LinkSuggestions.tsx     # AI suggestions
│       └── AnchorAnalysis.tsx      # Anchor text distribution
│
└── shared/
    ├── DomainSelector.tsx          # Reusable domain picker
    ├── DateRangePicker.tsx         # Date range selector
    └── MetricsCard.tsx             # Stat display card
```

---

## Part 7: Competitor Intelligence Framework

### Target Competitors for Water Damage Niche

| Competitor | Domain | Market | Priority |
|------------|--------|--------|----------|
| ServiceMaster | servicemaster.com | National | P1 |
| SERVPRO | servpro.com | National franchise | P1 |
| PuroClean | puroclean.com | National franchise | P1 |
| Paul Davis | pauldavis.com | National | P2 |
| Rainbow International | rainbowintl.com | National | P2 |
| Local: Hippo | hipporestorationva.com | VA/DC | P1 |
| Local: Jenkins | jenkinsrestorations.com | VA | P2 |

### Competitor Data Collection

```javascript
// competitorIntelService.js

class CompetitorIntelService {
  // Collect sitemap URLs
  async crawlSitemap(competitorDomain) {
    const sitemapUrl = `https://${competitorDomain}/sitemap.xml`;
    const urls = await this.parseSitemap(sitemapUrl);
    return urls;
  }

  // Track keyword rankings
  async trackKeywords(competitorDomain, keywords) {
    const results = [];
    for (const keyword of keywords) {
      const ranking = await serpService.checkRanking(keyword, competitorDomain);
      results.push({ keyword, ...ranking });
    }
    return results;
  }

  // Detect new content
  async detectNewContent(competitorDomain) {
    const currentUrls = await this.crawlSitemap(competitorDomain);
    const previousUrls = await this.getStoredUrls(competitorDomain);
    const newUrls = currentUrls.filter(u => !previousUrls.includes(u));
    return newUrls;
  }

  // Analyze content gaps
  async findContentGaps(competitorDomains, ourDomain) {
    const competitorKeywords = await this.aggregateKeywords(competitorDomains);
    const ourKeywords = await this.getOurKeywords(ourDomain);
    const gaps = competitorKeywords.filter(k => !ourKeywords.includes(k.keyword));
    return gaps.sort((a, b) => b.traffic - a.traffic);
  }

  // Weekly competitor digest
  async generateWeeklyReport(competitorDomains) {
    const report = {
      newContent: [],
      rankingChanges: [],
      contentGaps: [],
      recommendations: []
    };

    for (const domain of competitorDomains) {
      report.newContent.push(...await this.detectNewContent(domain));
      report.rankingChanges.push(...await this.getRankingChanges(domain));
    }

    report.contentGaps = await this.findContentGaps(competitorDomains, 'flood.doctor');
    report.recommendations = await this.generateRecommendations(report);

    return report;
  }
}
```

### Competitor Metrics Dashboard

```
┌────────────────────────────────────────────────────────────────────┐
│  Competitor Intelligence                              [Last: 2h ago]│
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │ Keyword Overlap │  │ Content Velocity │  │  Ranking Wins   │    │
│  │     324/500     │  │   12 posts/week  │  │   +23 this week │    │
│  │   (vs SERVPRO)  │  │  (avg competitor)│  │   (vs -8 losses)│    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
│                                                                     │
│  Keyword Gap Opportunities                         [Export CSV]    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Keyword                  │ Vol  │ Diff │ Competitor │ Gap   │  │
│  │ water damage restoration │ 22K  │  45  │ SERVPRO #3 │ High  │  │
│  │ flood cleanup near me    │ 8.1K │  38  │ PuroClean  │ Med   │  │
│  │ basement flooding help   │ 4.2K │  29  │ Paul Davis │ Med   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  New Competitor Content (This Week)                                 │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ • SERVPRO: "Winter Pipe Burst Prevention Guide" (Jan 3)     │  │
│  │ • PuroClean: "2026 Water Damage Statistics" (Jan 2)         │  │
│  │ • ServiceMaster: "Ice Dam Damage Repair" (Jan 1)            │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  AI Recommendations                                                 │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ 1. Create "Winter Pipe Burst" content to compete with SERVPRO│  │
│  │ 2. Target "flood cleanup near me" - high volume, medium diff │  │
│  │ 3. Update 2024 statistics pages with 2026 data              │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

## Part 8: KPI & Metrics Framework

### Network-Level KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Total organic traffic | +50% YoY | GA4 aggregate |
| Domain authority (avg) | 35+ | Moz/Ahrefs |
| Keywords in top 10 | 500+ | SERP tracking |
| Content pieces published | 20/week | Content system |
| Cross-domain referrals | 15% of traffic | GA4 referrals |
| Lead generation | 100/month | Form submissions |

### Per-Domain KPIs

| Metric | Hub Target | Spoke Target | Satellite Target |
|--------|------------|--------------|------------------|
| Monthly traffic | 50K+ | 10K+ | 5K+ |
| Avg position | <15 | <20 | <25 |
| Pages indexed | 100+ | 50+ | 30+ |
| Internal links/page | 5+ | 3+ | 2+ |
| Bounce rate | <60% | <65% | <70% |

### Content Performance KPIs

| Metric | Target | Action if Below |
|--------|--------|-----------------|
| Avg time on page | >3 min | Improve content depth |
| Pages/session | >2 | Add internal links |
| Organic CTR | >3% | Optimize titles/meta |
| Featured snippets | 10+ | Add FAQ schema |
| Conversion rate | >2% | Improve CTAs |

### Reporting Dashboard Wireframe

```
┌────────────────────────────────────────────────────────────────────┐
│  Blog Network Overview                           [Jan 1-5, 2026]   │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Traffic  │ │ Keywords │ │ Content  │ │  Leads   │ │ Revenue  │ │
│  │  142.3K  │ │   387    │ │   156    │ │    47    │ │  $12.4K  │ │
│  │  ↑ 12%   │ │  ↑ 23    │ │  ↑ 8     │ │  ↑ 15%   │ │  ↑ 8%    │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                                     │
│  Traffic by Domain                                                  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ ████████████████████████████████████ flooddoctorva (48.1K)  │  │
│  │ ████████████████ flood.doctor (13.2K)                       │  │
│  │ ████████████ flood.repair (8.8K)                            │  │
│  │ ██████████ dc.contractors (7.3K)                            │  │
│  │ █████████ floodrepair.org (8.0K)                            │  │
│  │ ████████ waterdamage.cc (5.7K)                              │  │
│  │ ██████ vawaterdamage (5.3K)                                 │  │
│  │ █████ mdwaterdamage (4.7K)                                  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Content Production                    Link Health                  │
│  ┌───────────────────────────┐       ┌───────────────────────────┐│
│  │ Published: 8              │       │ Internal links: 2,340     ││
│  │ In Review: 3              │       │ Cross-domain: 156         ││
│  │ Drafts: 12                │       │ Orphan pages: 7           ││
│  │ Scheduled: 5              │       │ Broken links: 2           ││
│  └───────────────────────────┘       └───────────────────────────┘│
│                                                                     │
│  Top Performing Content (This Week)                                 │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ 1. "Water Damage Restoration Cost Guide" - 4.2K views       │  │
│  │ 2. "Emergency Flood Cleanup Steps" - 3.1K views             │  │
│  │ 3. "Basement Flooding Prevention" - 2.8K views              │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

## Part 9: Implementation Roadmap (Detailed)

### Week 1: Domain Infrastructure

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Create domainPortfolioService.js | CRUD + Cloudflare API |
| Tue | Build DomainLab UI shell | Navigation, layout |
| Wed | Domain list + health checks | Table view + status indicators |
| Thu | DNS management integration | Add/edit/delete records |
| Fri | Network visualization | D3 force graph |

### Week 2: Content System Foundation

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Create contentService.js | Content CRUD |
| Tue | WordPress integration | REST API client |
| Wed | Content calendar UI | react-big-calendar |
| Thu | Content editor | Rich text + markdown |
| Fri | Publish workflow | Draft → Review → Publish |

### Week 3: AI Content Generation

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Content brief generator | Keyword → brief |
| Tue | Draft generation | Brief → full draft |
| Wed | Enhancement pipeline | Links, images, schema |
| Thu | Queue management UI | Generation queue |
| Fri | Quality checks | SEO score, readability |

### Week 4: Interlinking Engine

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Link tracking service | Store all links |
| Tue | Orphan page detection | Find unlinked pages |
| Wed | AI link suggestions | Context-aware suggestions |
| Thu | Cross-domain link planner | Network link strategy |
| Fri | Link visualization | Graph + metrics |

### Week 5: Competitor Intelligence

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Competitor service | Track competitor domains |
| Tue | Sitemap monitoring | Detect new content |
| Wed | Keyword gap analysis | Find opportunities |
| Thu | Competitor dashboard | Metrics + alerts |
| Fri | Weekly digest automation | Email/Slack reports |

### Week 6: Analytics & Reporting

| Day | Task | Deliverable |
|-----|------|-------------|
| Mon | Network dashboard | Aggregate metrics |
| Tue | Per-domain analytics | Individual reports |
| Wed | Content performance | Track by post |
| Thu | Goal tracking | KPI monitoring |
| Fri | Export & sharing | PDF/CSV reports |

---

## Appendix: File Manifest

### New Files to Create

```
ops/services/
├── domainPortfolioService.js      # Domain CRUD + Cloudflare
├── contentService.js              # Content management
├── contentGeneratorService.js     # AI content pipeline
├── publishingService.js           # Multi-platform publish
├── wordpressService.js            # WordPress API client
├── interlinkingService.js         # Link management
├── competitorIntelService.js      # Competitor tracking
├── contentCalendarService.js      # Editorial calendar
├── networkAnalyticsService.js     # Aggregate metrics

ops/routes/
├── domains.js                     # /api/v2/domains/*
├── content.js                     # /api/v2/content/*
├── contentGen.js                  # /api/v2/content-gen/*
├── competitors.js                 # /api/v2/competitors/*
├── links.js                       # /api/v2/links/*
├── calendar.js                    # /api/v2/calendar/*
├── network.js                     # /api/v2/network/*

ops/client/src/components/labs/
├── DomainLab/
├── ContentLab/
├── CompetitorLab/
├── LinkLab/

ops/state/
├── domain-portfolio.json          # ✅ Created
├── content/                       # Content storage
├── competitors/                   # Competitor data
├── calendar/                      # Calendar items
```

### Files to Modify

```
ops/server.js                      # Add new route imports
ops/client/src/App.tsx             # Add new lab navigation
ops/client/src/types.ts            # Add new type definitions
```

---

## Next Steps

1. **User Approval**: Review and approve this plan
2. **Start Week 1**: Domain Portfolio Service implementation
