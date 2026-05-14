import { execa, type ExecaError } from 'execa';
import type { FramewrightProject, Theme } from './project.js';

// Resolves the `claude` (Claude Code) CLI. Override with FRAMEWRIGHT_CLAUDE_BIN.
function claudeBin(): { command: string; baseArgs: string[] } {
  const override = process.env.FRAMEWRIGHT_CLAUDE_BIN?.trim();
  if (override) {
    const parts = override.split(/\s+/);
    return { command: parts[0]!, baseArgs: parts.slice(1) };
  }
  return { command: 'claude', baseArgs: [] };
}

export async function hasClaudeCode(): Promise<boolean> {
  try {
    const { exitCode } = await execa('claude', ['--version'], { stdio: 'pipe' });
    return exitCode === 0;
  } catch {
    return false;
  }
}

export interface GeneratedScene {
  kind: 'title' | 'caption' | 'voiceover';
  text: string;
  durationMs: number;
}

export interface GeneratedScript {
  scenes: GeneratedScene[];
}

/**
 * Run a one-shot Claude Code session in print mode. Claude Code auto-loads
 * any installed skills (hyperframes, website-to-hyperframes, hyperframes-media,
 * etc.) whose trigger phrases appear in the prompt — so framewright just asks
 * for what it wants and the skills do the heavy lifting.
 */
export async function runClaude(opts: {
  prompt: string;
  cwd: string;
  outputFormat?: 'text' | 'json';
  allowedTools?: string[];
  model?: string;
  addDirs?: string[];
  permissionMode?: 'acceptEdits' | 'auto' | 'bypassPermissions' | 'default' | 'dontAsk' | 'plan';
}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { command, baseArgs } = claudeBin();
  const args = [...baseArgs, '-p', opts.prompt];
  if (opts.outputFormat) args.push('--output-format', opts.outputFormat);
  if (opts.model) args.push('--model', opts.model);
  if (opts.permissionMode) args.push('--permission-mode', opts.permissionMode);
  if (opts.allowedTools && opts.allowedTools.length > 0) {
    args.push('--allowedTools', opts.allowedTools.join(' '));
  }
  if (opts.addDirs) {
    for (const d of opts.addDirs) args.push('--add-dir', d);
  }
  try {
    const result = await execa(command, args, {
      cwd: opts.cwd,
      stdio: 'pipe',
      env: process.env,
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0,
    };
  } catch (err) {
    const e = err as ExecaError;
    return {
      stdout: typeof e.stdout === 'string' ? e.stdout : '',
      stderr: typeof e.stderr === 'string' ? e.stderr : String(err),
      exitCode: typeof e.exitCode === 'number' ? e.exitCode : 1,
    };
  }
}

const SCRIPT_INSTRUCTIONS = `You are scripting a short-form video for framewright.
Return JSON ONLY. No prose. No code fences. Schema:
{
  "scenes": [
    { "kind": "title" | "caption" | "voiceover", "text": "...", "durationMs": 2500 }
  ]
}
Rules:
- 4-8 scenes total.
- First scene must be "kind": "title", <= 8 words.
- Mix caption (on-screen, 3-9 words) and voiceover (narration, 1-2 sentences).
- durationMs realistic (1500-6000 each).`;

export async function generateScript(opts: {
  topic: string;
  tone: string;
  targetDurationSec: number;
  project: FramewrightProject;
  cwd: string;
}): Promise<GeneratedScript> {
  const prompt = [
    SCRIPT_INSTRUCTIONS,
    '',
    `Topic: ${opts.topic}`,
    `Tone: ${opts.tone}`,
    `Target total duration: ~${opts.targetDurationSec} seconds`,
    `Canvas: ${opts.project.width}x${opts.project.height} @ ${opts.project.fps}fps`,
    '',
    'Output JSON only.',
  ].join('\n');

  const { stdout, exitCode, stderr } = await runClaude({
    prompt,
    cwd: opts.cwd,
    outputFormat: 'json',
    permissionMode: 'bypassPermissions',
  });
  if (exitCode !== 0) {
    throw new Error(`claude exited ${exitCode}: ${stderr || stdout}`);
  }
  return parseScriptFromClaudeOutput(stdout);
}

/**
 * Ask Claude Code to use the website-to-hyperframes skill to capture a URL
 * into the project's .hyperframes scaffold. Claude will load the skill if its
 * description matches; framewright just hands over the goal.
 */
export async function captureWebsiteViaSkill(opts: {
  url: string;
  durationMs: number;
  projectDir: string;
}): Promise<{ ok: boolean; log: string }> {
  const prompt = [
    `Use the website-to-hyperframes skill.`,
    `Target URL: ${opts.url}`,
    `Desired clip duration: ${(opts.durationMs / 1000).toFixed(1)} seconds.`,
    `Working directory: ${opts.projectDir}`,
    `Save the resulting hyperframes assets under .hyperframes/captures/ in this directory.`,
    `Report back the relative path(s) you wrote.`,
  ].join('\n');

  const { stdout, stderr, exitCode } = await runClaude({
    prompt,
    cwd: opts.projectDir,
    permissionMode: 'acceptEdits',
    addDirs: [opts.projectDir],
  });
  return {
    ok: exitCode === 0,
    log: stdout + (stderr ? `\n${stderr}` : ''),
  };
}

/**
 * Ask Claude Code to generate a kokoro TTS clip for a voiceover scene via the
 * hyperframes-media skill.
 */
export async function generateVoiceoverViaSkill(opts: {
  text: string;
  voice: string;
  outPath: string;
  projectDir: string;
}): Promise<{ ok: boolean; log: string }> {
  const prompt = [
    `Use the hyperframes-media skill to generate kokoro TTS audio.`,
    `Voice: ${opts.voice}`,
    `Output path (relative to ${opts.projectDir}): ${opts.outPath}`,
    `Text to narrate:`,
    `"""`,
    opts.text,
    `"""`,
    `When done, confirm the file exists and print its path.`,
  ].join('\n');

  const { stdout, stderr, exitCode } = await runClaude({
    prompt,
    cwd: opts.projectDir,
    permissionMode: 'acceptEdits',
    addDirs: [opts.projectDir],
  });
  return {
    ok: exitCode === 0,
    log: stdout + (stderr ? `\n${stderr}` : ''),
  };
}

/**
 * Parse JSON output from `claude -p --output-format json`. Claude wraps the
 * actual model output in `{ result: "..." }`; this helper unwraps it, strips
 * any accidental code-fences, JSON.parses, then runs the caller-supplied
 * validator. Validator should throw with a friendly message on shape errors.
 */
export function parseClaudeJson<T>(raw: string, validate: (parsed: unknown) => T): T {
  let candidate = raw.trim();
  try {
    const wrapper = JSON.parse(candidate) as { result?: string } | unknown;
    if (
      wrapper &&
      typeof wrapper === 'object' &&
      'result' in wrapper &&
      typeof (wrapper as { result: unknown }).result === 'string'
    ) {
      candidate = (wrapper as { result: string }).result.trim();
    }
  } catch {
    // candidate stays as the raw text
  }
  candidate = stripCodeFence(candidate);
  const parsed = JSON.parse(candidate) as unknown;
  return validate(parsed);
}

function parseScriptFromClaudeOutput(raw: string): GeneratedScript {
  return parseClaudeJson(raw, (parsed) => {
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray((parsed as GeneratedScript).scenes)
    ) {
      throw new Error('Claude did not return a script with a "scenes" array.');
    }
    return parsed as GeneratedScript;
  });
}

