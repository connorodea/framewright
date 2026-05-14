import { describe, expect, it } from 'vitest';
import {
  slugify,
  nextSceneId,
  totalDurationMs,
  newProject,
  summarizeScene,
  projectPath,
  projectDir,
  type FramewrightProject,
  type Scene,
} from '../src/lib/project.js';

function makeProject(scenes: Scene[] = []): FramewrightProject {
  return {
    name: 'Demo',
    slug: 'demo',
    createdAt: '2026-05-01T00:00:00.000Z',
    width: 1080,
    height: 1920,
    fps: 30,
    scenes,
  };
}

describe('slugify', () => {
  it('lowercases and replaces punctuation/spaces with hyphens', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });

  it('collapses runs of non-alphanumeric characters', () => {
    expect(slugify('foo   bar___baz')).toBe('foo-bar-baz');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('---weird---name---')).toBe('weird-name');
  });

  it('drops unicode characters (no transliteration)', () => {
    // The current implementation strips non-ASCII letters entirely.
    expect(slugify('Café Déjà Vu')).toBe('caf-d-j-vu');
  });

  it('handles emoji and other non-ASCII by replacing them with hyphens', () => {
    expect(slugify('rocket  launch')).toBe('rocket-launch');
  });

  it('caps length at 60 characters', () => {
    const long = 'a'.repeat(120);
    expect(slugify(long)).toHaveLength(60);
  });

  it('returns an empty string for input with no alphanumerics', () => {
    expect(slugify('!!!---***')).toBe('');
  });
});

describe('nextSceneId', () => {
  it('returns scene-01 for an empty project', () => {
    expect(nextSceneId(makeProject([]))).toBe('scene-01');
  });

  it('pads two-digit ids', () => {
    const scenes: Scene[] = Array.from({ length: 8 }, (_, i) => ({
      id: `scene-${String(i + 1).padStart(2, '0')}`,
      kind: 'title' as const,
      durationMs: 1000,
    }));
    expect(nextSceneId(makeProject(scenes))).toBe('scene-09');
  });

  it('still pads to width 2 once you hit 10+ scenes', () => {
    const scenes: Scene[] = Array.from({ length: 12 }, (_, i) => ({
      id: `scene-${i + 1}`,
      kind: 'caption' as const,
      durationMs: 1000,
    }));
    // 13th scene -> "scene-13" (padStart(2) does not truncate)
    expect(nextSceneId(makeProject(scenes))).toBe('scene-13');
  });
});

describe('totalDurationMs', () => {
  it('returns 0 for a project with no scenes', () => {
    expect(totalDurationMs(makeProject([]))).toBe(0);
  });

  it('sums scene durations', () => {
    const scenes: Scene[] = [
      { id: 'scene-01', kind: 'title', durationMs: 1500 },
      { id: 'scene-02', kind: 'caption', durationMs: 2500 },
      { id: 'scene-03', kind: 'voiceover', durationMs: 4000 },
    ];
    expect(totalDurationMs(makeProject(scenes))).toBe(8000);
  });
});

describe('newProject', () => {
  it('builds a project with sensible defaults', () => {
    const before = Date.now();
    const p = newProject({ name: 'My Cool Video', width: 1080, height: 1920, fps: 30 });
    const after = Date.now();

    expect(p.name).toBe('My Cool Video');
    expect(p.slug).toBe('my-cool-video');
    expect(p.width).toBe(1080);
    expect(p.height).toBe(1920);
    expect(p.fps).toBe(30);
    expect(p.scenes).toEqual([]);
    expect(p.voiceDefault).toBeUndefined();
    expect(p.hyperframesProjectDir).toBeUndefined();

    const created = Date.parse(p.createdAt);
    expect(created).toBeGreaterThanOrEqual(before);
    expect(created).toBeLessThanOrEqual(after);
  });
});

describe('summarizeScene', () => {
  it('renders id, kind, and duration in seconds', () => {
    const s: Scene = { id: 'scene-01', kind: 'title', durationMs: 1500 };
    expect(summarizeScene(s)).toBe('[scene-01] title · 1.5s');
  });

  it('appends scene text when present, truncated to 60 chars', () => {
    const long = 'a'.repeat(100);
    const s: Scene = { id: 'scene-02', kind: 'caption', durationMs: 2000, text: long };
    const out = summarizeScene(s);
    expect(out.startsWith('[scene-02] caption · 2.0s — ')).toBe(true);
    // Body is sliced to 60 chars.
    expect(out.endsWith('a'.repeat(60))).toBe(true);
  });

  it('falls back to url, then imagePath, then notes when text is missing', () => {
    const url: Scene = { id: 'scene-03', kind: 'website-capture', durationMs: 3000, url: 'https://example.com' };
    expect(summarizeScene(url)).toContain('https://example.com');

    const img: Scene = { id: 'scene-04', kind: 'image', durationMs: 3000, imagePath: '/tmp/x.png' };
    expect(summarizeScene(img)).toContain('/tmp/x.png');

    const notes: Scene = { id: 'scene-05', kind: 'custom', durationMs: 3000, notes: 'do the thing' };
    expect(summarizeScene(notes)).toContain('do the thing');
  });

  it('omits the body separator when nothing to summarize', () => {
    const s: Scene = { id: 'scene-06', kind: 'custom', durationMs: 1000 };
    expect(summarizeScene(s)).toBe('[scene-06] custom · 1.0s');
  });
});

describe('projectPath / projectDir', () => {
  it('projectPath resolves framewright.json under the given dir', () => {
    const p = projectPath('/tmp/foo');
    expect(p.endsWith('/framewright.json')).toBe(true);
    expect(p).toContain('/tmp/foo');
  });

  it('projectDir joins cwd and slug', () => {
    expect(projectDir('/tmp', 'demo')).toBe('/tmp/demo');
  });
});
