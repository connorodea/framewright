# Contributing

Thanks for taking the time. framewright is a small, opinionated CLI — short
PRs, narrow scope, and matching the existing style go a long way.

## Prerequisites

- **Node 20+.** `@clack/prompts` and `execa@9` are ESM-only and require it.
- **`claude` CLI on `PATH`.** Install Claude Code from
  https://docs.claude.com/claude-code. framewright shells out to `claude -p`;
  Claude Code handles its own auth.
- **(optional) `hyperframes` installed via skills.** For preview/render to
  work, install the HyperFrames skill so Claude Code can drive it. Standalone
  HyperFrames CLI is shelled via `npx --yes hyperframes` by default.

## Dev loop

```bash
git clone https://github.com/connorodea/framewright.git
cd framewright
npm install
npm run dev        # tsx src/index.ts (fast iteration, no build step)
npm run typecheck  # tsc --noEmit
npm run build      # tsc → dist/
node dist/index.js # smoke-test the compiled binary
```

A `npm test` (vitest) script is on the roadmap and may not exist on `main`
yet — once it lands, run it before pushing. The CI in
`.github/workflows/ci.yml` runs typecheck + build on Node 20 and 22.

## Branch naming

Branch off the latest `main`. Use one of:

- `feat/<short-slug>` — new feature
- `fix/<short-slug>` — bug fix
- `chore/<short-slug>` — tooling, deps, refactors with no behavior change
- `docs/<short-slug>` — README / ARCHITECTURE / CHANGELOG / inline doc only
- `test/<short-slug>` — test-only changes

## Commit format

[Conventional commits](https://www.conventionalcommits.org). Header is
`<type>: <short summary>` in the imperative mood, under ~72 chars.

```
feat: add theme command
fix: handle empty scenes array in render
chore: bump execa to 9.5
docs: add architecture diagram
test: cover slugify edge cases
```

Multi-paragraph bodies are welcome when the "why" needs explanation. Don't
amend or rewrite already-pushed commits — open a new commit on top.

## Pull requests

- PRs target `main`. **Never push directly to `main`.**
- Run `npm run typecheck` and `npm run build` (and `npm test` once vitest
  lands) before pushing.
- Keep PRs scoped — one feature or fix per PR.
- PR description should cover: what changed, why, any risks or edge cases,
  and how to test.
- Do not merge your own PR unless explicitly invited to.

## How to add a new scene kind

1. Add the new literal to the `SceneKind` union in `src/lib/project.ts`.
2. Teach `src/commands/addScene.ts` how to collect the new fields
   interactively (text? duration? URL? image? something else?).
3. Teach `src/headless.ts` how to accept the new kind from
   `fw add <kind> --…` flags (extend `VALID_KINDS` and the field-collection
   branch in `headlessAdd`).
4. Teach `src/lib/hyperframes.ts` how to render it — extend `sceneToHtml`
   (or add a new helper) so `buildCompositionHtml` emits the right markup.
5. Update `README.md` (the subcommand table and example JSON) and
   `ARCHITECTURE.md` (the "six scene kinds" sentence becomes seven).
6. Add a CHANGELOG entry under `[Unreleased] / Added`.

## How to wire a new Claude Code skill

The pattern in `src/lib/claude.ts` is one helper per skill. To add a new one:

1. Write a thin wrapper in `src/lib/claude.ts` that builds a prompt naming the
   skill's trigger phrase and calls `runClaude({ … })`. Use the existing
   `captureWebsiteViaSkill` / `generateVoiceoverViaSkill` as templates.
2. Add a command wrapper under `src/commands/` for interactive use, and (if
   the action is scriptable) a subcommand in `src/index.ts` + a
   `headless<Name>` function in `src/headless.ts`.
3. That's it. You do not register skills with framewright. Claude Code's skill
   router picks the right one based on the trigger phrases in your prompt.

If your skill writes files into the project directory, pass `addDirs: [dir]`
and `permissionMode: 'acceptEdits'` to `runClaude` so Claude has write access
to the scaffold.

## Code style

- TypeScript strict mode. `npm run typecheck` must pass before pushing.
- ESM imports with `.js` extensions in `.ts` source (e.g.
  `from './lib/project.js'`). The compiled output needs them and Node's ESM
  loader rejects extensionless imports.
- Prefer editing existing files over adding new ones. Files in `src/` should
  earn their place — if a helper fits in `lib/project.ts`, put it there.
- Minimal comments. The codebase favors readable names and obvious control
  flow over narration. JSDoc on exported skill bridges is fine because it
  documents the contract; line-by-line "// now we do X" comments are not.
- Don't introduce a new dependency without a reason in the PR description.

## Reporting bugs / requesting features

Open a GitHub issue at https://github.com/connorodea/framewright/issues. For
bugs, include: framewright version (`fw --version`), Node version, the exact
command you ran, and the stderr output. For feature requests, describe the
end-to-end user flow you want, not the implementation you have in mind.
