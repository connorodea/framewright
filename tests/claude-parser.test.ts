import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock execa BEFORE importing the module under test so the SUT picks up the
// mock instead of the real binary. The factory must be self-contained.
vi.mock('execa', () => {
  const execa = vi.fn();
  return { execa };
});

import { execa } from 'execa';
import { parseScriptFromClaudeOutput, generateScript } from '../src/lib/claude.js';
import type { FramewrightProject } from '../src/lib/project.js';

const execaMock = vi.mocked(execa);

const SAMPLE_SCRIPT = {
  scenes: [
    { kind: 'title', text: 'Hello World', durationMs: 2000 },
    { kind: 'caption', text: 'A caption', durationMs: 2500 },
    { kind: 'voiceover', text: 'Narration here.', durationMs: 4000 },
  ],
};

describe('parseScriptFromClaudeOutput', () => {
  it('parses raw JSON', () => {
    const out = parseScriptFromClaudeOutput(JSON.stringify(SAMPLE_SCRIPT));
    expect(out).toEqual(SAMPLE_SCRIPT);
  });

  it('parses JSON wrapped in a ```json fenced code block', () => {
    const fenced = '```json\n' + JSON.stringify(SAMPLE_SCRIPT, null, 2) + '\n```';
    const out = parseScriptFromClaudeOutput(fenced);
    expect(out).toEqual(SAMPLE_SCRIPT);
  });

  it('parses JSON wrapped in a bare ``` fenced code block', () => {
    const fenced = '```\n' + JSON.stringify(SAMPLE_SCRIPT) + '\n```';
    const out = parseScriptFromClaudeOutput(fenced);
    expect(out).toEqual(SAMPLE_SCRIPT);
  });

  it('unwraps Claude Code --output-format json {"result": "..."} envelopes', () => {
    const wrapper = JSON.stringify({
      type: 'result',
      subtype: 'success',
      result: JSON.stringify(SAMPLE_SCRIPT),
    });
    const out = parseScriptFromClaudeOutput(wrapper);
    expect(out).toEqual(SAMPLE_SCRIPT);
  });

  it('handles the --output-format json envelope when result is fenced', () => {
    const inner = '```json\n' + JSON.stringify(SAMPLE_SCRIPT) + '\n```';
    const wrapper = JSON.stringify({ result: inner });
    const out = parseScriptFromClaudeOutput(wrapper);
    expect(out).toEqual(SAMPLE_SCRIPT);
  });

  it('tolerates leading/trailing whitespace', () => {
    const padded = '   \n\n' + JSON.stringify(SAMPLE_SCRIPT) + '\n\n  ';
    expect(parseScriptFromClaudeOutput(padded)).toEqual(SAMPLE_SCRIPT);
  });

  it('throws on completely malformed input', () => {
    expect(() => parseScriptFromClaudeOutput('not even close to json')).toThrow();
  });

  it('throws when the parsed object has no scenes array', () => {
    expect(() => parseScriptFromClaudeOutput(JSON.stringify({ foo: 'bar' }))).toThrow(
      /scenes/,
    );
  });

  it('throws when scenes is present but not an array', () => {
    expect(() =>
      parseScriptFromClaudeOutput(JSON.stringify({ scenes: 'nope' })),
    ).toThrow(/scenes/);
  });
});

describe('generateScript (with mocked execa)', () => {
  const fixture: FramewrightProject = {
    name: 'Test',
    slug: 'test',
    createdAt: '2026-05-01T00:00:00.000Z',
    width: 1080,
    height: 1920,
    fps: 30,
    scenes: [],
  };

  beforeEach(() => {
    execaMock.mockReset();
  });

  it('feeds Claude stdout through the parser', async () => {
    execaMock.mockResolvedValue({
      stdout: JSON.stringify({ result: JSON.stringify(SAMPLE_SCRIPT) }),
      stderr: '',
      exitCode: 0,
    } as never);

    const out = await generateScript({
      topic: 'cats',
      tone: 'playful',
      targetDurationSec: 15,
      project: fixture,
      cwd: '/tmp/x',
    });

    expect(out).toEqual(SAMPLE_SCRIPT);
    expect(execaMock).toHaveBeenCalledTimes(1);

    // Verify the prompt args got plumbed through.
    const [, args] = execaMock.mock.calls[0]!;
    const argList = args as string[];
    expect(argList).toContain('-p');
    expect(argList).toContain('--output-format');
    expect(argList).toContain('json');
    expect(argList).toContain('--permission-mode');
    expect(argList).toContain('bypassPermissions');
    const prompt = argList[argList.indexOf('-p') + 1]!;
    expect(prompt).toContain('Topic: cats');
    expect(prompt).toContain('Tone: playful');
    expect(prompt).toContain('1080x1920 @ 30fps');
  });

  it('throws a useful error when claude exits non-zero', async () => {
    execaMock.mockResolvedValue({
      stdout: '',
      stderr: 'boom',
      exitCode: 2,
    } as never);

    await expect(
      generateScript({
        topic: 'x',
        tone: 'x',
        targetDurationSec: 10,
        project: fixture,
        cwd: '/tmp',
      }),
    ).rejects.toThrow(/claude exited 2.*boom/);
  });
});
