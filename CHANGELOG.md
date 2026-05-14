# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `fw theme` command — apply brand color + font tokens to a project (planned,
  not yet shipped).
- vitest test suite — covers `slugify`, `nextSceneId`, composition HTML
  builder, headless dispatch (planned, not yet shipped).

## [0.1.0] — 2026-05-14

### Added

- Interactive `@clack/prompts` CLI with a figlet ASCII banner on entry.
- Project file model (`framewright.json`) with six scene kinds: `title`,
  `caption`, `voiceover`, `website-capture`, `image`, `custom`.
- Claude Code subprocess wrapper (`src/lib/claude.ts`) — installed skills
  auto-load by trigger phrase. No skill is hard-coded; framewright just
  describes the goal and Claude Code's router picks the tool.
- HyperFrames composition builder (`src/lib/hyperframes.ts`) with an
  `hf-seek` event bridge that drives per-scene `.active` toggling from
  HyperFrames' deterministic timeline.
- Interactive commands: new, list, add, generate-script, capture-website,
  generate-voiceover, remove, preview, render.
- Headless (scriptable) subcommands: `fw new`, `fw list` (alias `fw ls`),
  `fw add <kind>`, `fw script <topic>`, `fw preview`, `fw render`,
  `fw clone <url>` — the one-shot website-to-video pipeline.
- `fw --version` / `fw --help` (commander defaults).
- `.github/workflows/ci.yml` — typecheck + build on Node 20 and 22.
- `ROADMAP.md` documenting the phased plan: Foundation → Editing UX →
  Skill integration → Non-interactive mode → Quality & CI → Docs & demos →
  Release prep → Launch.

[Unreleased]: https://github.com/connorodea/framewright/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/connorodea/framewright/releases/tag/v0.1.0
