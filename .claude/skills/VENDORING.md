# Vendored skills — provenance & audit

These skills were **vendored manually** (not installed via `npx skills` / `npm i -g`
/ `/plugin install`) so no third-party install script ever ran, and so every
update is a reviewable diff in this repo rather than a silent pull.

De-risking rules applied to each:
1. Downloaded a **pinned tarball** (commit SHA below), not a floating branch.
2. Copied only the skill folders we use.
3. **Stripped every `scripts/` / `tests/` directory** unless the script was read
   line-by-line and confirmed to be pure Python stdlib with no network, no
   `subprocess`/`os.system`/`eval`/`exec`/`pickle`, and no writes outside an
   explicit output dir.
4. Copied **no hooks** — nothing runs ambiently. Skill scripts execute only when
   Claude explicitly invokes them during a task.

| Skill dir | Source repo | Pinned commit | Notes |
|---|---|---|---|
| `frontend-design` | `anthropics/skills` | main @ 2026-08-31 | Pure guidance, no scripts. |
| `web-design-reviewer` | `github/awesome-copilot` | main @ 2026-08-31 | Markdown only (SKILL.md + 2 references). GitHub-official repo. |
| `accessibility`, `best-practices`, `core-web-vitals`, `performance`, `seo`, `web-quality-audit` | `addyosmani/web-quality-skills` | `afa8da942115f2961fdbfa80807ea0b232ff6c00` | Markdown + references. `web-quality-audit/scripts/analyze.sh` kept — read in full, it is a read-only grep-based HTML linter (no mutations, no network). |
| `ui-ux-pro-max` | `nextlevelbuilder/ui-ux-pro-max-skill` | `f23267105ad1f4ccd94af45d382584ad45b586f7` | SKILL.md + `data/` (CSV/JSON design DB) + `references/` + 4 scripts. **Removed:** `scripts/tests/`, `scripts/validate_data.py` (only file importing `urllib`). Kept scripts (`search.py`, `core.py`, `design_system.py`, `reasoning_contract.py`) reviewed: stdlib only (`csv/json/re/os/sys/io/tempfile/pathlib/difflib/argparse`), no network. Only write path is `--persist --output-dir <dir>` (atomic MASTER.md write) — do not pass `--persist` without an explicit safe dir. |
| `ui-styling` | `nextlevelbuilder/ui-ux-pro-max-skill` | same | SKILL.md + `references/` (shadcn + Tailwind guidance) only. **Removed:** `canvas-fonts/` (~2 MB of TTFs for an unrelated canvas image workflow) and `scripts/` (`shadcn_add.py`, `tailwind_config_gen.py` — we configure Tailwind/shadcn by hand). |

`ui-ux-pro-max/SKILL.md` refers to `${CLAUDE_PLUGIN_ROOT}` in its example commands.
As a project skill that variable is unset — invoke the script by its repo-relative
path instead: `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <d>`

To update any of these: re-pull the pinned tarball at a newer SHA, re-run the same
audit, update the SHA here, commit the diff.
