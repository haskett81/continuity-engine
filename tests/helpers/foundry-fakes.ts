import { vi } from "vitest";

// Foundry only exists inside a running Foundry world. These fakes stand in for
// the handful of globals the module touches, so its own logic can be tested
// without Foundry. They model only what the module actually calls.

export const OWNERSHIP = { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 } as const;

export interface FakePage {
  name: string;
  type: string;
  uuid: string;
  system: Record<string, unknown>;
  flags: Record<string, unknown>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  getFlag: (scope: string, key: string) => unknown;
  setFlag: ReturnType<typeof vi.fn>;
  unsetFlag: ReturnType<typeof vi.fn>;
}

export function makePage(over: Partial<Pick<FakePage, "name" | "type" | "uuid" | "system" | "flags">> = {}): FakePage {
  const page: FakePage = {
    name: over.name ?? "Page",
    type: over.type ?? "continuity-engine.thread",
    uuid: over.uuid ?? `uuid-${Math.random().toString(36).slice(2)}`,
    system: over.system ?? {},
    flags: over.flags ?? {},
    update: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    getFlag: (_scope, key) => page.flags[key],
    setFlag: vi.fn(async (_scope: string, key: string, value: unknown) => {
      page.flags[key] = value;
    }),
    unsetFlag: vi.fn(async (_scope: string, key: string) => {
      delete page.flags[key];
    }),
  };
  return page;
}

export interface FakeUser {
  id: string;
  isGM: boolean;
}

export interface CreatedPage {
  data: Record<string, unknown>;
  options: Record<string, unknown>;
  uuid: string;
}

type HookFn = (...args: unknown[]) => unknown;

/**
 * Installs fake Foundry globals. Returns the pieces a test needs to set up a
 * world and to look at what the module did to it.
 */
export function installFoundry() {
  const documents = new Map<string, unknown>();
  const journals: { name: string; id: string; ownership?: unknown; pages: { contents: FakePage[] } }[] = [];
  const createdPages: CreatedPage[] = [];
  const createdJournals: Record<string, unknown>[] = [];
  const users: FakeUser[] = [];
  const settingsStore = new Map<string, unknown>();
  const registeredSettings: { key: string; data: Record<string, unknown> }[] = [];
  const hooks = new Map<string, HookFn[]>();
  let pageCounter = 0;

  const settings = {
    register: (_ns: string, key: string, data: Record<string, unknown>) => {
      registeredSettings.push({ key, data });
      if (!settingsStore.has(key)) settingsStore.set(key, data.default);
    },
    get: (_ns: string, key: string) => settingsStore.get(key),
    set: vi.fn(async (_ns: string, key: string, value: unknown) => {
      settingsStore.set(key, value);
    }),
  };

  const game = {
    journal: {
      contents: journals,
      find: (fn: (j: (typeof journals)[number]) => boolean) => journals.find(fn),
    },
    users: { contents: users },
    settings,
    i18n: {
      localize: (key: string) => key,
      format: (key: string, data?: Record<string, string>) => `${key}:${data?.n ?? ""}`,
    },
  };

  vi.stubGlobal("game", game);
  vi.stubGlobal("CONST", { DOCUMENT_OWNERSHIP_LEVELS: OWNERSHIP });
  vi.stubGlobal("fromUuid", async (uuid: string) => documents.get(uuid) ?? null);
  vi.stubGlobal("JournalEntry", {
    create: async (data: Record<string, unknown>) => {
      const journal = { name: String(data.name), id: `j${journals.length + 1}`, ownership: data.ownership, pages: { contents: [] } };
      journals.push(journal);
      createdJournals.push(data);
      return journal;
    },
  });
  vi.stubGlobal("JournalEntryPage", {
    create: async (data: Record<string, unknown>, options: Record<string, unknown>) => {
      const uuid = `JournalEntry.copy.JournalEntryPage.p${++pageCounter}`;
      const copy = makePage({
        name: String(data.name),
        type: String(data.type),
        uuid,
        system: data.system as Record<string, unknown>,
        flags: (data.flags as Record<string, Record<string, unknown>>)?.["continuity-engine"] ?? {},
      });
      documents.set(uuid, copy);
      createdPages.push({ data, options, uuid });
      return { uuid };
    },
  });
  vi.stubGlobal("Hooks", {
    on: (name: string, fn: HookFn) => {
      hooks.set(name, [...(hooks.get(name) ?? []), fn]);
      return hooks.get(name)!.length;
    },
  });

  // Module files build their data schemas the moment they load, so `foundry`
  // has to exist. A schema field here is just an empty placeholder.
  const Field = class {
    constructor(..._args: unknown[]) {}
  };
  vi.stubGlobal("foundry", {
    data: { fields: new Proxy({}, { get: () => Field }) },
    abstract: { DataModel: class {}, TypeDataModel: class {} },
  });

  return {
    game,
    documents,
    journals,
    createdPages,
    createdJournals,
    users,
    settingsStore,
    registeredSettings,
    hooks,
    /** Put a page into the world's journals so the module's page lookups can find it. */
    addPage(page: FakePage) {
      let journal = journals.find((j) => j.name === "World Journal");
      if (!journal) {
        journal = { name: "World Journal", id: "world", pages: { contents: [] } };
        journals.push(journal);
      }
      journal.pages.contents.push(page);
      documents.set(page.uuid, page);
      return page;
    },
    /** Run every handler registered for a hook, the way Foundry would. */
    async fire(name: string, ...args: unknown[]) {
      for (const fn of hooks.get(name) ?? []) await fn(...args);
    },
  };
}

/** Lets fire-and-forget async handlers finish before a test checks the result. */
export async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
