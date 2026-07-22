import { pagesOfType } from "../../../state/pages.js";
import { overdueChip, type Chip } from "../../../ui/chips.js";
import { i18n } from "../../../foundry-utils.js";

interface BeatSystemLike {
  actor: string;
  stage: string;
  debt: number;
}

interface ThreadSystemLike {
  owners: string[];
}

/**
 * Cast membership is derived from "which actors have a Beat page assigned to
 * them" (Beat.actor), not any actor.type / system-specific PC check — the
 * module spec's non-goals explicitly ban system-specific coupling, and this
 * sidesteps needing to know what a "PC" means in an arbitrary system.
 */
export async function prepareCastContext(): Promise<Record<string, unknown>> {
  const beats = pagesOfType("continuity-engine.beat").filter((p) => (p.system as BeatSystemLike).actor);
  const threads = pagesOfType("continuity-engine.thread");

  const cast = await Promise.all(
    beats.map(async (beat) => {
      const system = beat.system as BeatSystemLike;
      const actor = (await fromUuid(system.actor)) as { name?: string; img?: string; uuid?: string } | null;

      const ownedThreads = threads
        .filter((t) => (t.system as ThreadSystemLike).owners.includes(system.actor))
        .map((t) => ({ uuid: t.uuid, name: t.name }));

      const chips: Chip[] = [{ text: i18n().localize(`CE.beat.chip.stage.${system.stage}`), tone: "neutral" }];
      const overdue = overdueChip(system.debt);
      if (overdue) chips.push(overdue);

      return {
        beatUuid: beat.uuid,
        beatName: beat.name,
        actorUuid: system.actor,
        actorName: actor?.name ?? system.actor,
        actorImg: actor?.img,
        chips,
        ownedThreads,
      };
    }),
  );

  return { cast };
}
