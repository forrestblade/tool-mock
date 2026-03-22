import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { runScenario } from '../scenarios.js'
import type { Scenario } from '../types.js'

describe('runScenario', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tool-mock-scenario-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  async function writeScript (name: string, content: string): Promise<string> {
    const scriptPath = path.join(tmpDir, name)
    await fs.writeFile(scriptPath, content, { mode: 0o755 })
    return scriptPath
  }

  it('runs a single-step allow scenario', async () => {
    const hookPath = await writeScript('allow.sh', '#!/usr/bin/env bash\nexit 0\n')

    const scenario: Scenario = {
      name: 'Allow read',
      steps: [
        {
          description: 'Allow reading a normal file',
          hook: hookPath,
          event: 'PreToolUse',
          toolName: 'Read',
          toolInput: { file_path: '/tmp/test.txt' },
          expect: 'allow',
        },
      ],
    }

    const result = await runScenario(scenario)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.passed).toBe(true)
      expect(result.value.steps).toHaveLength(1)
      expect(result.value.steps[0]?.passed).toBe(true)
      expect(result.value.durationMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('runs a single-step deny scenario', async () => {
    const hookPath = await writeScript('deny.sh', '#!/usr/bin/env bash\necho "blocked" >&2\nexit 2\n')

    const scenario: Scenario = {
      name: 'Deny sensitive read',
      steps: [
        {
          description: 'Block reading /etc/passwd',
          hook: hookPath,
          event: 'PreToolUse',
          toolName: 'Read',
          toolInput: { file_path: '/etc/passwd' },
          expect: 'deny',
        },
      ],
    }

    const result = await runScenario(scenario)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.passed).toBe(true)
    }
  })

  it('reports failure when expectation does not match', async () => {
    const hookPath = await writeScript('allow.sh', '#!/usr/bin/env bash\nexit 0\n')

    const scenario: Scenario = {
      name: 'Expected deny but got allow',
      steps: [
        {
          description: 'Should deny but allows',
          hook: hookPath,
          event: 'PreToolUse',
          toolName: 'Write',
          toolInput: { file_path: '/etc/shadow', content: 'x' },
          expect: 'deny',
        },
      ],
    }

    const result = await runScenario(scenario)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.passed).toBe(false)
      expect(result.value.steps[0]?.passed).toBe(false)
      expect(result.value.steps[0]?.error).toContain('Expected deny')
    }
  })

  it('runs multi-step scenarios', async () => {
    const allowPath = await writeScript('allow.sh', '#!/usr/bin/env bash\nexit 0\n')
    const denyPath = await writeScript('deny.sh', '#!/usr/bin/env bash\necho "no" >&2\nexit 2\n')

    const scenario: Scenario = {
      name: 'Mixed allow and deny',
      steps: [
        {
          description: 'Allow normal read',
          hook: allowPath,
          event: 'PreToolUse',
          toolName: 'Read',
          toolInput: { file_path: '/tmp/ok.txt' },
          expect: 'allow',
        },
        {
          description: 'Deny sensitive write',
          hook: denyPath,
          event: 'PreToolUse',
          toolName: 'Write',
          toolInput: { file_path: '/etc/passwd', content: 'x' },
          expect: 'deny',
        },
        {
          description: 'Allow bash command',
          hook: allowPath,
          event: 'PostToolUse',
          toolName: 'Bash',
          toolInput: { command: 'echo hi' },
          toolResponse: 'hi',
          expect: 'allow',
        },
      ],
    }

    const result = await runScenario(scenario)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.passed).toBe(true)
      expect(result.value.steps).toHaveLength(3)
      expect(result.value.steps.every((s) => s.passed)).toBe(true)
    }
  })

  it('handles deny with expectReason', async () => {
    const hookPath = await writeScript('deny-reason.sh', '#!/usr/bin/env bash\necho "sensitive file detected" >&2\nexit 2\n')

    const scenario: Scenario = {
      name: 'Deny with reason check',
      steps: [
        {
          description: 'Deny with specific reason',
          hook: hookPath,
          event: 'PreToolUse',
          toolName: 'Read',
          toolInput: { file_path: '/etc/shadow' },
          expect: 'deny',
          expectReason: 'sensitive',
        },
      ],
    }

    const result = await runScenario(scenario)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.passed).toBe(true)
    }
  })

  it('fails when expectReason does not match', async () => {
    const hookPath = await writeScript('deny-other.sh', '#!/usr/bin/env bash\necho "access denied" >&2\nexit 2\n')

    const scenario: Scenario = {
      name: 'Deny with wrong reason',
      steps: [
        {
          description: 'Deny but reason does not match',
          hook: hookPath,
          event: 'PreToolUse',
          toolName: 'Read',
          toolInput: { file_path: '/etc/shadow' },
          expect: 'deny',
          expectReason: 'sensitive',
        },
      ],
    }

    const result = await runScenario(scenario)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.passed).toBe(false)
      expect(result.value.steps[0]?.error).toContain('Expected deny reason')
    }
  })

  it('records total durationMs for scenario', async () => {
    const hookPath = await writeScript('allow.sh', '#!/usr/bin/env bash\nexit 0\n')

    const scenario: Scenario = {
      name: 'Duration check',
      steps: [
        {
          description: 'Step 1',
          hook: hookPath,
          event: 'PreToolUse',
          toolName: 'Read',
          toolInput: { file_path: '/tmp/x' },
          expect: 'allow',
        },
      ],
    }

    const result = await runScenario(scenario)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.durationMs).toBeGreaterThanOrEqual(0)
    }
  })
})
