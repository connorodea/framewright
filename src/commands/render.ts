import * as p from '@clack/prompts';
import color from 'picocolors';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { loadProject } from '../lib/project.js';
import { ensureHyperframesScaffold, runHyperframes } from '../lib/hyperframes.js';

export async function cmdRender(dir: string): Promise<void> {
  const project = await loadProject(dir);
  if (project.scenes.length === 0) {
    p.note('Add at least one scene before rendering.', 'Empty');
    return;
  }

  const format = await p.select({
    message: 'Output format',
    options: [
      { value: 'mp4', label: 'mp4 (H.264, broad compatibility)' },
      { value: 'webm', label: 'webm (smaller, web-optimized)' },
      { value: 'gif', label: 'gif (for previews/socials)' },
    ],
  });
  if (p.isCancel(format)) {
    p.cancel('Cancelled.');
    return;
  }

  const filename = `${project.slug}-${Date.now()}.${format}`;
  const outDir = join(dir, 'renders');
  const outPath = join(outDir, filename);
  await mkdir(outDir, { recursive: true });

  const s = p.spinner();
  s.start('Building composition');
  await ensureHyperframesScaffold(project, dir);
  s.stop('Composition ready');

  const s2 = p.spinner();
  s2.start(`Rendering ${color.cyan(filename)}`);
  const { exitCode, stderr, stdout } = await runHyperframes(
    ['render', '.hyperframes/index.html', '--out', outPath, '--fps', String(project.fps)],
    dir,
  );

  if (exitCode === 0) {
    s2.stop(`Rendered → ${color.green(outPath)}`);
    p.note(stdout.trim() || `Saved to ${outPath}`, 'Render complete');
  } else {
    s2.stop(color.red('Render failed'));
    p.note(stderr || `hyperframes render exited with code ${exitCode}`, color.red('Error'));
  }
}
