# Continuity Engine — Module Spec v1.0

**Target:** FoundryVTT v14 (stable). System-agnostic.
**Module ID:** `continuity-engine`
**Working title:** Continuity
**Audience for this document:** the Claude Code implementation session.

---

## 1. What this is

A persistent campaign-state layer for Foundry. It tracks what is *true* in the
world, what the *party believes*, what is *unresolved*, and what is *owed* to
each player character — across sessions, permanently, inside Foundry's own
document system.

It is not an automation module. It never resolves dice, rules, or combat.

**The one-sentence pitch:** Foundry remembers where your tokens are. This
remembers what your campaign is about.

---

## 2. Non-goals (hard boundaries — do not drift)

These are excluded by design, not by scheduling. Do not implement them, and do
not add hooks "in preparation" for them.

- **No mechanical resolution.** No dice, no rules adjudication, no combat
  automation, no damage application, no condition management.
- **No AI / LLM calls.** No API keys, no network egress of world data. A later
  sibling module may consume this one's data; this module ships with zero
  external dependencies.
- **No content ingestion.** No PDF parsing, no adventure import.
- **No system-specific coupling.** No `dnd5e`, no `pf2e` imports. If a feature
  requires knowing a system's data schema, it belongs in an optional
  system-bridge module, not here.

Rationale: every one of these is a separate product. Bundling them makes this
unshippable and makes the boundary between "state tracking" and "GM replacement"
impossible to hold.

---

## 3. Architecture decision: build on native documents

Everything the module stores is a **module-defined JournalEntryPage sub-type**,
registered via `CONFIG.JournalEntryPage.dataModels` in the `init` hook.

**Why this and not a custom store in world settings:**

| Free by using native documents | Cost of rolling our own |
|---|---|
| Ownership/permissions per record (player-visible threads, GM-only truth) | Would need a custom permission layer |
| Folders, sorting, search | Would need custom UI for all of it |
| `@UUID[...]` links from any journal, scene note, or chat message | No linking at all |
| Compendium packing → campaign templates as distributable content | No portability |
| Core import/export, backup, migration | Manual serialization |
| Sheets, drag-drop, context menus | Built from scratch |

The Cockpit (§6) is a *view over* these documents, not a separate database.
There must be exactly one source of truth and it must be the document layer.

### Registration pattern

Sub-types are declared in `module.json` under `documentTypes`, then bound to
data models at init. Foundry auto-prefixes the type string with the module ID,
so a declared type of `thread` is stored as `continuity-engine.thread`.

```ts
Hooks.once("init", () => {
  Object.assign(CONFIG.JournalEntryPage.dataModels, {
    "continuity-engine.thread":    ThreadModel,
    "continuity-engine.clock":     ClockModel,
    "continuity-engine.faction":   FactionModel,
    "continuity-engine.knowledge": KnowledgeModel,
    "continuity-engine.session":   SessionModel,
    "continuity-engine.beat":      BeatModel,
  });
});
```

Each sub-type also needs a `TYPES.JournalEntryPage.*` entry in `en.json` or the
core create-dialog will show raw type strings.

---

## 4. Data model

Six sub-types. All extend `foundry.abstract.TypeDataModel`. Fields use
`foundry.data.fields`.

### 4.1 `thread` — an unresolved narrative thread

| Field | Type | Notes |
|---|---|---|
| `status` | StringField, choices | `open` / `dormant` / `resolved` / `abandoned` |
| `stakes` | HTMLField | What happens if nobody acts |
| `pressure` | NumberField 0–10 | How loud this is right now; drives sort order |
| `openedSession` | NumberField | |
| `lastTouchedSession` | NumberField | The staleness input |
| `resolvedSession` | NumberField, nullable | |
| `owners` | ArrayField(DocumentUUIDField) | Actor UUIDs — whose thread this is |
| `relatedFactions` | ArrayField(DocumentUUIDField) | |
| `playerVisible` | BooleanField | Gates the player view |
| `resolution` | HTMLField | Filled on close; this is campaign memory |

**Derived (`prepareDerivedData`):** `staleness = currentSession - lastTouchedSession`.

### 4.2 `clock` — a progress/doom clock

| Field | Type | Notes |
|---|---|---|
| `segments` | NumberField, min 2 | |
| `filled` | NumberField | Clamp to `[0, segments]` in `prepareDerivedData` |
| `direction` | StringField | `doom` / `progress` |
| `trigger` | HTMLField | What fires when it completes — GM-only |
| `owner` | DocumentUUIDField, nullable | Usually a faction page |
| `visibility` | StringField | `hidden` / `vague` / `explicit` — controls what players see |
| `lastAdvancedSession` | NumberField | |

**Derived:** `complete` (boolean), `remaining`, `percent`.

