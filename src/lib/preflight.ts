import color from 'picocolors';
import { hasClaudeCode } from './claude.js';
import { hasHyperframes } from './hyperframes.js';

export interface PreflightOpts {
  needsClaude?: boolean;
  needsHyperframes?: boolean;
}

/**
 * Startup-time check for the two external binaries framewright relies on.
 *
 * Called from the commander action for each subcommand that needs them. Does
 * NOT throw — on a missing requirement it prints a styled, framed message to
 * stderr explaining how to install / override and exits with code 1.
 *
 * Interactive mode does not call this. Interactive mode probes per-action,
 * which is the right UX: a user can poke at the menu before installing skills.
 */
export async function preflight(opts: PreflightOpts): Promise<void> {
  const checks = await Promise.all([
    opts.needsClaude ? hasClaudeCode() : Promise.resolve(true),
    opts.needsHyperframes ? hasHyperframes() : Promise.resolve(true),
  ]);
  const missingClaude = opts.needsClaude && !checks[0];
  const missingHyperframes = opts.needsHyperframes && !checks[1];

  if (!missingClaude && !missingHyperframes) return;

  const lines: string[] = [];
  if (missingClaude) {
    lines.push(
      color.red('✗ ') +
        color.bold('claude') +
        ' (Claude Code) is required but was not found on PATH.',
    );
    lines.push('  Install:  https://docs.claude.com/claude-code');
    lines.push(
      '  Override: set ' + color.cyan('FRAMEWRIGHT_CLAUDE_BIN') + ' to a custom path.',
    );
  }
  if (missingHyperframes) {
    if (lines.length > 0) lines.push('');
    lines.push(
      color.red('✗ ') +
        color.bold('hyperframes') +
        ' is required but was not found on PATH.',
    );
    lines.push('  Install:  https://github.com/heygen-com/hyperframes');
    lines.push(
      '  On-demand: ' + color.cyan('npx --yes hyperframes') + ' works without a global install.',
    );
    lines.push(
      '  Override: set ' + color.cyan('HYPERFRAMES_BIN') + ' to a custom path.',
    );
  }

  process.stderr.write(lines.join('\n') + '\n');
  process.exit(1);
}
