# CCGS Command Center

Local web UI for the Claude Code Game Studios "Studio Mode" command center.
Ported from the Claude Design handoff bundle (`ccgs-command-center-wireframe`).

The page reads from build-time extractors that scan the repo — agents from
`.claude/agents/`, skills from `.claude/skills/`, project state from
`CLAUDE.md` + git + `production/` — so it shows the actual project, not
fixtures.

## Launch

Three ways, ordered by ease:

```sh
# from anywhere in the repo, in Claude Code:
/command-center

# or from the shell, in this directory:
./launch.sh                  # dev mode (HMR)
./launch.sh preview          # production bundle

# or manually:
npm install
npm run dev                  # http://localhost:5173
```

All three run the five extractors first (`extract-agents`, `extract-project`,
`extract-skills`, `extract-history`, `extract-needs`) so the data reflects
whatever the repo looks like right now. In `dev` mode the extractors also
re-run automatically when their source files change (see **Live refresh** below).

## Layout

- **Header** — project name + engine + session age (time since last `## Session End:` marker) + branch + dirty count
- **Phase pipeline** — 7 phases, current highlighted from `production/stage.txt`
- **Project clock** — Day N (from first commit) · Sprint · Phase day · Session #
- **Left column** — Needs You (open questions, blocked stories, next steps from `active.md`) + Sprint (parses the most-recent file in `production/sprints/`)
- **Center column** — Active delegation tabs:
  - **Live** — agents spawned in the current session (SPAWN events newer than the most recent `## Session End:` marker, paired with STOPs; unpaired = live)
  - **Timeline** — last 14 commits with author + relative time
  - **Audit** — last 18 entries from `production/session-logs/agent-audit.log`, with SPAWN/STOP duration pairing
  - **Map** — full 49-agent studio floor grouped by wing → dept → lead/specialist, engine-aware
- **Right column** — Skills cmd-K palette (real 74 skills; cmd/ctrl-K focuses, ↑/↓/Enter navigate)

## Extractors

Each one writes a JSON file consumed by a typed wrapper in `src/data/`:

| Script | Output | Source |
|---|---|---|
| `extract-agents.mjs` | `agents.generated.json` | `.claude/agents/*.md` frontmatter |
| `extract-project.mjs` | `project.generated.json` | `CLAUDE.md`, `production/` (incl. `sprints/`, `sprint-status.yaml`), `git`, engine VERSION.md |
| `extract-skills.mjs` | `skills.generated.json` | `.claude/skills/*/SKILL.md` frontmatter |
| `extract-history.mjs` | `history.generated.json` | `git log`, `agent-audit.log` |
| `extract-needs.mjs` | `needs.generated.json` | `production/session-state/active.md` |

Generated JSONs are gitignored. Re-running dev/build re-extracts.

**Live refresh.** While the dev server runs, a Vite plugin
(`scripts/vite-live-refresh.mjs`) watches the extractor inputs and re-runs the
matching extractor when one changes:

| File / glob | Re-runs |
|---|---|
| `.claude/agents/*.md` | `extract-agents` |
| `.claude/skills/**/SKILL.md` | `extract-skills` |
| `CLAUDE.md`, `production/stage.txt`, `production/review-mode.txt`, `production/sprints/*.md`, `production/sprint-status.yaml`, `docs/engine-reference/**/VERSION.md` | `extract-project` |
| `production/session-logs/agent-audit.log` | `extract-history` |
| `production/session-state/active.md` | `extract-needs` |
| `.git/HEAD`, `.git/index` (branch checkout, stage, commit) | `extract-project` + `extract-history` |

Each extractor writes its `*.generated.json`, Vite HMR picks up the JSON
change, and the dashboard reloads — no manual restart needed.

## Live tab

Derives currently-running agents from `production/session-logs/agent-audit.log`:

1. Finds the most recent `## Session End: YYYYMMDD_HHMMSS` marker in
   `production/session-logs/session-log.md` — events after that timestamp are
   the current session (fallback: last hour if no marker exists)
2. Pairs SPAWNs (`Agent invoked: <slug>`) with STOPs (`Agent completed: <slug>`)
   LIFO per slug; unpaired SPAWNs are live
3. STOPs in the last 5 minutes show up dimmed below as "just stopped" so you
   see a brief tail of recent activity, not just instantaneous state

Caller hierarchy isn't captured in the audit-log format (no parent field), so
this is a flat list — not a tree. Tab header shows live count + session age;
click any live agent to open its popover (same plumbing as the Map tab).

## Needs You panel

Pulls from two sources and merges them into a single ranked list:

1. **`production/session-state/active.md`** sections (parsed by `extract-needs`):
   - `## Open Questions` table → one need per row (`| OQ-N | Question | Resolves In |`)
   - `## Next Steps` numbered list → top 3 items; an embedded `` `/skill args` ``
     becomes a runnable action
   - `## Deferred Recommended Items` bullet list → one rollup need with the count
2. **Current sprint** (via the sprint parser): `BLOCKED` stories become hot
   needs, `IN REVIEW` stories become review-ready needs

Order, highest first: blocked sprint stories → open questions →
in-review sprint stories → next steps → deferred rollup. If `active.md` is
absent and no sprint is active, the panel shows its "Nothing waiting" empty
state.

## Sprint panel

Reads the most recently modified `.md` file in `production/sprints/`. Expects the
shape produced by the `/sprint-plan` skill:

- Title line: `# Sprint N — START to END`
- `## Sprint Goal` followed by a one-line goal
- Three priority tables under `### Must Have`, `### Should Have`, `### Nice to Have`
  with columns including `ID`, `Task`, `Owner`/`Agent`, `Est. Days`

Story status is inferred from keywords in each row (DONE, IN PROGRESS, BLOCKED,
IN REVIEW, NOT STARTED). If `production/sprint-status.yaml` exists, its `status`
field overrides per story — matching `/sprint-status`'s order of preference.
The header shows `S-NN · START → END`, the right rail shows `N/M done`, and
expand reveals Should / Nice tiers in addition to Must Have.

## Design source

The original prototype lives in the handoff bundle. The chat transcript holds
the design rationale (palette, motion philosophy, why each panel exists).
