import * as p from '@clack/prompts';
import color from 'picocolors';
import { loadProject, nextSceneId, saveProject, type Scene } from '../lib/project.js';
import { ensureHyperframesScaffold } from '../lib/hyperframes.js';
import { generateScript, hasClaudeCode } from '../lib/claude.js';

export async function cmdGenerateScript(dir: string): Promise<void> {
  if (!(await hasClaudeCode())) {
    p.note(
      'The `claude` CLI (Claude Code) is required.\nInstall: https://docs.claude.com/claude-code',
      color.yellow('Claude Code not found'),
    );
    return;
  }

  const project = await loadProject(dir);

  const topic = await p.text({
    message: 'What is the video about?',
    placeholder: 'launch teaser for an AI real-estate tool',
    validate: (v) => (v.trim().length > 0 ? undefined : 'Required'),
  });
  if (p.isCancel(topic)) {
    p.cancel('Cancelled.');
    return;
  }

  const tone = await p.select({
    message: 'Tone',
    options: [
      { value: 'punchy founder', label: 'Punchy founder (Connor voice)' },
      { value: 'cinematic', label: 'Cinematic / dramatic' },
      { value: 'friendly explainer', label: 'Friendly explainer' },
      { value: 'product demo', label: 'Product demo' },
      { value: 'meme', label: 'Meme / irreverent' },
    ],
  });
  if (p.isCancel(tone)) {
    p.cancel('Cancelled.');
    return;
  }

  const durationStr = await p.text({
    message: 'Target duration (seconds)',
    placeholder: '20',
    initialValue: '20',
    validate: (v) => (/^\d+$/.test(v) && Number(v) > 0 ? undefined : 'Positive integer'),
  });
  if (p.isCancel(durationStr)) {
    p.cancel('Cancelled.');
    return;
  }

  const append = await p.confirm({
    message:
      project.scenes.length > 0
        ? `Append to existing ${project.scenes.length} scene(s)? (No = replace)`
        : 'Add generated scenes to project?',
    initialValue: true,
  });
  if (p.isCancel(append)) {
    p.cancel('Cancelled.');
    return;
  }

  const s = p.spinner();
  s.start('Calling Claude');
  let script;
  try {
    script = await generateScript({
      topic: topic as string,
      tone: tone as string,
      targetDurationSec: Number(durationStr),
      project,
      cwd: dir,
    });
    s.stop(`Got ${script.scenes.length} scenes`);
  } catch (err) {
    s.stop(color.red('Claude call failed'));
    p.note(err instanceof Error ? err.message : String(err), color.red('Error'));
    return;
  }

  if (!append) project.scenes = [];

  for (const gs of script.scenes) {
    const scene: Scene = {
      id: nextSceneId(project),
      kind: gs.kind,
      durationMs: gs.durationMs,
      text: gs.text,
    };
    project.scenes.push(scene);
  }

  const s2 = p.spinner();
  s2.start('Saving project + composition');
  await saveProject(dir, project);
  await ensureHyperframesScaffold(project, dir);
  s2.stop('Saved');

  p.note(
    script.scenes
      .map(
        (sc, i) =>
          `${i + 1}. ${color.cyan(sc.kind.padEnd(9))} ${(sc.durationMs / 1000).toFixed(1)}s  ${sc.text}`,
      )
      .join('\n'),
    'Generated script',
  );
}
