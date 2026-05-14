import { describe, expect, it } from 'vitest';
import { buildCompositionHtml } from '../src/lib/hyperframes.js';
import type { FramewrightProject } from '../src/lib/project.js';

function fixtureProject(): FramewrightProject {
  return {
    name: 'Snapshot Demo',
    slug: 'snapshot-demo',
    createdAt: '2026-05-01T00:00:00.000Z',
    width: 1080,
    height: 1920,
    fps: 30,
    scenes: [
      {
        id: 'scene-01',
        kind: 'title',
        durationMs: 2000,
        text: 'Hello World',
      },
      {
        id: 'scene-02',
        kind: 'caption',
        durationMs: 3000,
        text: 'A caption with <html> & "quotes"',
      },
      {
        id: 'scene-03',
        kind: 'voiceover',
        durationMs: 4500,
        text: "Voiceover line: it's narrated.",
      },
    ],
  };
}

describe('buildCompositionHtml', () => {
  it('includes the canvas dimensions, fps, and total duration', () => {
    const html = buildCompositionHtml(fixtureProject());
    expect(html).toContain('width: 1080px');
    expect(html).toContain('height: 1920px');
    expect(html).toContain('data-hf-duration="9500"');
    expect(html).toContain('data-hf-fps="30"');
  });

  it('renders one section per scene with start/end timecodes', () => {
    const html = buildCompositionHtml(fixtureProject());
    // scene-01: 0..2000
    expect(html).toContain('data-start="0" data-end="2000"');
    // scene-02: 2000..5000
    expect(html).toContain('data-start="2000" data-end="5000"');
    // scene-03: 5000..9500
    expect(html).toContain('data-start="5000" data-end="9500"');
  });

  it('emits scene-kind class names for styling', () => {
    const html = buildCompositionHtml(fixtureProject());
    expect(html).toContain('class="scene title"');
    expect(html).toContain('class="scene caption"');
    expect(html).toContain('class="scene voiceover"');
  });

  it('contains the scene text content', () => {
    const html = buildCompositionHtml(fixtureProject());
    expect(html).toContain('Hello World');
    expect(html).toContain('Voiceover line:');
  });

  it('html-escapes user-controlled scene text', () => {
    const html = buildCompositionHtml(fixtureProject());
    expect(html).toContain('A caption with &lt;html&gt; &amp; &quot;quotes&quot;');
    expect(html).not.toContain('<html>');
    expect(html).toContain('it&#39;s narrated.');
  });

  it('html-escapes the project name in the <title>', () => {
    const p = fixtureProject();
    p.name = 'Tom & Jerry <Live>';
    const html = buildCompositionHtml(p);
    expect(html).toContain('<title>Tom &amp; Jerry &lt;Live&gt;</title>');
  });

  it('falls back to a 5000ms duration when there are no scenes', () => {
    const empty: FramewrightProject = { ...fixtureProject(), scenes: [] };
    const html = buildCompositionHtml(empty);
    expect(html).toContain('data-hf-duration="5000"');
  });

  it('falls back to scene.url / notes / kind when text is absent', () => {
    const p: FramewrightProject = {
      ...fixtureProject(),
      scenes: [
        { id: 'a', kind: 'website-capture', durationMs: 1000, url: 'https://example.com' },
        { id: 'b', kind: 'custom', durationMs: 1000, notes: 'some notes' },
        { id: 'c', kind: 'image', durationMs: 1000 },
      ],
    };
    const html = buildCompositionHtml(p);
    expect(html).toContain('https://example.com');
    expect(html).toContain('some notes');
    // No text/url/notes -> kind name leaks through.
    expect(html).toContain('>image<');
  });

  it('matches the full structural snapshot (regression gate)', () => {
    const html = buildCompositionHtml(fixtureProject());
    // Inline snapshot is the canonical regression gate for the composition
    // template — any change to markup, scripts, or escaping shows up here.
    expect(html).toMatchInlineSnapshot(`
      "<!doctype html>
      <html lang="en">
      <head>
      <meta charset="utf-8" />
      <title>Snapshot Demo</title>
      <style>
        :root { color-scheme: dark; }
        html, body { margin: 0; padding: 0; background: #0b0b10; color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; }
        .stage { position: relative; width: 1080px; height: 1920px; overflow: hidden; }
        .scene { position: absolute; inset: 0; display: flex; align-items: center;
          justify-content: center; opacity: 0; }
        .scene.active { opacity: 1; }
        .scene .text { font-size: 64px; font-weight: 700; text-align: center;
          max-width: 80%; line-height: 1.1; }
        .scene.caption .text { font-size: 48px; }
        .scene.voiceover .text { font-size: 36px; opacity: 0.85; }
      </style>
      </head>
      <body>
      <div class="stage" data-hf-duration="9500" data-hf-fps="30">
        <section class="scene title" data-start="0" data-end="2000"><div class="text">Hello World</div></section>
        <section class="scene caption" data-start="2000" data-end="5000"><div class="text">A caption with &lt;html&gt; &amp; &quot;quotes&quot;</div></section>
        <section class="scene voiceover" data-start="5000" data-end="9500"><div class="text">Voiceover line: it&#39;s narrated.</div></section>
      </div>
      <script>
        // framewright -> hyperframes seek bridge.
        // Each scene fades in during its time window. Hyperframes drives currentTime
        // via hf-seek events; we listen and toggle the .active class.
        const stage = document.querySelector('.stage');
        const scenes = Array.from(document.querySelectorAll('.scene'));
        function applyTime(t) {
          for (const el of scenes) {
            const start = Number(el.dataset.start);
            const end = Number(el.dataset.end);
            el.classList.toggle('active', t >= start && t < end);
          }
        }
        window.addEventListener('hf-seek', (e) => applyTime(e.detail.timeMs));
        applyTime(0);
      </script>
      </body>
      </html>
      "
    `);
  });
});
