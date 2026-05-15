import type { Scene, SceneKind } from './project.js';

export interface TemplateSceneSpec {
  kind: Exclude<SceneKind, 'website-capture' | 'image'>;
  text: string;
  durationMs: number;
}

export interface SceneTemplate {
  name: string;
  description: string;
  scenes: TemplateSceneSpec[];
}

export const TEMPLATES: Record<string, SceneTemplate> = {
  hook: {
    name: 'hook',
    description: 'Three-beat opener — title, caption, voiceover lead-in.',
    scenes: [
      { kind: 'title', text: 'Wait — you can do this?', durationMs: 2200 },
      { kind: 'caption', text: 'In your terminal. In 30 seconds.', durationMs: 2000 },
      {
        kind: 'voiceover',
        text: "Here's the part everyone misses.",
        durationMs: 3000,
      },
    ],
  },
  demo: {
    name: 'demo',
    description: 'Four-beat product demo — title, two captions framing the value, voiceover wrap.',
    scenes: [
      { kind: 'title', text: 'Watch this.', durationMs: 1800 },
      { kind: 'caption', text: 'One command.', durationMs: 1800 },
      { kind: 'caption', text: 'Finished video.', durationMs: 2200 },
      { kind: 'voiceover', text: 'That was framewright running on your machine.', durationMs: 3500 },
    ],
  },
  cta: {
    name: 'cta',
    description: 'Two-beat call to action — caption + voiceover ask.',
    scenes: [
      { kind: 'caption', text: 'Your turn.', durationMs: 1500 },
      {
        kind: 'voiceover',
        text: 'Run npx framewright and ship one today.',
        durationMs: 3200,
      },
    ],
  },
  outro: {
    name: 'outro',
    description: 'Single-beat sign-off title card.',
    scenes: [
      { kind: 'title', text: 'framewright.dev', durationMs: 2500 },
    ],
  },
};

export function listTemplates(): SceneTemplate[] {
  return Object.values(TEMPLATES);
}

export function getTemplate(name: string): SceneTemplate | undefined {
  return TEMPLATES[name.toLowerCase()];
}

/**
 * Convert a template spec into concrete Scene objects given an id-allocator.
 * Pass the project's `nextSceneId(project)` as `nextId`; this is intentionally
 * a callback so callers control persistence + counter mutation.
 */
export function materializeTemplate(
  template: SceneTemplate,
  nextId: () => string,
): Scene[] {
  return template.scenes.map((spec) => ({
    id: nextId(),
    kind: spec.kind,
    durationMs: spec.durationMs,
    text: spec.text,
  }));
}

export function templateTotalMs(template: SceneTemplate): number {
  return template.scenes.reduce((sum, s) => sum + s.durationMs, 0);
}
