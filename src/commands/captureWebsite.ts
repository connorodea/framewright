import * as p from '@clack/prompts';
import color from 'picocolors';
import { loadProject, nextSceneId, saveProject, type Scene } from '../lib/project.js';
import { ensureHyperframesScaffold } from '../lib/hyperframes.js';
import { captureWebsiteViaSkill, hasClaudeCode } from '../lib/claude.js';

export async function cmdCaptureWebsite(dir: string): Promise<void> {
  const project = await loadProject(dir);

  const url = await p.text({
    message: 'Website URL to feature',
    placeholder: 'https://aiwholesail.com',
    validate: (v) => (/^https?:\/\//.test(v) ? undefined : 'Must start with http(s)://'),
  });
  if (p.isCancel(url)) {
    p.cancel('Cancelled.');
    return;
  }

  const durationStr = await p.text({
    message: 'Capture duration (seconds)',
    placeholder: '4',
    initialValue: '4',
    validate: (v) => (/^\d+(\.\d+)?$/.test(v) && Number(v) > 0 ? undefined : 'Positive number'),
  });
  if (p.isCancel(durationStr)) {
    p.cancel('Cancelled.');
    return;
  }
  const durationMs = Math.round(Number(durationStr) * 1000);

  const useSkill = await p.confirm({
    message: 'Run the website-to-hyperframes skill now via Claude Code?',
    initialValue: true,
  });
  if (p.isCancel(useSkill)) {
    p.cancel('Cancelled.');
    return;
  }

  const scene: Scene = {
    id: nextSceneId(project),
    kind: 'website-capture',
    durationMs,
    url: url as string,
  };
  project.scenes.push(scene);

  const sSave = p.spinner();
  sSave.start('Saving scene');
  await saveProject(dir, project);
  await ensureHyperframesScaffold(project, dir);
  sSave.stop(`Added ${color.cyan(scene.id)}`);

  if (useSkill) {
    if (!(await hasClaudeCode())) {
      p.note('`claude` CLI not found on PATH. Skipping skill invocation.', color.yellow('Skipped'));
      return;
    }
    const sSkill = p.spinner();
    sSkill.start('Invoking website-to-hyperframes skill (this may take a minute)');
    const { ok, log } = await captureWebsiteViaSkill({
      url: scene.url!,
      durationMs: scene.durationMs,
      projectDir: dir,
    });
    sSkill.stop(ok ? 'Capture complete' : color.red('Capture failed'));
    p.note(log.slice(-1200), ok ? 'Skill output (tail)' : color.red('Skill error'));
  } else {
    p.note(
      `Scene saved. Run ${color.cyan('framewright')} → ${color.cyan('Render')} when ready —\nthe website-to-hyperframes skill will be invoked at render time.`,
      'Website capture queued',
    );
  }
}
