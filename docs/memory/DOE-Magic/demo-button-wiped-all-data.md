# DOE-Magic — Lesson: A "load demo" button wiped every user's data

> Created: 2026-10-21. Status: fixed in P0.1 (DATA-1, UI-1). The partly related DATA-14 (shared sample objects) is fixed for the reset only; seeding stays with P2.15.
> Related: [Roadmap and backlog, P0.1](../../spec/DOE-Magic/roadmap-backlog.md#p01-demo-buttons-stop-wiping-all-data), [Design spec §5.5](../../spec/DOE-Magic/design-spec.md#55-rules-for-changing-persistence), [Server and persistence](../../context/DOE-Magic/server-and-persistence.md), [Web UI](../../context/DOE-Magic/web-ui.md), [Runtime data in git](runtime-data-in-git.md)

## Symptom

On the Dashboard, "Demo Studies" (tooltip: "Load standard demo study") and the empty-state "Load Demo Experiments" both called `resetSampleData`. One click replaced every project and folder with the single demo project:

- in the browser and its localStorage cache;
- in `data.json`, through `POST /api/reset-sample`;
- in every other connected browser, through `sync_data`.

Nothing asked first, and nothing kept a copy. Reproduced on 2026-10-21 at `b2a9f85`: with three user projects on the server, one `POST /api/reset-sample` with no body left only the demo.

## Root cause

- **The label and the handler disagreed.** "Load" promised an additive action, but the handler was a global reset. The additive version, `loadDemoProject`, already existed in `ProjectContext.tsx` and had no callers.
- **The destructive path had no guard at any layer.** The UI did not confirm. The endpoint accepted a POST with no body, so any page that could reach the server could trigger it (SRV-1). It overwrote `data.json` without a copy.
- **The name hid the scope.** `resetSampleData` reads like a demo helper. It actually deleted every user's projects.
- **The reset reused shared objects.** It rebuilt the store from `[...sampleProjects]`, the module's own objects, so after an MCP edit of the seeded demo it "restored" the edited copy (DATA-14).
- There were no tests and no review when the code was generated, and the button sat next to **Import Project**, where it was easy to click.

## Fix

P0.1 made these changes (details in the [backlog outcome](../../spec/DOE-Magic/roadmap-backlog.md#p01-outcome)):

- Both buttons call `loadDemoProject`, which adds a fresh copy from `createDemoProjectCopy` and never replaces a project.
- The full reset is a separately labelled **Reset Sample Data** in the Archive view, behind the shared `src/web/shared/ConfirmDialog.tsx`. The dialog text names the counts and the consequence.
- `POST /api/reset-sample` refuses anything but the JSON body `{"confirm": true}`. It copies `data.json` to `data.json.before-reset-<timestamp>` before writing, and rebuilds the store with `createSampleProjects()` / `createSampleFolders()`.

## Rule

A control must do what its label says. Anything that deletes or overwrites data asks first in the UI and is refused by the server unless the request confirms explicitly, and the server keeps a copy before it writes.

**How to apply:**

- When adding or reviewing a button, follow its handler down to the server call. A "load", "add" or "open" label must never reach code that deletes.
- Name destructive functions and endpoints for what they destroy, including whose data.
- Destructive UI uses `ConfirmDialog` with the consequence and the affected counts in the text. Cancel keeps the initial focus.
- Destructive endpoints require an explicit JSON confirmation and back up first (design spec §5.5). A plain POST must never be enough.
- Build sample data with the `create*` factories in `src/core/sampleProject.ts`, never by spreading the module-level arrays.
