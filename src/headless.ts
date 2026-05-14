import color from 'picocolors';
import { join, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import {
  exists,
  loadProject,
  newProject,
  nextSceneId,
  projectDir,
  projectPath,
  saveProject,
  slugify,
  summarizeScene,
  totalDurationMs,
  type FramewrightProject,
  type Scene,
  type SceneKind,
} from './lib/project.js';
import {
  ensureHyperframesScaffold,
  runHyperframes,
} from './lib/hyperframes.js';
import {
  captureWebsiteViaSkill,
  generateScript,
  hasClaudeCode,
} from './lib/claude.js';

const PRESETS: Record<string, [number, number]> = {
  vertical: [1080, 1920],
  landscape: [1920, 1080],
  square: [1080, 1080],
  '720p': [1280, 720],
};

function die(msg: string, code = 1): never {
  process.stderr.write(color.red(`error: ${msg}\n`));
  process.exit(code);
}

function log(msg: string): void {
  process.stdout.write(msg + '\n');
}

async function resolveProject(cwd: string): Promise<{ dir: string; project: FramewrightProject }> {
  if (!(await exists(projectPath(cwd)))) {
    die(`no framewright.json in ${cwd}. Run \`fw new <name>\` first or cd into a project.`);
  }
  return { dir: cwd, project: await loadProject(cwd) };
}

// ---------------------------------------------------------------- fw new

export interface NewOpts {
  preset?: string;
  width?: string;
  height?: string;
  fps?: string;
  force?: boolean;
}

export async function headlessNew(name: string, opts: NewOpts, cwd: string): Promise<void> {
  let width: number;
  let height: number;
  if (opts.preset) {
    const p = PRESETS[opts.preset];
    if (!p) die(`unknown preset "${opts.preset}". Valid: ${Object.keys(PRESETS).join(', ')}`);
    [width, height] = p;
  } else if (opts.width && opts.height) {
    width = Number(opts.width);
    height = Number(opts.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      die('--width and --height must be positive integers');
    }
  } else {
    [width, height] = PRESETS.vertical!;
  }
  const fps = opts.fps ? Number(opts.fps) : 30;
  if (!Number.isFinite(fps) || fps <= 0) die('--fps must be a positive integer');

  const slug = slugify(name);
  const dir = projectDir(cwd, slug);
  if ((await exists(projectPath(dir))) && !opts.force) {
    die(`project already exists at ${dir} (use --force to overwrite)`);
  }
  const project = newProject({ name, width, height, fps });
  await saveProject(dir, project);
  await ensureHyperframesScaffold(project, dir);
  log(`${color.green('created')} ${slug}  ${color.dim(`${width}x${height} @ ${fps}fps`)}`);
  log(`         ${color.dim(dir)}`);
}

// ---------------------------------------------------------------- fw list

export interface ListOpts {
  json?: boolean;
}

export async function headlessList(opts: ListOpts, cwd: string): Promise<void> {
  const { project } = await resolveProject(cwd);
  if (opts.json) {
    process.stdout.write(JSON.stringify(project, null, 2) + '\n');
    return;
  }
  if (project.scenes.length === 0) {
    log(color.dim('(no scenes yet)'));
    return;
  }
  for (const s of project.scenes) log(summarizeScene(s));
  const total = (totalDurationMs(project) / 1000).toFixed(1);
  log(color.dim(`total: ${total}s · ${project.scenes.length} scene(s)`));
}

// ---------------------------------------------------------------- fw add

export interface AddOpts {
  text?: string;
  url?: string;
  image?: string;
  duration?: string;
  voice?: string;
}

const VALID_KINDS = new Set<SceneKind>([
  'title',
  'caption',
  'voiceover',
  'website-capture',
  'image',
  'custom',
]);

export async function headlessAdd(kind: string, opts: AddOpts, cwd: string): Promise<void> {
  if (!VALID_KINDS.has(kind as SceneKind)) {
    die(`unknown scene kind "${kind}". Valid: ${[...VALID_KINDS].join(', ')}`);
  }
  const { dir, project } = await resolveProject(cwd);
  const durationSec = opts.duration ? Number(opts.duration) : 3;
  if (!Number.isFinite(durationSec) || durationSec <= 0) die('--duration must be a positive number');

  const scene: Scene = {
    id: nextSceneId(project),
    kind: kind as SceneKind,
    durationMs: Math.round(durationSec * 1000),
  };
  if (kind === 'website-capture') {
    if (!opts.url) die('--url required for website-capture');
    scene.url = opts.url;
  } else if (kind === 'image') {
    if (!opts.image) die('--image required for image scene');
    scene.imagePath = opts.image;
  } else if (kind === 'custom') {
    scene.notes = opts.text ?? '';
  } else {
    if (!opts.text) die(`--text required for ${kind}`);
    scene.text = opts.text;
  }
  if (kind === 'voiceover' && opts.voice) scene.voice = opts.voice;

  project.scenes.push(scene);
  await saveProject(dir, project);
  await ensureHyperframesScaffold(project, dir);
  log(`${color.green('added')} ${scene.id}  ${kind}  ${(scene.durationMs / 1000).toFixed(1)}s`);
}

// ---------------------------------------------------------------- fw script

export interface ScriptOpts {
  tone?: string;
  duration?: string;
  append?: boolean;
  json?: boolean;
}

export async function headlessScript(topic: string, opts: ScriptOpts, cwd: string): Promise<void> {
  if (!(await hasClaudeCode())) die('claude CLI not found on PATH');
  const { dir, project } = await resolveProject(cwd);
  const tone = opts.tone ?? 'punchy founder';
  const targetDurationSec = opts.duration ? Number(opts.duration) : 20;
  if (!Number.isFinite(targetDurationSec) || targetDurationSec <= 0) {
    die('--duration must be a positive number');
  }

  const script = await generateScript({
    topic,
    tone,
    targetDurationSec,
    project,
    cwd: dir,
  });

  if (!opts.append) project.scenes = [];
  for (const gs of script.scenes) {
    project.scenes.push({
      id: nextSceneId(project),
      kind: gs.kind,
      durationMs: gs.durationMs,
      text: gs.text,
    });
  }
  await saveProject(dir, project);
  await ensureHyperframesScaffold(project, dir);

  if (opts.json) {
    process.stdout.write(JSON.stringify(script, null, 2) + '\n');
    return;
  }
  for (const s of script.scenes) {
    log(`${color.cyan(s.kind.padEnd(9))} ${(s.durationMs / 1000).toFixed(1)}s  ${s.text}`);
  }
}

// ---------------------------------------------------------------- fw preview

export async function headlessPreview(cwd: string): Promise<void> {
  const { dir, project } = await resolveProject(cwd);
  await ensureHyperframesScaffold(project, dir);
  const { exitCode, stderr } = await runHyperframes(
    ['preview', '.hyperframes/index.html'],
    dir,
  );
  if (exitCode !== 0) die(stderr || `hyperframes preview exited ${exitCode}`);
}

// ---------------------------------------------------------------- fw render

export interface RenderOpts {
  format?: 'mp4' | 'webm' | 'gif';
  out?: string;
}

export async function headlessRender(opts: RenderOpts, cwd: string): Promise<void> {
  const { dir, project } = await resolveProject(cwd);
  if (project.scenes.length === 0) die('no scenes to render');
  const format = opts.format ?? 'mp4';
  const outPath = opts.out
    ? resolve(opts.out)
    : join(dir, 'renders', `${project.slug}-${Date.now()}.${format}`);
  await mkdir(join(outPath, '..'), { recursive: true });
  await ensureHyperframesScaffold(project, dir);

  log(color.dim(`rendering → ${outPath}`));
  const { exitCode, stderr } = await runHyperframes(
    ['render', '.hyperframes/index.html', '--out', outPath, '--fps', String(project.fps)],
    dir,
  );
  if (exitCode !== 0) die(stderr || `hyperframes render exited ${exitCode}`);
  log(`${color.green('rendered')} ${outPath}`);
}

// ---------------------------------------------------------------- fw clone

export interface CloneOpts {
  duration?: string;
  out?: string;
  format?: 'mp4' | 'webm' | 'gif';
  name?: string;
  tone?: string;
  noRender?: boolean;
}

/**
 * One-shot: take a URL → ephemeral framewright project → website-capture scene
 * + Claude-Code-generated script → render. Lives off the website-to-hyperframes
 * + hyperframes-media skills entirely; framewright just orchestrates.
 */
export async function headlessClone(url: string, opts: CloneOpts, cwd: string): Promise<void> {
  if (!(await hasClaudeCode())) die('claude CLI not found on PATH');
  if (!/^https?:\/\//.test(url)) die('url must start with http(s)://');

  const durationSec = opts.duration ? Number(opts.duration) : 20;
  if (!Number.isFinite(durationSec) || durationSec <= 0) die('--duration must be a positive number');
  const captureSec = Math.min(6, Math.max(3, Math.round(durationSec * 0.25)));

  const hostFromUrl = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return 'clone';
    }
  })();
  const name = opts.name ?? `${hostFromUrl}-${new Date().toISOString().slice(0, 10)}`;
  const slug = slugify(name);
  const dir = projectDir(cwd, slug);

  log(color.dim(`[1/4] scaffolding ${slug} in ${dir}`));
  const project = newProject({ name, width: 1080, height: 1920, fps: 30 });
  await saveProject(dir, project);
  await ensureHyperframesScaffold(project, dir);

  log(color.dim(`[2/4] generating script with Claude Code (~${durationSec}s)`));
  const script = await generateScript({
    topic: `30-second teaser for the website ${url}`,
    tone: opts.tone ?? 'punchy founder',
    targetDurationSec: durationSec,
    project,
    cwd: dir,
  });
  for (const gs of script.scenes) {
    project.scenes.push({
      id: nextSceneId(project),
      kind: gs.kind,
      durationMs: gs.durationMs,
      text: gs.text,
    });
  }
  // Insert a website-capture scene at position 2 (after the title) so the
  // viewer sees the actual product within the first beat.
  const captureScene: Scene = {
    id: nextSceneId(project),
    kind: 'website-capture',
    durationMs: captureSec * 1000,
    url,
  };
  const insertAt = Math.min(1, project.scenes.length);
  project.scenes.splice(insertAt, 0, captureScene);
  // Re-id everything after the splice so ids stay monotonic.
  project.scenes = project.scenes.map((s, i) => ({
    ...s,
    id: `scene-${String(i + 1).padStart(2, '0')}`,
  }));
  await saveProject(dir, project);
  await ensureHyperframesScaffold(project, dir);
  log(color.dim(`        ${project.scenes.length} scene(s), ${(totalDurationMs(project) / 1000).toFixed(1)}s total`));

  log(color.dim('[3/4] invoking website-to-hyperframes skill'));
  const cap = await captureWebsiteViaSkill({
    url,
    durationMs: captureScene.durationMs,
    projectDir: dir,
  });
  if (!cap.ok) {
    log(color.yellow('        skill invocation reported failure — continuing with static composition'));
    log(color.dim('        (' + cap.log.slice(-300).replace(/\n+/g, ' ') + ')'));
  }

  if (opts.noRender) {
    log(`${color.green('done')} project ready at ${dir}`);
    log(color.dim(`        next: cd ${slug} && fw render`));
    return;
  }

  log(color.dim('[4/4] rendering'));
  const format = opts.format ?? 'mp4';
  const outPath = opts.out
    ? resolve(opts.out)
    : join(dir, 'renders', `${slug}.${format}`);
  await mkdir(join(outPath, '..'), { recursive: true });
  const { exitCode, stderr } = await runHyperframes(
    ['render', '.hyperframes/index.html', '--out', outPath, '--fps', String(project.fps)],
    dir,
  );
  if (exitCode !== 0) {
    die(stderr || `hyperframes render exited ${exitCode}`);
  }
  log(`${color.green('done')} → ${outPath}`);
}
