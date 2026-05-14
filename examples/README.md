# framewright examples

Three ready-to-render starter projects. Each one is a complete
`framewright.json` — copy a directory, change the words, render the video.

| Example | Aspect | Length | Use case |
|---|---|---|---|
| [`launch-teaser/`](./launch-teaser) | 1080×1920 (vertical) | ~25s | Announcing a new SaaS product. Punchy, founder-voice copy. Drop it on X / TikTok / IG Reels. |
| [`b2b-explainer/`](./b2b-explainer) | 1920×1080 (landscape) | ~45s | Explaining a B2B SaaS to a buyer who's never heard of you. Measured tone, heavier on voiceover, includes a `website-capture` scene. |
| [`meme-social/`](./meme-social) | 1080×1080 (square) | ~17s | Developer-humor meme video about your codebase. Lean into the joke. Includes `custom` scenes with `notes` describing the visual gag. |

## How to use one

```bash
cp -r examples/launch-teaser my-launch
cd my-launch
fw list                    # see the scenes
fw script "..." --append   # let Claude add more
fw preview                 # see it render
fw render --out demo.mp4
```

That's it. Every example is just a `framewright.json` — the
`.hyperframes/index.html` gets regenerated the first time you save, preview, or
render, so you don't need to ship it in the repo.

## Editing tips

- **Change the words first, the scenes second.** The copy is what makes the
  video feel like yours. Open `framewright.json` and rewrite the `text` fields
  before you start adding scenes.
- **Let Claude do the heavy lifting.** `fw script "30-second pitch for my
  thing" --append` will keep the existing scenes and bolt new ones on the end.
- **`scene.id` must stay padded.** If you reorder by hand, keep the IDs as
  `scene-01`, `scene-02`, … — most of the CLI assumes that format. Easier: run
  `fw add` / let the CLI manage IDs.
- **`durationMs` is in milliseconds.** A 2.5-second scene is `2500`, not `2.5`.

## Want to contribute an example?

Open a PR. Stick to the shape these three follow: one focused use case per
example, real copy (not Lorem Ipsum), and a total runtime that matches how the
format is actually used in the wild.
