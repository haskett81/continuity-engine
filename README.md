# Continuity

Continuity is a Foundry VTT module for keeping track of a campaign between sessions. It stores open story threads, faction activity, clocks, what the party believes, character beats, and session notes as Foundry journal pages.

The current release is **v0.3.17**. Its module manifest declares Foundry VTT **v14** as both the minimum and verified version. The project is pre-1.0; back up a world before trying it with an existing campaign.

## What you can track

| Page type | Use it for |
| --- | --- |
| Thread | An unresolved storyline, its stakes, and its current pressure |
| Clock | Progress toward an event or consequence |
| Faction | A group's disposition and current move |
| Knowledge | The difference between what is true and what the party believes |
| Beat | A personal story beat for a player character |
| Session | Notes and events from a session |

The GM Cockpit brings these pages together. Its Board highlights threads, clocks, beats, and knowledge that may need attention. Begin Session and End Session controls help record what happened while it is fresh.

Players see a separate Campaign Chronicle. The GM chooses which information to publish to it; GM journal pages are not shown there directly.

Continuity does not roll dice, automate combat, import adventures, or send campaign data to an AI service.

## Getting started

In Foundry VTT v14, open **Add-on Modules → Install Module** and paste this manifest URL:

```text
https://github.com/haskett81/continuity-engine/releases/download/v0.3.17/module.json
```

This link points to the specific v0.3.17 release. After installation, enable Continuity in your world. Create its page types in a journal, or open the GM Cockpit from the dock icon.

The [release page](https://github.com/haskett81/continuity-engine/releases/tag/v0.3.17) also provides the package files. The module has not been verified in every game system or alongside every other module.

## Develop

Use Node.js 20 with the checked-in lockfile:

```text
npm ci
npm run typecheck
npm run build
```

The build writes a Foundry package to `dist/`. See [SETUP.md](SETUP.md) for the release process.

## License

[MIT](LICENSE). Built with AI assistance.
