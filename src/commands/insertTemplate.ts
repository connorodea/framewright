import * as p from '@clack/prompts';
import color from 'picocolors';
import {
  loadProject,
  nextSceneId,
  saveProject,
} from '../lib/project.js';
import { ensureHyperframesScaffold } from '../lib/hyperframes.js';
import {
  listTemplates,
  materializeTemplate,
  templateTotalMs,
} from '../lib/sceneTemplates.js';

export async function cmdInsertTemplate(dir: string): Promise<void> {
  const project = await loadProject(dir);
  const templates = listTemplates();

  const name = await p.select({
    message: 'Pick a template',
    options: templates.map((t) => ({
      value: t.name,
      label: t.name,
      hint: `${t.scenes.length} scenes · ${(templateTotalMs(t) / 1000).toFixed(1)}s — ${t.description}`,
    })),
  });
  if (p.isCancel(name)) {
    p.cancel('Cancelled.');
    return;
  }

  const tpl = templates.find((t) => t.name === name)!;
  const newScenes = materializeTemplate(tpl, () => nextSceneId(project));
  project.scenes.push(...newScenes);

  const s = p.spinner();
  s.start('Saving');
  await saveProject(dir, project);
  await ensureHyperframesScaffold(project, dir);
  s.stop(
    `Inserted ${newScenes.length} scene(s) from ${color.cyan(tpl.name)} template`,
  );
}
