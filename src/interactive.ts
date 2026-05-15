import * as p from '@clack/prompts';
import color from 'picocolors';
import { printBanner } from './banner.js';
import {
  exists,
  loadProject,
  projectPath,
  totalDurationMs,
} from './lib/project.js';
import { cmdNew } from './commands/newProject.js';
import { cmdAddScene } from './commands/addScene.js';
import { cmdGenerateScript } from './commands/generateScript.js';
import { cmdListScenes } from './commands/listScenes.js';
import { cmdRemoveScene } from './commands/removeScene.js';
import { cmdPreview } from './commands/preview.js';
import { cmdRender } from './commands/render.js';
import { cmdCaptureWebsite } from './commands/captureWebsite.js';
import { cmdGenerateVoiceover } from './commands/generateVoiceover.js';
import { cmdInsertTemplate } from './commands/insertTemplate.js';

type Action =
  | 'new'
  | 'list'
  | 'add'
  | 'template'
  | 'capture'
  | 'script'
  | 'voiceover'
  | 'remove'
  | 'preview'
  | 'render'
  | 'quit';

export async function runInteractive(): Promise<void> {
  printBanner();
  p.intro(color.bgMagenta(color.black(' framewright ')));

  const cwd = process.cwd();
  let activeDir = (await exists(projectPath(cwd))) ? cwd : null;

  while (true) {
    if (activeDir) {
      try {
        const project = await loadProject(activeDir);
        const totalSec = (totalDurationMs(project) / 1000).toFixed(1);
        p.log.info(
          `${color.cyan(project.name)}  ${color.dim(`${project.width}x${project.height} @ ${project.fps}fps · ${project.scenes.length} scene(s) · ${totalSec}s`)}`,
        );
      } catch (err) {
        p.log.warn(
          `Couldn't read project: ${err instanceof Error ? err.message : String(err)}`,
        );
        activeDir = null;
      }
    } else {
      p.log.info(color.dim(`No framewright project in ${cwd}`));
    }

    const action = await p.select<Action>({
      message: 'What now?',
      options: activeDir
        ? [
            { value: 'list', label: 'List scenes' },
            { value: 'add', label: 'Add scene manually' },
            { value: 'template', label: 'Insert template (hook / demo / CTA / outro)' },
            { value: 'script', label: 'Generate script with Claude Code' },
            { value: 'capture', label: 'Add website capture (via skill)' },
            { value: 'voiceover', label: 'Generate kokoro voiceover (via skill)' },
            { value: 'remove', label: 'Remove a scene' },
            { value: 'preview', label: 'Preview composition' },
            { value: 'render', label: 'Render to file' },
            { value: 'new', label: 'New project (different directory)' },
            { value: 'quit', label: 'Quit' },
          ]
        : [
            { value: 'new', label: 'New project' },
            { value: 'quit', label: 'Quit' },
          ],
    });

    if (p.isCancel(action) || action === 'quit') {
      p.outro(color.dim('Bye.'));
      return;
    }

    try {
      switch (action) {
        case 'new': {
          const created = await cmdNew(cwd);
          if (created) activeDir = created;
          break;
        }
        case 'list':
          await cmdListScenes(activeDir!);
          break;
        case 'add':
          await cmdAddScene(activeDir!);
          break;
        case 'template':
          await cmdInsertTemplate(activeDir!);
          break;
        case 'script':
          await cmdGenerateScript(activeDir!);
          break;
        case 'capture':
          await cmdCaptureWebsite(activeDir!);
          break;
        case 'voiceover':
          await cmdGenerateVoiceover(activeDir!);
          break;
        case 'remove':
          await cmdRemoveScene(activeDir!);
          break;
        case 'preview':
          await cmdPreview(activeDir!);
          break;
        case 'render':
          await cmdRender(activeDir!);
          break;
      }
    } catch (err) {
      p.log.error(
        `${color.red('Command failed:')} ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
