import * as p from '@clack/prompts';
import color from 'picocolors';
import {
  loadProject,
  nextSceneId,
  saveProject,
  type Scene,
  type SceneKind,
} from '../lib/project.js';
import { ensureHyperframesScaffold } from '../lib/hyperframes.js';

const KINDS: { value: SceneKind; label: string; hint?: string }[] = [
  { value: 'title', label: 'Title card', hint: 'big bold opener' },
  { value: 'caption', label: 'On-screen caption' },
  { value: 'voiceover', label: 'Voiceover narration' },
  { value: 'website-capture', label: 'Website capture (URL)' },
  { value: 'image', label: 'Static image' },
  { value: 'custom', label: 'Custom / notes only' },
];

export async function cmdAddScene(dir: string): Promise<void> {
  const project = await loadProject(dir);

  const kind = await p.select({
    message: 'Scene type',
    options: KINDS,
  });
  if (p.isCancel(kind)) {
    p.cancel('Cancelled.');
    return;
  }

  const scene: Scene = {
    id: nextSceneId(project),
    kind: kind as SceneKind,
    durationMs: 3000,
  };

  if (kind === 'website-capture') {
    const url = await p.text({
      message: 'Website URL',
      placeholder: 'https://aiwholesail.com',
      validate: (v) => (/^https?:\/\//.test(v) ? undefined : 'Must start with http(s)://'),
    });
    if (p.isCancel(url)) {
      p.cancel('Cancelled.');
      return;
    }
    scene.url = url as string;
  } else if (kind === 'image') {
    const imagePath = await p.text({
      message: 'Image path (relative to project)',
      placeholder: 'assets/hero.png',
    });
    if (p.isCancel(imagePath)) {
      p.cancel('Cancelled.');
      return;
    }
    scene.imagePath = imagePath as string;
  } else if (kind === 'custom') {
    const notes = await p.text({
      message: 'Notes for this scene',
      placeholder: 'crossfade montage of customer logos',
    });
    if (p.isCancel(notes)) {
      p.cancel('Cancelled.');
      return;
    }
    scene.notes = notes as string;
  } else {
    const text = await p.text({
      message: kind === 'title' ? 'Title text' : kind === 'caption' ? 'Caption text' : 'Voiceover script',
      placeholder:
        kind === 'title'
          ? 'Your boldest line'
          : kind === 'caption'
            ? 'Three to nine punchy words'
            : 'One or two natural sentences.',
      validate: (v) => (v.trim().length > 0 ? undefined : 'Required'),
    });
    if (p.isCancel(text)) {
      p.cancel('Cancelled.');
      return;
    }
    scene.text = text as string;
  }

  const durationStr = await p.text({
    message: 'Duration (seconds)',
    placeholder: '3',
    initialValue: '3',
    validate: (v) =>
      /^\d+(\.\d+)?$/.test(v) && Number(v) > 0 ? undefined : 'Positive number',
  });
  if (p.isCancel(durationStr)) {
    p.cancel('Cancelled.');
    return;
  }
  scene.durationMs = Math.round(Number(durationStr) * 1000);

  if (kind === 'voiceover') {
    const voice = await p.text({
      message: 'Voice (kokoro/whisper compatible) — leave blank for default',
      placeholder: project.voiceDefault ?? 'af_bella',
      defaultValue: project.voiceDefault ?? '',
    });
    if (!p.isCancel(voice) && voice) scene.voice = voice as string;
  }

  project.scenes.push(scene);
  const s = p.spinner();
  s.start('Saving scene');
  await saveProject(dir, project);
  await ensureHyperframesScaffold(project, dir);
  s.stop(`Added ${color.cyan(scene.id)}`);
}
