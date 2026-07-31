import * as p from '@clack/prompts';
import color from 'picocolors';
import { loadProject, saveProject, summarizeScene } from '../lib/project.js';
import { ensureHyperframesScaffold } from '../lib/hyperframes.js';

type Field = 'text' | 'duration' | 'voice';

export async function cmdEditScene(dir: string): Promise<void> {
  const project = await loadProject(dir);
  if (project.scenes.length === 0) {
    p.note('Nothing to edit.', 'Empty');
    return;
  }

  const id = await p.select({
    message: 'Edit which scene?',
    options: project.scenes.map((s) => ({ value: s.id, label: summarizeScene(s) })),
  });
  if (p.isCancel(id)) {
    p.cancel('Cancelled.');
    return;
  }

  const scene = project.scenes.find((s) => s.id === id);
  if (!scene) {
    p.log.error(`Scene ${id as string} not found`);
    return;
  }

  const fieldOptions: { value: Field; label: string }[] = [
    { value: 'text', label: 'Text / script / notes' },
    { value: 'duration', label: 'Duration (seconds)' },
  ];
  if (scene.kind === 'voiceover') {
    fieldOptions.push({ value: 'voice', label: 'Voice id' });
  }

  const field = await p.select<Field>({
    message: 'Edit which field?',
    options: fieldOptions,
  });
  if (p.isCancel(field)) {
    p.cancel('Cancelled.');
    return;
  }

  if (field === 'text') {
    const current = scene.text ?? scene.notes ?? '';
    const next = await p.text({
      message:
        scene.kind === 'title'
          ? 'Title text'
          : scene.kind === 'caption'
            ? 'Caption text'
            : scene.kind === 'voiceover'
              ? 'Voiceover script'
              : scene.kind === 'custom'
                ? 'Notes'
                : 'Text',
      initialValue: current,
      validate: (v) =>
        v.trim().length > 0 || scene.kind === 'custom' ? undefined : 'Required',
    });
    if (p.isCancel(next)) {
      p.cancel('Cancelled.');
      return;
    }
    if (scene.kind === 'custom') {
      scene.notes = next as string;
    } else {
      scene.text = next as string;
    }
  } else if (field === 'duration') {
    const currentSec = (scene.durationMs / 1000).toString();
    const next = await p.text({
      message: 'Duration (seconds)',
      initialValue: currentSec,
      validate: (v) =>
        /^\d+(\.\d+)?$/.test(v) && Number(v) > 0 ? undefined : 'Positive number',
    });
    if (p.isCancel(next)) {
      p.cancel('Cancelled.');
      return;
    }
    scene.durationMs = Math.round(Number(next) * 1000);
  } else if (field === 'voice') {
    if (scene.kind !== 'voiceover') {
      p.log.error('Voice can only be edited on voiceover scenes.');
      return;
    }
    const next = await p.text({
      message: 'Voice (kokoro/whisper compatible)',
      initialValue: scene.voice ?? project.voiceDefault ?? '',
      placeholder: 'af_bella',
    });
    if (p.isCancel(next)) {
      p.cancel('Cancelled.');
      return;
    }
    scene.voice = (next as string) || undefined;
  }

  const sp = p.spinner();
  sp.start('Saving');
  await saveProject(dir, project);
  await ensureHyperframesScaffold(project, dir);
  sp.stop(`Updated ${color.cyan(scene.id)}`);
}
