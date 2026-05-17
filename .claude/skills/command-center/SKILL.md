---
name: command-center
description: "Launch the Command Center — a local web UI that surfaces live project state: agents from .claude/agents/, skills from .claude/skills/, current sprint, git history, and the agent audit log. Runs a Vite dev server at http://localhost:5173 (or next free port) and opens it in the browser. Use when user says 'open command center', 'launch the dashboard', 'show me the studio view'."
argument-hint: "[dev|preview] — dev is HMR (default); preview serves a built bundle"
user-invocable: true
allowed-tools: Bash
model: haiku
---

# Command Center

Boots the local web UI. The page reads its data from build-time extractors
that scan `.claude/agents/`, `.claude/skills/`, `production/`, and `git log`
— so it shows the project's *actual* state, not fixtures.

This skill is a thin launcher. The interesting code is at the root of this
repo (Vite + React + TypeScript).

This skill assumes you invoke Claude Code from the root of the
ccgs-command-center checkout. If you've deployed the dashboard at
`<your-project>/tools/command-center/` instead, copy this skill into your
project's `.claude/skills/` and change the launch path below to
`bash tools/command-center/launch.sh <mode>`.

---

## What to do

1. **Resolve the mode.** Default `dev`. If the user passed `preview`, use that
   instead. Anything else → reject and explain `[dev|preview]`.

2. **Start the launcher in the background.** Use the Bash tool with
   `run_in_background: true`:

   ```
   bash launch.sh <mode>
   ```

   First-run installs npm deps; subsequent runs are instant. The script runs
   the extractors (predev hook), starts Vite, and opens the browser
   automatically via Vite's `--open` flag.

3. **Wait for the server to print its URL.** Use Bash with an `until` loop
   that greps for `Local:` in the background task's output file (the file path
   is returned by the background launch). Once matched, read the URL.

   Example (substitute the actual output path returned in step 2):

   ```bash
   until grep -q "Local:" /path/to/task.output; do sleep 0.3; done
   grep "Local:" /path/to/task.output
   ```

4. **Report to the user.** Tell them:
   - The URL (so they can re-open it if they close the tab)
   - That the server is running in the background and will keep going until
     they stop it
   - How to stop it: `TaskStop` on the background task, or close the terminal
   - Mode caveats: in `dev`, edits to `src/` hot-reload; in `preview`, they
     get the production bundle but no HMR

5. **Do not block.** Don't keep polling the server. The user just wants it
   open — return control to them once you've reported the URL.

---

## Failure modes

- **node not installed** → the script exits with a clear message. Surface it
  to the user verbatim and suggest installing Node.js 20+.
- **port 5173 (and the next several) all busy** → Vite picks whichever is
  free; just report whatever URL it printed.
- **first-run npm install takes a while** → that's fine, surface the wait
  ("installing dependencies, ~30s") so the user isn't confused.
- **dashboard shows mostly empty states** → expected when run from a repo
  that doesn't have CCGS-shaped `.claude/agents/`, `production/sprints/`,
  etc. The extractors fall back to nulls/empty arrays. Point the dashboard
  at a real project by deploying it under that project's `tools/`.

## Out of scope

- Don't try to "improve" the Command Center code from this skill — that's a
  separate task. This skill only launches.
- Don't render or summarise the data the Command Center shows — open the URL
  and let the user look at it.
