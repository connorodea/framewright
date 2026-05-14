import * as p from '@clack/prompts';
import color from 'picocolors';
import { loadProject, saveProject, summarizeScene } from '../lib/project.js';
import { ensureHyperframesScaffold } from '../lib/hyperframes.js';

type Move = 'up' | 'down' | 'position';

export async function cmdReorderScenes(dir: string): Promise<void> {
  const project = await loadProject(dir);
  if (project.scenes.length < 2) {
    p.note('Need at least two scenes to reorder.', 'Not enough scenes');
    return;
  }

  const id = await p.select({
    message: 'Move which scene?',
    options: project.scenes.map((s) => ({ value: s.id, label: summarizeScene(s) })),
  });
  if (p.isCancel(id)) {
    p.cancel('Cancelled.');
    return;
  }

  const fromIdx = project.scenes.findIndex((s) => s.id === id);
  if (fromIdx < 0) {
    p.log.error(`Scene ${id as string} not found`);
    return;
  }

  const move = await p.select<Move>({
    message: 'Move it where?',
    options: [
      { value: 'up', label: 'Move up one slot' },
      { value: 'down', label: 'Move down one slot' },
      { value: 'position', label: 'Move to specific position' },
    ],
  });
  if (p.isCancel(move)) {
    p.cancel('Cancelled.');
    return;
  }

  let toIdx = fromIdx;
  if (move === 'up') {
    if (fromIdx === 0) {
      p.log.warn('Already at the top.');
      return;
    }
    toIdx = fromIdx - 1;
  } else if (move === 'down') {
    if (fromIdx === project.scenes.length - 1) {
      p.log.warn('Already at the bottom.');
      return;
    }
    toIdx = fromIdx + 1;
  } else {
    const max = project.scenes.length;
    const posStr = await p.text({
      message: `New position (1-${max})`,
      initialValue: String(fromIdx + 1),
      validate: (v) => {
        if (!/^\d+$/.test(v)) return 'Whole number';
        const n = Number(v);
        if (n < 1 || n > max) return `Must be 1-${max}`;
        return undefined;
      },
    });
    if (p.isCancel(posStr)) {
      p.cancel('Cancelled.');
      return;
    }
    toIdx = Number(posStr) - 1;
  }

  if (toIdx === fromIdx) {
    p.log.info('No change.');
    return;
  }

  const [moved] = project.scenes.splice(fromIdx, 1);
  if (!moved) {
    p.log.error('Internal error: scene vanished.');
    return;
  }
  project.scenes.splice(toIdx, 0, moved);

  // Re-id everything so IDs stay monotonic.
  project.scenes = project.scenes.map((s, i) => ({
    ...s,
    id: `scene-${String(i + 1).padStart(2, '0')}`,
  }));

  const sp = p.spinner();
  sp.start('Saving');
  await saveProject(dir, project);
  await ensureHyperframesScaffold(project, dir);
  sp.stop(`Reordered → ${color.cyan(project.scenes[toIdx]!.id)} now at position ${toIdx + 1}`);
}
