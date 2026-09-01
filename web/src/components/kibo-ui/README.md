# Kibo UI components (vendored)

Installed from the Kibo UI shadcn registry (`https://www.kibo-ui.com/r/<name>.json`)
via `npx shadcn@latest add`. Kibo UI is MIT, maintained by Shadcnblocks (originally
Hayden Bleasel). These are copied into the repo — update by re-running the CLI.

Every `index.tsx` carries `// @ts-nocheck` on line 1: they're third-party UI built
against a looser tsconfig than ours (`noUncheckedIndexedAccess`, `strict`). Runtime
behaviour is fine; we don't want the strict-mode noise from code we don't maintain.
`image-crop` had a leaked monorepo import (`@repo/shadcn-ui/...`) rewritten to `@/`.

## In use now

| Component | Where |
|---|---|
| `dropzone` | Compose — drag-and-drop media (`components/compose/MediaDropzone.tsx`) |

## Held for the roadmap

| Component | Planned use |
|---|---|
| `kanban` | content-pipeline board view (drafts → review → approved → scheduled) |
| `contribution-graph` | posting-cadence heatmap on the analytics screen |
| `video-player` | TikTok / YouTube preview + playback |
| `list` | bulk scheduling / queue management |
| `avatar-stack` | show a campaign's connected accounts at a glance |
| `announcement` | dashboard banners (token expiring, review overdue) |
| `status` | connection health dots on the Accounts screen |
| `combobox` | campaign / account pickers as they grow |
| `tags` | hashtag / mention chips in the composer |
| `image-crop` | crop uploads to per-network aspect ratios |
| `mini-calendar` | compact inline date strip |
| `relative-time` | "2 hours ago" timestamps in the ledger and Posts list |
