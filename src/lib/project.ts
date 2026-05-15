import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { constants } from 'node:fs';

export type SceneKind =
  | 'title'
  | 'caption'
  | 'voiceover'
  | 'website-capture'
  | 'image'
  | 'custom';

export interface Scene {
  id: string;
  kind: SceneKind;
  durationMs: number;
  text?: string;
  voice?: string;
  url?: string;
  imagePath?: string;
  notes?: string;
}

export interface FramewrightProject {
  name: string;
  slug: string;
  createdAt: string;
  width: number;
  height: number;
  fps: number;
  scenes: Scene[];
  // Monotonic counter that never decreases. Scene IDs come from this and are
  // never reused — so `fw edit scene-03 ...` stays valid even after a reorder
  // or remove. Older projects without this field fall back to scenes.length + 1.
  nextSceneNumber?: number;
  voiceDefault?: string;
  hyperframesProjectDir?: string;
}

const FILE_NAME = 'framewright.json';

export function projectPath(dir: string): string {
  return resolve(dir, FILE_NAME);
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function loadProject(dir: string): Promise<FramewrightProject> {
  const path = projectPath(dir);
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as FramewrightProject;
}

export async function saveProject(
  dir: string,
  project: FramewrightProject,
): Promise<void> {
  const path = projectPath(dir);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(project, null, 2) + '\n', 'utf8');
}

/**
 * Allocate the next scene id. **Mutates `project.nextSceneNumber`** — callers
 * must `saveProject` afterwards. IDs are monotonic and never reused, so
 * `fw edit scene-03 ...` stays valid across reorder/remove/duplicate.
 *
 * Legacy projects (created before `nextSceneNumber` existed) bootstrap the
 * counter from the highest existing `scene-NN` id, or fall back to
 * `scenes.length + 1` if no IDs are parseable.
 */
export function nextSceneId(project: FramewrightProject): string {
  if (project.nextSceneNumber === undefined) {
    const highest = project.scenes.reduce((max, s) => {
      const m = /^scene-(\d+)$/.exec(s.id);
      if (!m) return max;
      const n = Number(m[1]);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    project.nextSceneNumber = Math.max(highest, project.scenes.length) + 1;
  } else {
    project.nextSceneNumber += 1;
  }
  return `scene-${String(project.nextSceneNumber).padStart(2, '0')}`;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function newProject(opts: {
  name: string;
  width: number;
  height: number;
  fps: number;
}): FramewrightProject {
  return {
    name: opts.name,
    slug: slugify(opts.name),
    createdAt: new Date().toISOString(),
    width: opts.width,
    height: opts.height,
    fps: opts.fps,
    scenes: [],
    nextSceneNumber: 0,
  };
}

export function totalDurationMs(project: FramewrightProject): number {
  return project.scenes.reduce((sum, s) => sum + s.durationMs, 0);
}

export function summarizeScene(s: Scene): string {
  const dur = `${(s.durationMs / 1000).toFixed(1)}s`;
  const head = `[${s.id}] ${s.kind} · ${dur}`;
  const body = s.text ?? s.url ?? s.imagePath ?? s.notes ?? '';
  return body ? `${head} — ${body.slice(0, 60)}` : head;
}

export function projectDir(cwd: string, slug: string): string {
  return join(cwd, slug);
}
