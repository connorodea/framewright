import * as p from '@clack/prompts';
import color from 'picocolors';
import { join } from 'node:path';
import { loadProject, saveProject, summarizeScene } from '../lib/project.js';
import { generateVoiceoverViaSkill, hasClaudeCode } from '../lib/claude.js';

const VOICE_OPTIONS = [
  { value: 'af_bella', label: 'af_bella · warm female (kokoro)' },
  { value: 'af_sky', label: 'af_sky · neutral female (kokoro)' },
  { value: 'am_adam', label: 'am_adam · grounded male (kokoro)' },
  { value: 'am_michael', label: 'am_michael · upbeat male (kokoro)' },
  { value: 'bm_george', label: 'bm_george · British male (kokoro)' },
  { value: 'bf_emma', label: 'bf_emma · British female (kokoro)' },
];

export async function cmdGenerateVoiceover(dir: string): Promise<void> {
  if (!(await hasClaudeCode())) {
    p.note(
      'The `claude` CLI is required to invoke the hyperframes-media skill.',
      color.yellow('Claude Code not found'),
    );
    return;
  }

  const project = await loadProject(dir);
  const voiceoverScenes = project.scenes.filter((s) => s.kind === 'voiceover');
  if (voiceoverScenes.length === 0) {
    p.note(
      `No voiceover scenes yet. Add one via ${color.cyan('Add scene')} → ${color.cyan('Voiceover')}.`,
      'Nothing to do',
    );
    return;
  }

  const sceneId = await p.select({
    message: 'Which voiceover to synthesize?',
    options: voiceoverScenes.map((s) => ({
      value: s.id,
      label: summarizeScene(s),
    })),
  });
  if (p.isCancel(sceneId)) {
    p.cancel('Cancelled.');
    return;
  }

  const scene = voiceoverScenes.find((s) => s.id === sceneId)!;

  const voice = await p.select({
    message: 'Voice',
    options: VOICE_OPTIONS,
    initialValue: scene.voice ?? project.voiceDefault ?? 'af_bella',
  });
  if (p.isCancel(voice)) {
    p.cancel('Cancelled.');
    return;
  }

  const outPath = join('.hyperframes', 'audio', `${scene.id}.wav`);

  const s = p.spinner();
  s.start('Invoking hyperframes-media skill (kokoro TTS)');
  const { ok, log } = await generateVoiceoverViaSkill({
    text: scene.text ?? '',
    voice: voice as string,
    outPath,
    projectDir: dir,
  });
  s.stop(ok ? `Generated ${color.green(outPath)}` : color.red('TTS failed'));

  if (ok) {
    scene.voice = voice as string;
    const sceneIdx = project.scenes.findIndex((s) => s.id === scene.id);
    if (sceneIdx >= 0) project.scenes[sceneIdx] = scene;
    await saveProject(dir, project);
  }

  p.note(log.slice(-1200), ok ? 'Skill output (tail)' : color.red('Skill error'));
}
