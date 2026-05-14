import * as p from '@clack/prompts';
import color from 'picocolors';
import { loadProject } from '../lib/project.js';
import { ensureHyperframesScaffold, runHyperframes } from '../lib/hyperframes.js';

export async function cmdPreview(dir: string): Promise<void> {
  const project = await loadProject(dir);
  if (project.scenes.length === 0) {
    p.note('Add at least one scene before previewing.', 'Empty');
    return;
  }

  const s = p.spinner();
  s.start('Building HyperFrames composition');
  await ensureHyperframesScaffold(project, dir);
  s.stop('Composition ready');

  p.note(
    `Launching ${color.cyan('hyperframes preview')} in .hyperframes/\nPress Ctrl+C in the preview window to return.`,
    'Preview',
  );

  const { exitCode, stderr } = await runHyperframes(
    ['preview', '.hyperframes/index.html'],
    dir,
  );
  if (exitCode !== 0) {
    p.note(stderr || `hyperframes preview exited with code ${exitCode}`, color.red('Preview failed'));
  }
}
