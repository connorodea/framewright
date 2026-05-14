# framewright — Development Roadmap

> Mirror of the Todoist project `framewright — AI Video CLI`.
> Sections track development phases from foundation through public launch.
> Tasks marked ✅ are complete; ☐ are pending.

## Phase 0 — Foundation ✅

Shipped in [PR #1](https://github.com/connorodea/framewright/pull/1).

- [x] Scaffold `@clack/prompts` CLI with figlet ASCII banner
- [x] Project JSON model (`framewright.json`) + 6 scene kinds (title, caption, voiceover, website-capture, image, custom)
- [x] Claude Code subprocess wrapper — installed skills auto-load by trigger phrase
- [x] HyperFrames composition builder with `hf-seek` event bridge
- [x] GitHub repo `connorodea/framewright` + PR #1 open

## Phase 1 — Editing UX

Close the basic editing gaps so projects can be iterated on in-place.

- [ ] Edit existing scene (text / duration / voice)
- [ ] Reorder scenes via picker (move up / move down)
- [ ] Duplicate scene
- [ ] `theme` command — Claude Code picks a brand palette + fonts; persisted in project JSON
- [ ] Scene templates (hook / demo / CTA / outro presets)

## Phase 2 — Deep skill integration

Lean into the full skill catalog you already have installed.

- [ ] Verify `website-to-hyperframes` end-to-end (assets under `.hyperframes/captures/`)
- [ ] Wire `hyperframes-media` TTS into the composition as an `<audio>` track
- [ ] Lottie scene kind via `lottie` skill (dotLottie embedding)
- [ ] GSAP-driven transitions via `gsap` skill (registered on `window.__hfGSAP`)
- [ ] Tailwind theme tokens via `tailwind` skill (CSS-first v4)
- [ ] Three.js shader background scene kind via `three` skill

## Phase 3 — Non-interactive mode

Make framewright scriptable for CI pipelines and shell composition.

- [ ] Argument parser (`commander` or `citty`); keep the menu as the default
- [ ] `fw new <name> --width --height --fps --preset`
- [ ] `fw add <kind> --text --duration --url --image`
- [ ] `fw script <topic> --tone --duration --json`
- [ ] `fw render --format mp4|webm|gif --out <path>`
- [ ] `fw preview` (headless launcher)
- [ ] `fw clone <url>` — one-shot website-to-video via `website-to-hyperframes` skill

## Phase 4 — Quality & CI

Lock in correctness before users start trusting the output.

- [x] GitHub Actions: typecheck + build on push/PR (Node 20, 22) — this PR
- [ ] Vitest setup + tests for `lib/project.ts` (slugify, nextSceneId, totalDurationMs)
- [ ] Snapshot test for `buildCompositionHtml()` output
- [ ] Mock execa for Claude/HyperFrames in tests
- [ ] ESLint + Prettier (CI-enforced)
- [ ] Friendly errors when `claude` or `hyperframes` binaries are missing
- [ ] Release workflow (build → `npm publish` on `v*` tag)

## Phase 5 — Docs & demos

Make adoption frictionless.

- [ ] README walkthrough with asciinema recording
- [ ] `ARCHITECTURE.md` (framewright → `claude -p` → skills → hyperframes → output)
- [ ] `CONTRIBUTING.md` + issue / PR templates
- [ ] `examples/` directory: launch teaser, B2B explainer, meme/social
- [ ] Dogfood: build framewright's own demo video using framewright
- [ ] GitHub Pages landing page

## Phase 6 — Release prep

The pre-flight checklist before `npm publish`.

- [ ] Verify shebang + execute bit on `dist/index.js`
- [ ] `--version` and `--help` top-level flags
- [ ] `npm publish --dry-run` review of tarball contents
- [ ] `CHANGELOG.md` (keep-a-changelog format)
- [ ] Bump to `1.0.0-beta.0` once Phases 1–3 land
- [ ] Add `NPM_TOKEN` GitHub secret
- [ ] Smoke test `npx framewright` on a clean machine

## Phase 7 — Launch

Ship it where the target users live.

- [ ] `npm publish 1.0.0`
- [ ] X/Twitter announcement thread
- [ ] Product Hunt submission (Tuesday 12:01am PT)
- [ ] skills.sh registry submission
- [ ] `awesome-cli-apps` + `awesome-claude-code` PRs
- [ ] Show HN post
- [ ] 5-minute walkthrough on YouTube, pinned to README

## Bugs & polish

Living list — append as issues surface.

- [ ] Non-interactive shells should fall back to subcommand mode, not crash on TTY init
- [ ] SIGINT during a spinner sometimes leaves the cursor hidden
