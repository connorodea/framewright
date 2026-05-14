#!/usr/bin/env node
import { Command } from 'commander';
import color from 'picocolors';
import { createRequire } from 'node:module';
import { runInteractive } from './interactive.js';
import {
  headlessAdd,
  headlessClone,
  headlessDuplicate,
  headlessEdit,
  headlessList,
  headlessNew,
  headlessPreview,
  headlessRender,
  headlessReorder,
  headlessScript,
} from './headless.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

const program = new Command()
  .name('framewright')
  .description('Interactive CLI for crafting AI videos with Claude Code + HyperFrames.')
  .version(pkg.version, '-v, --version', 'print version');

// Interactive menu — default when no subcommand is given.
program
  .command('menu', { isDefault: true, hidden: true })
  .description('Open the interactive menu (default)')
  .action(async () => {
    await runInteractive();
  });

program
  .command('new <name>')
  .description('Create a new framewright project in cwd')
  .option('--preset <preset>', 'canvas preset: vertical | landscape | square | 720p')
  .option('--width <px>', 'custom canvas width')
  .option('--height <px>', 'custom canvas height')
  .option('--fps <n>', 'framerate', '30')
  .option('--force', 'overwrite an existing project at the same slug')
  .action(async (name, opts) => {
    await headlessNew(name, opts, process.cwd());
  });

program
  .command('list')
  .alias('ls')
  .description('List scenes in the current project')
  .option('--json', 'print the full project JSON')
  .action(async (opts) => {
    await headlessList(opts, process.cwd());
  });

program
  .command('add <kind>')
  .description('Add a scene (title|caption|voiceover|website-capture|image|custom)')
  .option('--text <text>', 'scene text (for title/caption/voiceover/custom)')
  .option('--url <url>', 'URL (for website-capture)')
  .option('--image <path>', 'image path (for image kind)')
  .option('--duration <sec>', 'scene duration in seconds', '3')
  .option('--voice <name>', 'voice id for voiceover (e.g. af_bella)')
  .action(async (kind, opts) => {
    await headlessAdd(kind, opts, process.cwd());
  });

program
  .command('edit [sceneId]')
  .description('Edit a scene field (text, duration, voice)')
  .option('--text <text>', 'replace the scene text / notes')
  .option('--duration <sec>', 'replace duration in seconds')
  .option('--voice <name>', 'replace voice id (voiceover scenes only)')
  .action(async (sceneId, opts) => {
    await headlessEdit(sceneId, opts, process.cwd());
  });

program
  .command('reorder [sceneId]')
  .description('Move a scene up, down, or to a specific position')
  .option('--position <n>', '1-based target position')
  .option('--up', 'move one slot up')
  .option('--down', 'move one slot down')
  .action(async (sceneId, opts) => {
    await headlessReorder(sceneId, opts, process.cwd());
  });

program
  .command('duplicate <sceneId>')
  .description('Duplicate a scene and append the copy to the end')
  .action(async (sceneId) => {
    await headlessDuplicate(sceneId, process.cwd());
  });

program
  .command('script <topic>')
  .description('Generate a multi-scene script with Claude Code')
  .option('--tone <tone>', 'tone descriptor', 'punchy founder')
  .option('--duration <sec>', 'target total duration in seconds', '20')
  .option('--append', 'append to existing scenes instead of replacing')
  .option('--json', 'print the raw script JSON')
  .action(async (topic, opts) => {
    await headlessScript(topic, opts, process.cwd());
  });

program
  .command('preview')
  .description('Open the HyperFrames preview window')
  .action(async () => {
    await headlessPreview(process.cwd());
  });

program
  .command('render')
  .description('Render the current project to a video file')
  .option('--format <fmt>', 'output format: mp4 | webm | gif', 'mp4')
  .option('--out <path>', 'output file path')
  .action(async (opts) => {
    await headlessRender(opts, process.cwd());
  });

program
  .command('clone <url>')
  .description('One-shot: turn a website URL into a finished video (via skills)')
  .option('--duration <sec>', 'target total duration', '20')
  .option('--tone <tone>', 'script tone', 'punchy founder')
  .option('--format <fmt>', 'output format: mp4 | webm | gif', 'mp4')
  .option('--out <path>', 'output file path')
  .option('--name <name>', 'project name (default: derived from hostname + date)')
  .option('--no-render', 'stop after scaffolding + capture; skip the render step')
  .action(async (url, opts) => {
    await headlessClone(url, opts, process.cwd());
  });

process.on('SIGINT', () => {
  process.stderr.write('\n' + color.dim('interrupted.\n'));
  process.exit(130);
});

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(
    color.red('fatal: ') + (err instanceof Error ? err.message : String(err)) + '\n',
  );
  process.exit(1);
});
