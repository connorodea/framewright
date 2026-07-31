import * as p from '@clack/prompts';
import color from 'picocolors';
import {
  loadProject,
  nextSceneId,
  saveProject,
  summarizeScene,
} from '../lib/project.js';
import { ensureHyperframesScaffold } from '../lib/hyperframes.js';

export async function cmdDuplicateScene(dir: string): Promise<void> {
  const project = await loadProject(dir);
  if (project.scenes.length === 0) {
    p.note('Nothing to duplicate.', 'Empty');
    return;
  }

  const id = await p.select({
    message: 'Duplicate which scene?',
    options: project.scenes.map((s) => ({ value: s.id, label: summarizeScene(s) })),
  });
  if (p.isCancel(id)) {
    p.cancel('Cancelled.');
    return;
  }

  const source = project.scenes.find((s) => s.id === id);
  if (!source) {
    p.log.error(`Scene ${id as string} not found`);
    return;
  }

  const ok = await p.confirm({
    message: `Duplicate ${color.cyan(source.id)} and append to the end?`,
    initialValue: true,
  });
  if (p.isCancel(ok) || !ok) {
    p.cancel('Cancelled.');
    return;
  }

  const clone = { ...source, id: nextSceneId(project) };
  project.scenes.push(clone);

  const sp = p.spinner();
  sp.start('Saving');
  await saveProject(dir, project);
  await ensureHyperframesScaffold(project, dir);
  sp.stop(`Duplicated → ${color.cyan(clone.id)}`);
}
