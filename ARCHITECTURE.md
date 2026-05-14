# Architecture

framewright is a thin orchestrator. It owns a small JSON project model and two
subprocess bridges — one to [Claude Code](https://docs.claude.com/claude-code),
one to [HyperFrames](https://github.com/heygen-com/hyperframes). Everything
domain-specific (video knowledge, animation libraries, website scraping, TTS)
lives in Claude Code skills that the user installs separately.

## High-level flow

```
        ┌──────────────────────────────────────────────────────────────┐
        │                          user                                │
        └──────────────────────────────┬───────────────────────────────┘
                                       │
                       fw / framewright (commander)
                                       │
                ┌──────────────────────┴──────────────────────┐
                │                                             │
       interactive.ts                                   headless.ts
       (@clack/prompts menu)                            (one fn / subcommand)
                │                                             │
                └──────────────────────┬──────────────────────┘
                                       │
                                  src/commands/*
                       (newProject · addScene · generateScript
                        captureWebsite · generateVoiceover
                        listScenes · removeScene · preview · render)
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
         lib/project.ts          lib/claude.ts          lib/hyperframes.ts
       (framewright.json        (claude -p wrapper)    (execa + composition
        model · scenes)                                 HTML builder)
                                       │                      │
                                       ▼                      ▼
                               claude -p subprocess     npx hyperframes
                                       │                preview / render
                                       ▼                      │
                          installed Claude Code skills        ▼
                          (hyperframes · website-to-      mp4 / webm / gif
                           hyperframes · hyperframes-     in ./renders/
                           media · lottie · gsap ·
                           animejs · tailwind · three)
                                       │
                                       ▼
                            assets written under
                              .hyperframes/
```

## The skill bridge

This is the design's biggest leverage point and the reason framewright stays
small. framewright **never hard-codes which skill to invoke.** It builds a
plain-English prompt that mentions the goal (and the relevant trigger phrase),
shells out to `claude -p`, and lets Claude Code's skill router pick the right
skill.

For example, `captureWebsiteViaSkill` in `src/lib/claude.ts` runs:

```
claude -p "Use the website-to-hyperframes skill.
Target URL: https://example.com
Desired clip duration: 4.0 seconds.
Working directory: /tmp/my-project
Save the resulting hyperframes assets under .hyperframes/captures/ in this directory.
Report back the relative path(s) you wrote."
  --permission-mode acceptEdits
  --add-dir /tmp/my-project
```

Claude Code matches `website-to-hyperframes` against installed skill
descriptions, loads it, and the skill does the work. framewright reads the
exit code and the stdout/stderr log.

The same shape works for any skill — `hyperframes-media` for kokoro TTS,
`lottie` for Lottie embeds, `gsap`/`animejs` for animation, `three` for WebGL,
`tailwind` for styling, etc. **Installing a new skill grants framewright new
capability with zero code changes here.** You only need to add a new helper if
you want a typed convenience wrapper or a named CLI subcommand.

There are three skill bridges in `src/lib/claude.ts` today:

- `generateScript({ topic, tone, … })` — Claude returns a JSON script (does
  not strictly require a skill; uses general scripting reasoning).
- `captureWebsiteViaSkill({ url, durationMs, projectDir })` — triggers
  `website-to-hyperframes`.
- `generateVoiceoverViaSkill({ text, voice, outPath, projectDir })` — triggers
  `hyperframes-media`.

All three call the same `runClaude(...)` primitive. Adding a fourth (say,
"generate a Lottie title card") is one helper plus one command wrapper.

## Project file model

The source of truth for any video is a single `framewright.json` in the project
directory.

```jsonc
{
  "name": "Launch teaser",
  "slug": "launch-teaser",
  "createdAt": "2026-05-14T00:00:00.000Z",
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "scenes": [
    { "id": "scene-01", "kind": "title",    "text": "We built it.",     "durationMs": 2500 },
    { "id": "scene-02", "kind": "caption",  "text": "Off-market deals", "durationMs": 2000 }
  ]
}
```

Six scene kinds today: `title`, `caption`, `voiceover`, `website-capture`,
`image`, `custom` (see the `SceneKind` union in `src/lib/project.ts`).

Why JSON and not a higher-level DSL:

- Diffable in git. Code review and bisect work normally.
- AI-editable. Claude Code can read it, modify it, write it back. No grammar.
- Reviewable. A human can scan twenty scenes in fifteen seconds.

Every write goes through `saveProject` then `ensureHyperframesScaffold`, which
regenerates `.hyperframes/index.html` from the project. The HTML is a
derivative artifact; it can be deleted at any time and the next save rebuilds
it. The JSON is what you keep.

The composition HTML it generates is intentionally minimal — one `<div class="stage">`,
one `<section class="scene">` per scene with `data-start` / `data-end` in
milliseconds, plus a five-line `hf-seek` listener that toggles the `.active`
class. That gives HyperFrames a deterministic, seekable timeline without
locking us to any specific animation library — skills can layer GSAP, anime.js,
Lottie, or raw Web Animations on top.

## Dual entry mode

`src/index.ts` is intentionally thin. It does three things and nothing else:

1. Build a `commander` program.
2. Register subcommands (`new`, `list`, `add`, `script`, `preview`, `render`,
   `clone`) that delegate to a single function per command in `headless.ts`.
3. Register a hidden default command that opens `runInteractive()` from
   `interactive.ts` (the `@clack/prompts` menu).

This buys two things at once:

- **Humans get a guided menu.** Running `fw` with no args launches the figlet
  banner and the prompt loop — discoverable, no flags to memorize.
- **Scripts and CI get clean subcommands.** `fw new`, `fw script`,
  `fw clone <url>` are pipe-friendly, exit-code-honest, and `--json`-aware.
  No interactive prompts, no TTY assumptions.

Both modes share the same underlying primitives (`saveProject`,
`ensureHyperframesScaffold`, `runClaude`, `runHyperframes`). Interactive mode
just wraps them in `@clack/prompts`; headless mode wraps them in arg parsing
and a `die(msg)` helper that writes to stderr and exits non-zero.

## Why these choices

**Commander, not citty / yargs / oclif.** commander is the most-installed
Node CLI library, the API is stable, and the typings are accurate. Most
contributors have used it before. citty is younger and changes more often;
oclif is overkill for ~7 subcommands; yargs has a noisier API. commander
keeps `index.ts` short and obvious.

**ESM + Node 20+.** `@clack/prompts` and `execa@9` are ESM-only. Node 20 is
the current LTS and the lowest version where ESM, top-level await, and the
modern `fetch` work without flags. Going below 20 would force `require()`
hacks and reintroduce CommonJS interop bugs.

**`.js` import extensions in TS source.** TypeScript's ESM output preserves
import paths verbatim. Writing `from './lib/project.js'` in `.ts` source
compiles correctly and runs under Node's ESM loader. Skipping the extension
breaks the build at runtime.

**`@clack/prompts` for the menu.** Small surface, no theming knobs to fight,
matches modern terminal UX (Bun, Astro, Nuxt). Cancellable cleanly with
`isCancel`. The figlet banner runs once on entry and the rest is `clack`.

**execa for subprocesses.** Promise-returning, kills child trees on signal,
buffers + streams when needed, and the typings are honest about the difference
between exit-code failures and thrown errors. Both `runClaude` and
`runHyperframes` lean on it.

## What lives where, in one sentence each

- `src/index.ts` — commander entry, dispatches to interactive or headless.
- `src/interactive.ts` — `@clack/prompts` menu loop.
- `src/headless.ts` — one exported function per subcommand.
- `src/banner.ts` — figlet ASCII intro.
- `src/lib/project.ts` — `framewright.json` model, types, IO.
- `src/lib/claude.ts` — `claude -p` wrapper + typed skill bridges.
- `src/lib/hyperframes.ts` — `hyperframes` execa wrapper + composition HTML.
- `src/commands/*.ts` — `@clack/prompts` wrappers used by interactive mode.
