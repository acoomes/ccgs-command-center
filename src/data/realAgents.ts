// Derives the Studio Map (wings → departments → leads/specialists) from real
// agents found in .claude/agents/. The agent files don't encode org hierarchy,
// so the wing/department layout is hand-curated here. Engine specialists are
// filtered against the detected engine; other engine sub-specialists collapse
// into a single "+ N other engines" placeholder.

import generated from './agents.generated.json';
import type {
  AgentDetail, Department, Model, StudioMap, Tier, WingKey,
} from './types';

interface RealAgent {
  slug: string;
  description: string;
  model: string;
}

interface GeneratedData {
  engine: 'godot' | 'unity' | 'unreal';
  agents: RealAgent[];
}

const data = generated as GeneratedData;

export const ENGINE = data.engine;

export const REAL_AGENTS_BY_SLUG: Record<string, RealAgent> =
  Object.fromEntries(data.agents.map((a) => [a.slug, a]));

// ── Org structure ─────────────────────────────────────────────────────
// Mirrors the wings/depts the design assumes. Specialists per dept are listed
// in display order. The "Engine" dept is engine-aware — see below.

interface WingDef {
  director: string;          // T1 director slug
  departments: DepartmentDef[];
}

interface DepartmentDef {
  name: string;
  lead: string | null;       // T2 lead slug (null = flat dept)
  specs: string[];           // T3 specialist slugs (in display order)
}

const ENGINE_SUBS: Record<typeof ENGINE, string[]> = {
  godot: [
    'godot-specialist',
    'godot-csharp-specialist',
    'godot-gdscript-specialist',
    'godot-gdextension-specialist',
    'godot-shader-specialist',
  ],
  unity: [
    'unity-specialist',
    'unity-ui-specialist',
    'unity-shader-specialist',
    'unity-dots-specialist',
    'unity-addressables-specialist',
  ],
  unreal: [
    'unreal-specialist',
    'ue-blueprint-specialist',
    'ue-gas-specialist',
    'ue-umg-specialist',
    'ue-replication-specialist',
  ],
};

const ALL_ENGINE_SUBS: ReadonlySet<string> = new Set([
  ...ENGINE_SUBS.godot, ...ENGINE_SUBS.unity, ...ENGINE_SUBS.unreal,
]);

const ORG: Record<WingKey, WingDef> = {
  creative: {
    director: 'creative-director',
    departments: [
      { name: 'Design',    lead: 'game-designer',      specs: ['systems-designer', 'level-designer', 'economy-designer'] },
      { name: 'Narrative', lead: 'narrative-director', specs: ['writer', 'world-builder'] },
      { name: 'Art',       lead: 'art-director',       specs: ['technical-artist'] },
      { name: 'Audio',     lead: 'audio-director',     specs: ['sound-designer'] },
      { name: 'UX',        lead: null,                 specs: ['ux-designer', 'prototyper'] },
    ],
  },
  technical: {
    director: 'technical-director',
    departments: [
      { name: 'Programming', lead: 'lead-programmer', specs: [
        'gameplay-programmer', 'engine-programmer', 'ai-programmer',
        'network-programmer', 'tools-programmer', 'ui-programmer',
      ] },
      { name: 'QA',          lead: 'qa-lead',         specs: ['qa-tester', 'accessibility-specialist'] },
      { name: 'Engine',      lead: null,              specs: ENGINE_SUBS[ENGINE] },
    ],
  },
  production: {
    director: 'producer',
    departments: [
      { name: 'Ops',          lead: null,                 specs: ['performance-analyst', 'devops-engineer', 'analytics-engineer', 'security-engineer'] },
      { name: 'Live Ops',     lead: null,                 specs: ['live-ops-designer', 'community-manager'] },
      { name: 'Release',      lead: 'release-manager',    specs: [] },
      { name: 'Localization', lead: 'localization-lead',  specs: [] },
    ],
  },
};

