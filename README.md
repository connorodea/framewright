# framewright

> Interactive CLI for crafting AI videos from your terminal.
> Powered by [@clack/prompts](https://github.com/bombshell-dev/clack),
> [HyperFrames](https://github.com/heygen-com/hyperframes), and
> [Claude Code](https://docs.claude.com/claude-code) — which auto-loads your
> installed skills (`hyperframes`, `website-to-hyperframes`, `hyperframes-media`,
> `lottie`, `gsap`, `animejs`, …) and lets them do the heavy lifting.

```
███████╗██████╗  █████╗ ███╗   ███╗███████╗██╗    ██╗██████╗ ██╗ ██████╗ ██╗  ██╗████████╗
██╔════╝██╔══██╗██╔══██╗████╗ ████║██╔════╝██║    ██║██╔══██╗██║██╔════╝ ██║  ██║╚══██╔══╝
█████╗  ██████╔╝███████║██╔████╔██║█████╗  ██║ █╗ ██║██████╔╝██║██║  ███╗███████║   ██║
██╔══╝  ██╔══██╗██╔══██║██║╚██╔╝██║██╔══╝  ██║███╗██║██╔══██╗██║██║   ██║██╔══██║   ██║
██║     ██║  ██║██║  ██║██║ ╚═╝ ██║███████╗╚███╔███╔╝██║  ██║██║╚██████╔╝██║  ██║   ██║
╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝ ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝
```

## What it does

- Scaffolds a HyperFrames-compatible composition from interactive prompts.
- Calls Claude to generate a structured video script (title / caption / voiceover scenes).
- Manages scenes as plain JSON — diffable, reviewable, AI-editable.
- Wraps `hyperframes preview` and `hyperframes render` so you never leave the CLI.
- Supports website-capture scenes (powered by the `website-to-hyperframes` skill).

## Install

```bash
npm install -g framewright
# or run on demand
npx framewright
```

For local development:

```bash
git clone https://github.com/connorodea/framewright.git
cd framewright
npm install
npm run build
node dist/index.js
```

## Setup

framewright shells out to the `claude` CLI ([Claude Code](https://docs.claude.com/claude-code)).
Claude Code handles its own auth — no `ANTHROPIC_API_KEY` needed here.

Install the skills you want available to framewright (one-time):

```bash
# https://skills.sh/heygen-com/hyperframes
npx skills add heygen-com/hyperframes
```

Optional env overrides (copy `.env.example` → `.env` if you want them):

| Variable                 | Default                | Purpose                              |
|--------------------------|------------------------|--------------------------------------|
| `FRAMEWRIGHT_CLAUDE_BIN` | `claude`               | Pin a specific Claude Code binary    |
| `HYPERFRAMES_BIN`        | `npx --yes hyperframes`| Pin a specific HyperFrames invocation|

## Usage

```bash
cd ~/videos
framewright          # or `fw`
```

Inside the prompt menu:

1. **New project** — pick a name + canvas preset (vertical / landscape / square) + fps.
2. **Generate script with Claude Code** — topic + tone → multi-scene script.
3. **Add scene manually** — title / caption / voiceover / image / custom.
4. **Add website capture** — fires the `website-to-hyperframes` skill via Claude Code.
5. **Generate kokoro voiceover** — fires the `hyperframes-media` skill via Claude Code.
6. **Preview** — opens a HyperFrames preview window.
7. **Render** — outputs an mp4 / webm / gif into `./renders/`.

Each project is a folder with a `framewright.json` (your source of truth) and a `.hyperframes/index.html` that gets regenerated on every save.

### Project file format

```json
{
  "name": "Launch teaser",
  "slug": "launch-teaser",
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "scenes": [
    { "id": "scene-01", "kind": "title",    "text": "We built it.",         "durationMs": 2500 },
    { "id": "scene-02", "kind": "caption",  "text": "Off-market deals",     "durationMs": 2000 },
    { "id": "scene-03", "kind": "voiceover","text": "Here's how it works.", "durationMs": 4000 }
  ]
}
```

## Architecture

```
src/
  index.ts                  # @clack/prompts main loop, command router
  banner.ts                 # figlet ASCII intro
  lib/
    project.ts              # framewright.json read/write + types
    claude.ts               # `claude -p` subprocess wrapper (skills auto-load)
    hyperframes.ts          # execa wrapper + composition HTML builder
  commands/
    newProject.ts
    addScene.ts
    generateScript.ts       # → claude -p → scenes JSON
    captureWebsite.ts       # → website-to-hyperframes skill
    generateVoiceover.ts    # → hyperframes-media skill (kokoro TTS)
    listScenes.ts
    removeScene.ts
    preview.ts              # → hyperframes preview
    render.ts               # → hyperframes render
```

## How the skill bridge works

When you choose "Generate script with Claude Code", framewright runs:

```bash
claude -p "<prompt>" --output-format json --permission-mode bypassPermissions
```

Claude Code reads the prompt, matches trigger phrases against your installed
skill descriptions, and loads the relevant skills automatically. framewright
never hard-codes which skill to call — it just describes the goal and lets the
skill router pick the tool. That means newly-installed skills (lottie, three,
gsap, animejs) become available to framewright with zero code changes.

## Roadmap

The full phased plan — from initial CLI through `npm publish` and launch — lives in
[`ROADMAP.md`](./ROADMAP.md) and is mirrored as a Todoist project for active
development tracking.

## License

MIT © Connor O'Dea
