import * as p from '@clack/prompts';
import color from 'picocolors';
import { loadProject, saveProject } from '../lib/project.js';
import { ensureHyperframesScaffold } from '../lib/hyperframes.js';
import { generateTheme, hasClaudeCode } from '../lib/claude.js';

export async function cmdTheme(dir: string): Promise<void> {
  if (!(await hasClaudeCode())) {
    p.note(
      'The `claude` CLI (Claude Code) is required.\nInstall: https://docs.claude.com/claude-code',
      color.yellow('Claude Code not found'),
    );
    return;
  }

  const project = await loadProject(dir);

  const vibe = await p.text({
    message: 'Describe the brand vibe',
    placeholder: 'sleek dark crypto · or · warm cozy bakery',
    validate: (v) => (v.trim().length > 0 ? undefined : 'Required'),
  });
  if (p.isCancel(vibe)) {
    p.cancel('Cancelled.');
    return;
  }

  const s = p.spinner();
  s.start('Asking Claude Code to design a palette');
  let theme;
  try {
    theme = await generateTheme({
      vibe: vibe as string,
      project,
      cwd: dir,
    });
    s.stop('Theme designed');
  } catch (err) {
    s.stop(color.red('Claude call failed'));
    p.note(
      err instanceof Error ? err.message : String(err),
      color.red('Error'),
    );
    return;
  }

  project.theme = theme;

  const s2 = p.spinner();
  s2.start('Saving project + composition');
  await saveProject(dir, project);
  await ensureHyperframesScaffold(project, dir);
  s2.stop('Saved');

  const swatch = (hex: string, label: string): string =>
    `  ${color.bold(label.padEnd(18))} ${hex}`;

  p.note(
    [
      color.dim(`vibe: ${theme.vibe}`),
      '',
      swatch(theme.background, 'background'),
      swatch(theme.surface, 'surface'),
      swatch(theme.textPrimary, 'text primary'),
      swatch(theme.textSecondary, 'text secondary'),
      swatch(theme.accent, 'accent'),
      swatch(theme.accentContrast, 'accent contrast'),
      '',
      `  ${color.bold('font display'.padEnd(18))} ${theme.fontDisplay}`,
      `  ${color.bold('font body'.padEnd(18))} ${theme.fontBody}`,
    ].join('\n'),
    'Brand theme',
  );
}