// ── StudioMap construction ────────────────────────────────────────────
// Every real agent gets `idle` state — they're templates, not running
// processes. The other-engines pseudo-entry uses `dim` like the fixture.

const otherEngineCount =
  Object.entries(ENGINE_SUBS)
    .filter(([eng]) => eng !== ENGINE)
    .reduce((n, [, subs]) => n + subs.length, 0);

function buildDept(def: DepartmentDef): Department {
  const baseSpecs: Department['specs'] = def.specs.map((slug) => [slug, 'idle', slug] as const);

  // For the Engine dept, append a dim "+ N other engines" placeholder so the
  // panel hints at the inactive specialist sets without expanding the layout.
  const specs: Department['specs'] = def.name === 'Engine' && otherEngineCount > 0
    ? [...baseSpecs, [`+ ${otherEngineCount} other engines`, 'dim'] as const]
    : baseSpecs;

  return {
    name: def.name === 'Engine' ? `Engine · ${ENGINE.toUpperCase()}` : def.name,
    lead: def.lead,
    leadState: def.lead ? 'idle' : undefined,
    leadKey: def.lead ?? undefined,
    specs,
  };
}

export const REAL_STUDIO_MAP: StudioMap = (Object.keys(ORG) as WingKey[]).reduce((map, key) => {
  const def = ORG[key];
  map[key] = {
    director: def.director,
    dirState: 'idle',
    dirKey: def.director,
    departments: def.departments.map(buildDept),
  };
  return map;
}, {} as StudioMap);

// ── Agent tier resolution ─────────────────────────────────────────────
// Tier is implicit in the org structure: directors=T1, leads=T2, specialists=T3.

const TIER_BY_SLUG: Map<string, Tier> = new Map();
for (const wing of Object.values(ORG)) {
  TIER_BY_SLUG.set(wing.director, 1);
  for (const dept of wing.departments) {
    if (dept.lead) TIER_BY_SLUG.set(dept.lead, 2);
    for (const spec of dept.specs) TIER_BY_SLUG.set(spec, 3);
  }
}
// Engine sub-specialists from non-active engines still get T3 even though
// they're not displayed — keeps tier lookup total over all real agents.
for (const slug of ALL_ENGINE_SUBS) {
  if (!TIER_BY_SLUG.has(slug)) TIER_BY_SLUG.set(slug, 3);
}

export function tierFor(slug: string): Tier {
  return TIER_BY_SLUG.get(slug) ?? 3;
}

// ── Popover info from a real agent ────────────────────────────────────

const ALLOWED_MODELS: ReadonlySet<Model> = new Set(['opus', 'sonnet', 'haiku']);

export function realAgentInfo(slug: string): AgentDetail | null {
  const real = REAL_AGENTS_BY_SLUG[slug];
  if (!real) return null;
  const model: Model = ALLOWED_MODELS.has(real.model as Model)
    ? (real.model as Model)
    : 'sonnet';
  return {
    role: real.slug,
    tier: tierFor(real.slug),
    model,
    status: 'Idle',
    task: real.description || '—',
    started: '—',
    spawned: 'agent template · not currently running',
  };
}

// Sanity check at dev time — surfaces missing/extra agents.
if (import.meta.env?.DEV) {
  const orgSlugs = new Set<string>();
  for (const wing of Object.values(ORG)) {
    orgSlugs.add(wing.director);
    for (const dept of wing.departments) {
      if (dept.lead) orgSlugs.add(dept.lead);
      dept.specs.forEach((s) => orgSlugs.add(s));
    }
  }
  for (const slug of ALL_ENGINE_SUBS) orgSlugs.add(slug);

  const realSlugs = new Set(Object.keys(REAL_AGENTS_BY_SLUG));
  const missing = [...orgSlugs].filter((s) => !realSlugs.has(s));
  const extra   = [...realSlugs].filter((s) => !orgSlugs.has(s));
  if (missing.length) console.warn('[realAgents] org references unknown agents:', missing);
  if (extra.length)   console.warn('[realAgents] real agents missing from org map:', extra);
}
