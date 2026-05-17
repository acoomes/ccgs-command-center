// Vite plugin: re-runs the relevant extractor when its source files change.
// The extractor writes src/data/*.generated.json; Vite's normal HMR picks up
// the JSON change and refreshes the dashboard.
//
// Sources watched (relative to repo root):
//   .claude/agents/*.md                       → extract-agents
//   .claude/skills/**/SKILL.md                → extract-skills
//   CLAUDE.md, production/stage.txt,
//   production/review-mode.txt,
//   docs/engine-reference/**/VERSION.md       → extract-project
//   production/session-logs/agent-audit.log   → extract-history
//   .git/HEAD, .git/index                     → extract-project + extract-history

import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const TOOL_ROOT  = path.resolve(__dirname, '..');
const REPO_ROOT  = path.resolve(__dirname, '../../..');

const ROUTES = [
  { match: /[\\/]\.claude[\\/]agents[\\/].+\.md$/,         extractors: ['agents'] },
  { match: /[\\/]\.claude[\\/]skills[\\/].+[\\/]SKILL\.md$/, extractors: ['skills'] },
  { match: /[\\/](CLAUDE\.md|stage\.txt|review-mode\.txt|VERSION\.md|sprint-status\.yaml)$/, extractors: ['project'] },
  { match: /[\\/]production[\\/]sprints[\\/].+\.md$/, extractors: ['project'] },
  { match: /[\\/]production[\\/]session-state[\\/]active\.md$/, extractors: ['needs'] },
  { match: /[\\/]agent-audit\.log$/,                       extractors: ['history'] },
  { match: /[\\/]\.git[\\/](HEAD|index)$/,                 extractors: ['project', 'history'] },
];

// Watch existing parent dirs (chokidar can't recurse into paths that don't
// exist yet — e.g., production/sprints/ before /sprint-plan creates it).
// The ROUTES regex above filters which specific child files actually trigger
// an extractor, so over-watching the parent is harmless.
const WATCH_PATHS = [
  '.claude',
  'CLAUDE.md',
  'production',
  'docs/engine-reference',
  '.git/HEAD',
  '.git/index',
].map((p) => path.join(REPO_ROOT, p));

export function liveRefresh() {
  const timers   = new Map(); // extractor name → debounce timer
  const inflight = new Set(); // extractors currently running

  function run(name) {
    if (inflight.has(name)) {
      // Already running — re-arm the debounce so we run once more after it finishes.
      schedule(name, 50);
      return;
    }
    inflight.add(name);
    const proc = spawn('node', [`scripts/extract-${name}.mjs`], {
      cwd: TOOL_ROOT,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    proc.on('exit', () => inflight.delete(name));
  }

  function schedule(name, ms = 200) {
    clearTimeout(timers.get(name));
    timers.set(name, setTimeout(() => run(name), ms));
  }

  return {
    name: 'ccgs-live-refresh',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(WATCH_PATHS);

      const handle = (file) => {
        for (const route of ROUTES) {
          if (route.match.test(file)) {
            for (const ex of route.extractors) schedule(ex);
            return;
          }
        }
      };
      server.watcher.on('add',    handle);
      server.watcher.on('change', handle);
      server.watcher.on('unlink', handle);

      server.config.logger.info('[live-refresh] watching .claude/, production/, CLAUDE.md, .git/HEAD+index');
    },
  };
}