`visibility` is the interesting field. `vague` renders to players as a
qualitative band ("something is close") rather than "4/6" — it exists because
showing the exact number destroys tension, and hiding the clock entirely
destroys pressure.

### 4.3 `faction` — an actor in the world that isn't a creature

| Field | Type | Notes |
|---|---|---|
| `disposition` | NumberField −5..+5 | Toward the party |
| `agenda` | HTMLField | What they want |
| `assets` | ArrayField(StringField) | What they can bring to bear |
| `currentMove` | HTMLField | What they are doing *right now*, between sessions |
| `clocks` | ArrayField(DocumentUUIDField) | |
| `keyNPCs` | ArrayField(DocumentUUIDField) | Actor UUIDs |
| `playerVisible` | BooleanField | Do the players even know this faction exists |

### 4.4 `knowledge` — the differentiator

A fact, plus the gap between truth and belief. **This is the feature no
competing module has and the reason the module is worth paying for. Do not
simplify it into a notes field.**

| Field | Type | Notes |
|---|---|---|
| `truth` | HTMLField | What is actually true. Always GM-only, regardless of page ownership |
| `partyBelief` | HTMLField | What the party currently thinks is true |
| `knownBy` | ArrayField(DocumentUUIDField) | Which PCs know it — per-character, not party-wide |
| `revealedSession` | NumberField, nullable | |
| `source` | StringField | Who/what told them |
| `reliability` | StringField | `confirmed` / `plausible` / `rumor` / `lie` |
| `relatedThreads` | ArrayField(DocumentUUIDField) | |

**Derived:** `divergent` — true when `partyBelief` is non-empty and
`reliability` is `lie` or `rumor`. The Cockpit surfaces divergent knowledge as a
first-class panel: these are the campaign's live dramatic ironies, and forgetting
one is the most common continuity failure a GM makes.

**Security note:** `truth` must never reach a non-GM client. Do not rely on
sheet-level hiding — filter it server-side-equivalent by never including it in
any player-facing render context, and by defaulting these pages to GM-only
ownership at creation.

### 4.5 `session` — the log

| Field | Type | Notes |
|---|---|---|
| `number` | NumberField | |
| `date` | StringField | Real-world date |
| `present` | ArrayField(DocumentUUIDField) | Which PCs were at the table |
| `events` | ArrayField(SchemaField) | `{ timestamp, kind, text, refs[] }` |
| `threadsTouched` | ArrayField(DocumentUUIDField) | |
| `clocksAdvanced` | ArrayField(DocumentUUIDField) | |
| `recap` | HTMLField | Player-facing; this page is the one players can read |

### 4.6 `beat` — personal-quest debt

| Field | Type | Notes |
|---|---|---|
| `actor` | DocumentUUIDField | The PC |
| `hook` | HTMLField | Their unresolved personal thing |
| `lastServedSession` | NumberField | Last time this PC got a scene about *them* |
| `stage` | StringField | `seeded` / `building` / `crisis` / `resolved` |

**Derived:** `debt = currentSession - lastServedSession`.

This is the smallest sub-type and possibly the highest-value one. "Which player
hasn't had a moment in five sessions" is a question every GM should ask and
almost none can answer.

---

## 5. World state singleton

One world-scoped setting, `continuity-engine.ledger`, backed by a `DataModel`:

```
currentSession: number
campaignName: string
sessionInProgress: boolean
config: { staleThreshold: number, beatDebtThreshold: number }
```

`currentSession` is the clock every derived field reads from. Advancing it is an
explicit GM action ("Begin Session N"), never automatic.

---

## 6. The Cockpit (primary UI)

One application: `ContinuityCockpit extends HandlebarsApplicationMixin(ApplicationV2)`.

**ApplicationV2 is mandatory, not preferred.** v14's native pop-out windowing is
provided by the ApplicationV2 framework only; legacy V1 applications don't get
it. Pop-out is the single most valuable UI affordance for this module — the GM
runs the Cockpit on a second monitor beside the canvas. Building on V1 would
forfeit the module's best feature.

### Tabs

| Tab | Contents |
|---|---|
| **Board** | The default view. Read-only triage: stale threads, clocks near completion, PCs in beat debt, divergent knowledge. Nothing else. |
| **Threads** | Sortable by pressure / staleness / owner. Inline status change. |
| **Clocks** | Advance/retract by segment click. |
| **Factions** | Disposition, current move, linked clocks. |
| **Knowledge** | Two-column: truth vs. belief. Divergences flagged. |
| **Cast** | PCs with beat debt, personal-quest stage, threads owned. |
| **Log** | Session history, recap editing. |

**Board is the product.** If the GM opens the Cockpit and can't tell in five
seconds what needs attention this session, the module has failed regardless of
how good the data model is. Everything else is editing surface for the Board.

### Player view

