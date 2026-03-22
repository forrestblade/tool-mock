import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { runHook } from '../runner.js'
import { preToolUse } from '../payload.js'

describe('runHook', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tool-mock-runner-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  async function writeScript (name: string, content: string): Promise<string> {
    const scriptPath = path.join(tmpDir, name)
    await fs.writeFile(scriptPath, content, { mode: 0o755 })
    return scriptPath
  }

  it('exit 0 produces allow decision', async () => {
    const script = await writeScript('allow.sh', '#!/usr/bin/env bash\nexit 0\n')
    const payload = preToolUse('Read', { file_path: '/tmp/test' })

    const result = await runHook(script, payload)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.exitCode).toBe(0)
      expect(result.value.decision).toBe('allow')
    }
  })

  it('exit 2 produces deny decision', async () => {
    const script = await writeScript('deny.sh', '#!/usr/bin/env bash\necho "blocked" >&2\nexit 2\n')
    const payload = preToolUse('Write', { file_path: '/etc/passwd', content: 'bad' })

    const result = await runHook(script, payload)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.exitCode).toBe(2)
      expect(result.value.decision).toBe('deny')
      expect(result.value.stderr).toContain('blocked')
    }
  })

  it('exit 1 produces null decision', async () => {
    const script = await writeScript('error.sh', '#!/usr/bin/env bash\nexit 1\n')
    const payload = preToolUse('Bash', { command: 'ls' })

    const result = await runHook(script, payload)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.exitCode).toBe(1)
      expect(result.value.decision).toBeNull()
    }
  })

  it('receives payload on stdin', async () => {
    const script = await writeScript('echo.sh', '#!/usr/bin/env bash\ncat\nexit 0\n')
    const payload = preToolUse('Bash', { command: 'echo hello' })

    const result = await runHook(script, payload)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.parsedOutput).toEqual(JSON.parse(payload))
    }
  })

  it('captures JSON stdout as parsedOutput', async () => {
    const script = await writeScript('json.sh', '#!/usr/bin/env bash\necho \'{"reason":"testing"}\'\nexit 0\n')
    const payload = preToolUse('Read', { file_path: '/tmp/x' })

    const result = await runHook(script, payload)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.parsedOutput).toEqual({ reason: 'testing' })
    }
  })

  it('non-JSON stdout results in null parsedOutput', async () => {
    const script = await writeScript('text.sh', '#!/usr/bin/env bash\necho "plain text"\nexit 0\n')
    const payload = preToolUse('Read', { file_path: '/tmp/x' })

    const result = await runHook(script, payload)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.parsedOutput).toBeNull()
    }
  })

  it('records durationMs', async () => {
    const script = await writeScript('fast.sh', '#!/usr/bin/env bash\nexit 0\n')
    const payload = preToolUse('Read', { file_path: '/tmp/x' })

    const result = await runHook(script, payload)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.durationMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('times out slow scripts', async () => {
    const script = await writeScript('slow.sh', '#!/usr/bin/env bash\nsleep 30\nexit 0\n')
    const payload = preToolUse('Read', { file_path: '/tmp/x' })

    const result = await runHook(script, payload, 200)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('HOOK_TIMEOUT')
    }
  }, 15_000)
})