function stripCodeFence(text: string): string {
  const fence = /^```(?:json)?\s*([\s\S]*?)```\s*$/m;
  const m = text.match(fence);
  return (m ? m[1] : text).trim();
}

const THEME_INSTRUCTIONS = `You are designing a brand color palette and font pairing for a short-form social video.
Return JSON ONLY matching this schema. No prose. No code fences.
{
  "background": "#0b0b10",
  "surface": "#15151d",
  "textPrimary": "#ffffff",
  "textSecondary": "#a3a3b2",
  "accent": "#7c5cff",
  "accentContrast": "#0b0b10",
  "fontDisplay": "\\"Inter\\", system-ui, -apple-system, sans-serif",
  "fontBody": "\\"Inter\\", system-ui, -apple-system, sans-serif"
}
Rules:
- Pick colors that work for short-form social video — high contrast, readable at 1080p.
- background should be the darkest (or lightest, if pale theme) base; surface is slightly offset for cards.
- textPrimary must have strong contrast against background (WCAG AA+).
- accent is the brand pop color; accentContrast must be readable when placed on accent.
- Font stacks must be valid CSS, include safe system fallbacks, and end in a generic family (sans-serif / serif).
- Use web-safe fonts or popular Google Fonts (Inter, Plus Jakarta Sans, Manrope, Space Grotesk, IBM Plex Sans, Playfair Display, Outfit, etc.).
- Output JSON only.`;

export async function generateTheme(opts: {
  vibe: string;
  project: FramewrightProject;
  cwd: string;
}): Promise<Theme> {
  const prompt = [
    THEME_INSTRUCTIONS,
    '',
    `Vibe: ${opts.vibe}`,
    `Project: ${opts.project.name}`,
    `Canvas: ${opts.project.width}x${opts.project.height} @ ${opts.project.fps}fps`,
    '',
    'Output JSON only.',
  ].join('\n');

  const { stdout, exitCode, stderr } = await runClaude({
    prompt,
    cwd: opts.cwd,
    outputFormat: 'json',
    permissionMode: 'bypassPermissions',
  });
  if (exitCode !== 0) {
    throw new Error(`claude exited ${exitCode}: ${stderr || stdout}`);
  }

  const required = [
    'background',
    'surface',
    'textPrimary',
    'textSecondary',
    'accent',
    'accentContrast',
    'fontDisplay',
    'fontBody',
  ] as const;

  const partial = parseClaudeJson<Partial<Theme>>(stdout, (parsed) => {
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Claude did not return a JSON object for the theme.');
    }
    const obj = parsed as Record<string, unknown>;
    const missing = required.filter((k) => typeof obj[k] !== 'string' || !(obj[k] as string).trim());
    if (missing.length > 0) {
      throw new Error(
        `Claude theme JSON missing required string field(s): ${missing.join(', ')}`,
      );
    }
    return obj as Partial<Theme>;
  });

  return {
    vibe: opts.vibe,
    background: partial.background!,
    surface: partial.surface!,
    textPrimary: partial.textPrimary!,
    textSecondary: partial.textSecondary!,
    accent: partial.accent!,
    accentContrast: partial.accentContrast!,
    fontDisplay: partial.fontDisplay!,
    fontBody: partial.fontBody!,
    generatedAt: new Date().toISOString(),
  };
}