A separate, much smaller application (or a filtered Cockpit mode) showing only:
recaps, `playerVisible` threads, clocks at their configured visibility, and
faction entries the party knows about. Gated by `game.user.isGM`.

---

## 7. Session capture

Minimal and manual-first. Automatic capture is a trap: it produces noise
volume that makes the log useless, and it's the fastest way to a module that
feels like surveillance.

**P3 scope:**
- `Begin Session` / `End Session` GM controls (increments `currentSession`,
  creates the `session` page).
- A chat command (`/log <text>`) and a Cockpit quick-add that appends an event.
- Automatic markers only for unambiguous structural events: scene activated,
  combat started, combat ended.
- On `End Session`: prompt the GM to mark threads touched and clocks advanced,
  pre-filled from what was edited during the session window.

Recap text is written by the GM. (A later AI sibling module may draft it. Not
here.)

---

## 8. Technical setup

- **TypeScript, `strict: true`.** Non-negotiable given the data-model surface.
- **`foundry-vtt-types`** — pin the version. Expect v14 coverage to lag behind
  the released API. Maintain `src/types/foundry-augment.d.ts` for local
  augmentation rather than loosening `strict` or scattering `any`. When a type
  is missing, augment once in that file with a comment naming the API doc page;
  never inline-cast at the call site.
- **Vite** for build, ESM output, no bundled runtime dependencies.
- **Handlebars** templates via `HandlebarsApplicationMixin` `PARTS`.
- `module.json`: `compatibility.minimum` and `verified` both set to v14.
  Do not claim v13 compatibility — the Region and ApplicationV2 differences
  aren't worth supporting a legacy branch on a first release.

### Suggested structure

```
src/
  module.ts                 # init/setup/ready hooks, registration only
  models/                   # one file per sub-type
  sheets/                   # per-sub-type ApplicationV2 sheets
  apps/cockpit/             # Cockpit app + PARTS templates
  apps/player-view/
  state/ledger.ts           # world setting DataModel + accessors
  derive/                   # pure functions: staleness, debt, divergence
  types/foundry-augment.d.ts
templates/
lang/en.json                # includes the TYPES block
```

**Keep `derive/` pure and framework-free.** Staleness, beat debt, clock urgency,
and divergence detection are plain functions over plain data. They must be
unit-testable without Foundry running. This is the part most likely to be reused
by every future module in the line.

---

## 9. Build phases

Each phase ends in something demonstrable. Do not begin a phase before the
previous one runs in a live world.

| Phase | Deliverable | Done when |
|---|---|---|
| **P0** | Scaffolding: TS + Vite + types, `module.json`, init registration, all six models, default sheets | Module loads on v14; all six page types creatable via the standard journal create dialog; data persists across reload |
| **P1** | Ledger singleton + `derive/` + Cockpit Board tab (read-only) | Board correctly flags stale threads, near-complete clocks, and beat debt from hand-entered data |
| **P2** | Full Cockpit tabs with mutation; clock click-to-advance; thread status changes | A full campaign state can be entered and maintained without touching a raw sheet |
| **P3** | Session lifecycle, event log, recap | **Gate: one real Drakkenheim session run end-to-end using only the Cockpit** |
| **P4** | Permissions + player view | A player logs in and sees recaps and visible threads, and provably cannot reach `truth` fields |
| **P5** | Export/import a campaign as a compendium Adventure | State moves between worlds intact |

**P3 is the real milestone.** Everything before it is speculative; surviving one
live session is the first evidence the data model is right. Expect the model to
need revision after P3 — schedule for that rather than treating it as failure,
and route any schema change back to a design discussion rather than patching it
inline.

---

## 10. Success criteria

The module works if, at the start of session N+1, the GM opens the Board and
can answer these without consulting any external notes:

1. Which threads have gone quiet long enough to feel dropped?
2. Which clock fires soonest, and what happens when it does?
3. Which PC hasn't had a personal scene in too long?
4. What does the party currently believe that isn't true?
5. What did the factions do while the party was elsewhere?

If any of these requires leaving the Cockpit, that's a bug in the design, not a
missing feature.

---

## 11. Open decisions for Cyrus

Flagged rather than assumed. These are design forks, not implementation details
— they come back to the design session, not the Code session.

1. **Public name.** `continuity-engine` is the module ID and it's fine. The
   store-facing name is a positioning decision.
2. **Free tier boundary.** Recommend: free module = threads + clocks. Paid =
   knowledge divergence, beat debt, session log, player view. The free half is
   genuinely useful (drives installs), the paid half is what nobody else has.
3. **Multi-campaign in one world** — supported, or one world per campaign?
   Affects whether the ledger is a singleton. Defaulting to singleton until told
   otherwise.
4. **Player write access** — can players propose thread updates or add
   knowledge from their side? Powerful for engagement, significant permission
   surface. Out of scope through P5; decide before P6.
