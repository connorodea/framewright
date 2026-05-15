import * as p from '@clack/prompts';
import color from 'picocolors';
import { join } from 'node:path';
import {
  exists,
  newProject,
  projectDir,
  projectPath,
  saveProject,
  slugify,
} from '../lib/project.js';
import { ensureHyperframesScaffold } from '../lib/hyperframes.js';

const PRESETS = [
  { value: '1080x1920', label: '1080x1920 · vertical (Shorts/Reels/TikTok)' },
  { value: '1920x1080', label: '1920x1080 · landscape (YouTube)' },
  { value: '1080x1080', label: '1080x1080 · square (Instagram feed)' },
  { value: '1280x720', label: '1280x720 · 720p landscape' },
  { value: 'custom', label: 'Custom dimensions' },
];

export async function cmdNew(cwd: string): Promise<string | null> {
  const name = await p.text({
    message: 'Project name',
    placeholder: 'my-launch-promo',
    validate: (v) => (v.length < 2 ? 'At least 2 characters' : undefined),
  });
  if (p.isCancel(name)) {
    p.cancel('Cancelled.');
    return null;
  }

  const presetChoice = await p.select({
    message: 'Canvas preset',
    options: PRESETS,
  });
  if (p.isCancel(presetChoice)) {
    p.cancel('Cancelled.');
    return null;
  }

  let width = 1080;
  let height = 1920;
  if (presetChoice === 'custom') {
    const w = await p.text({
      message: 'Width (px)',
      placeholder: '1080',
      validate: (v) => (/^\d+$/.test(v) ? undefined : 'Numbers only'),
    });
    if (p.isCancel(w)) {
      p.cancel('Cancelled.');
      return null;
    }
    const h = await p.text({
      message: 'Height (px)',
      placeholder: '1920',
      validate: (v) => (/^\d+$/.test(v) ? undefined : 'Numbers only'),
    });
    if (p.isCancel(h)) {
      p.cancel('Cancelled.');
      return null;
    }
    width = Number(w);
    height = Number(h);
  } else {
    const [w, h] = (presetChoice as string).split('x').map(Number);
    width = w!;
    height = h!;
  }

  const fpsChoice = await p.select({
    message: 'Framerate',
    options: [
      { value: '30', label: '30 fps (default)' },
      { value: '60', label: '60 fps (smooth)' },
      { value: '24', label: '24 fps (cinematic)' },
    ],
  });
  if (p.isCancel(fpsChoice)) {
    p.cancel('Cancelled.');
    return null;
  }

  const slug = slugify(name as string);
  const dir = projectDir(cwd, slug);

  if (await exists(projectPath(dir))) {
    const ok = await p.confirm({
      message: `${color.yellow('A project already exists at')} ${color.dim(dir)}. Overwrite?`,
      initialValue: false,
    });
    if (p.isCancel(ok) || !ok) {
      p.cancel('Cancelled.');
      return null;
    }
  }

  const project = newProject({
    name: name as string,
    width,
    height,
    fps: Number(fpsChoice),
  });

  const s = p.spinner();
  s.start('Writing project files');
  await saveProject(dir, project);
  await ensureHyperframesScaffold(project, dir);
  s.stop(`Created ${color.cyan(slug)}`);

  p.note(
    [
      `Path:    ${dir}`,
      `Canvas:  ${width}x${height} @ ${fpsChoice}fps`,
      `Next:    ${color.cyan('framewright')} (in this dir) → "Add scene" or "Generate script"`,
    ].join('\n'),
    'Project ready',
  );

  return dir;
}

export function helpHint(cwd: string): string {
  return `Run ${color.cyan('framewright')} from inside ${color.dim(join(cwd))} to keep editing.`;
}
