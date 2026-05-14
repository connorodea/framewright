import * as p from '@clack/prompts';
import color from 'picocolors';
import { loadProject, saveProject, summarizeScene } from '../lib/project.js';
import { ensureHyperframesScaffold } from '../lib/hyperframes.js';

export async function cmdRemoveScene(dir: string): Promise<void> {
  const project = await loadProject(dir);
  if (project.scenes.length === 0) {
    p.note('Nothing to remove.', 'Empty');
    return;
  }

  const id = await p.select({
    message: 'Remove which scene?',
    options: project.scenes.map((s) => ({ value: s.id, label: summarizeScene(s) })),
  });
  if (p.isCancel(id)) {
    p.cancel('Cancelled.');
    return;
  }

  const ok = await p.confirm({
    message: `Remove ${color.red(id as string)}?`,
    initialValue: false,
  });
  if (p.isCancel(ok) || !ok) {
    p.cancel('Cancelled.');
    return;
  }

  project.scenes = project.scenes.filter((s) => s.id !== id);
  // Re-id remaining scenes so order stays clean.
  project.scenes = project.scenes.map((s, i) => ({
    ...s,
    id: `scene-${String(i + 1).padStart(2, '0')}`,
  }));

  const sp = p.spinner();
  sp.start('Saving');
  await saveProject(dir, project);
  await ensureHyperframesScaffold(project, dir);
  sp.stop('Saved');
}
