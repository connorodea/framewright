import { execa, type ExecaError } from 'execa';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import type { FramewrightProject, Scene } from './project.js';

function bin(): { command: string; baseArgs: string[] } {
  const override = process.env.HYPERFRAMES_BIN?.trim();
  if (override) {
    const parts = override.split(/\s+/);
    return { command: parts[0]!, baseArgs: parts.slice(1) };
  }
  return { command: 'npx', baseArgs: ['--yes', 'hyperframes'] };
}

export async function runHyperframes(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { command, baseArgs } = bin();
  try {
    const result = await execa(command, [...baseArgs, ...args], {
      cwd,
      stdio: 'pipe',
      env: process.env,
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0,
    };
  } catch (err) {
    const e = err as ExecaError;
    return {
      stdout: typeof e.stdout === 'string' ? e.stdout : '',
      stderr: typeof e.stderr === 'string' ? e.stderr : String(err),
      exitCode: typeof e.exitCode === 'number' ? e.exitCode : 1,
    };
  }
}

export async function ensureHyperframesScaffold(
  project: FramewrightProject,
  dir: string,
): Promise<string> {
  const hfDir = join(dir, '.hyperframes');
  await mkdir(hfDir, { recursive: true });
  const compositionPath = join(hfDir, 'index.html');
  await writeFile(compositionPath, buildCompositionHtml(project), 'utf8');
  return compositionPath;
}

export function buildCompositionHtml(project: FramewrightProject): string {
  const totalMs = project.scenes.reduce((s, sc) => s + sc.durationMs, 0) || 5000;
  const sceneMarkup = project.scenes
    .map((s, i) => sceneToHtml(s, i, project))
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(project.name)}</title>
<style>
  :root { color-scheme: dark; }
  html, body { margin: 0; padding: 0; background: #0b0b10; color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; }
  .stage { position: relative; width: ${project.width}px; height: ${project.height}px; overflow: hidden; }
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
<div class="stage" data-hf-duration="${totalMs}" data-hf-fps="${project.fps}">
${sceneMarkup}
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
`;
}

function sceneToHtml(
  scene: Scene,
  index: number,
  project: FramewrightProject,
): string {
  const start = project.scenes
    .slice(0, index)
    .reduce((s, sc) => s + sc.durationMs, 0);
  const end = start + scene.durationMs;
  const body = escapeHtml(scene.text ?? scene.url ?? scene.notes ?? scene.kind);
  return `  <section class="scene ${scene.kind}" data-start="${start}" data-end="${end}"><div class="text">${body}</div></section>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
