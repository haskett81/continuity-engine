import { pagesOfType } from "../../../state/pages.js";
import { staleChip, type Chip } from "../../../ui/chips.js";
import { i18n } from "../../../foundry-utils.js";
import { pressureBand } from "../../../derive/pressure.js";

interface ThreadSystemLike {
  status: string;
  pressure: number;
  staleness: number;
  owners: string[];
}

export type ThreadSortKey = "pressure" | "staleness" | "owner";

const STATUS_KEYS = ["open", "active", "dormant", "resolved"];

export function statusChoices(): Record<string, string> {
  return Object.fromEntries(STATUS_KEYS.map((key) => [key, i18n().localize(`CE.thread.status.${key}`)]));
}

async function firstOwnerName(owners: string[]): Promise<string> {
  const uuid = owners[0];
  if (!uuid) return "";
  const doc = (await fromUuid(uuid)) as { name?: string } | null;
  return doc?.name ?? "";
}

export async function prepareThreadsContext(sort: { key: ThreadSortKey; dir: 1 | -1 }): Promise<Record<string, unknown>> {
  const pages = pagesOfType("continuity-engine.thread");

  const rows = await Promise.all(
    pages.map(async (p) => {
      const system = p.system as ThreadSystemLike;
      const chips: Chip[] = [{ text: i18n().localize(`CE.thread.status.${system.status}`), tone: "neutral" }];
      const stale = staleChip(system.staleness);
      if (stale) chips.push(stale);

      return {
        uuid: p.uuid,
        name: p.name,
        status: system.status,
        pressure: system.pressure,
        pressureBandLabel: i18n().localize(`CE.thread.pressure.band.${pressureBand(system.pressure)}`),
        staleness: system.staleness,
        ownerName: await firstOwnerName(system.owners),
        chips,
      };
    }),
  );

  rows.sort((a, b) => {
    let cmp = 0;
    if (sort.key === "pressure") cmp = a.pressure - b.pressure;
    else if (sort.key === "staleness") cmp = a.staleness - b.staleness;
    else cmp = a.ownerName.localeCompare(b.ownerName);
    return cmp * sort.dir;
  });

  // No `eq` Handlebars helper is registered in this codebase (confirmed
  // while building the sheets) — precompute per-column active/arrow state
  // here rather than comparing strings in the template.
  const arrow = sort.dir === 1 ? "▲" : "▼";
  const threadSortColumns = {
    pressure: { active: sort.key === "pressure", arrow: sort.key === "pressure" ? arrow : "" },
    staleness: { active: sort.key === "staleness", arrow: sort.key === "staleness" ? arrow : "" },
    owner: { active: sort.key === "owner", arrow: sort.key === "owner" ? arrow : "" },
  };

  return { threads: rows, threadSortColumns, threadStatusChoices: statusChoices() };
}
