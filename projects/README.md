# AI Director Projects

This folder contains projects created and managed by AI Directors through Mission Control.

## Structure

```
projects/
├── README.md                    # This file
├── manifest.json                # Project index and metadata
└── {project-name}/              # Individual project folders
    ├── .project.json            # Project metadata
    ├── src/                     # Source code
    ├── docs/                    # Documentation
    ├── assets/                  # Images, files, etc.
    └── handoffs/                # Director handoff notes
```

## Project Lifecycle

1. **Creation**: Director spawns a new project via `/api/projects`
2. **Development**: Code is written to `projects/{name}/src/`
3. **Checkpoints**: Auto-commits at key milestones
4. **Handoff**: Director creates handoff notes in `handoffs/`

## Commit Intervals

Projects are automatically committed:
- After every major feature completion
- Before context compaction
- Every 30 minutes of active work
- On explicit user request
- Before switching projects

## Project Status

See `manifest.json` for current project statuses.
