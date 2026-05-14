import * as p from '@clack/prompts';
import color from 'picocolors';
import { loadProject, summarizeScene, totalDurationMs } from '../lib/project.js';

export async function cmdListScenes(dir: string): Promise<void> {
  const project = await loadProject(dir);
  if (project.scenes.length === 0) {
    p.note('No scenes yet. Try "Add scene" or "Generate script with Claude".', 'Empty');
    return;
  }
  const body = project.scenes.map((s) => summarizeScene(s)).join('\n');
  const total = (totalDurationMs(project) / 1000).toFixed(1);
  p.note(
    `${body}\n\n${color.dim(`Total: ${total}s · ${project.scenes.length} scene(s)`)}`,
    color.cyan(project.name),
  );
}
