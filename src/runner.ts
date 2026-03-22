import { spawn } from 'node:child_process'
import { ResultAsync, fromThrowable } from '@valencets/resultkit'
import type { HookResponse, MockError } from './types.js'
import { MockErrorCode, Decision } from './types.js'

const DEFAULT_TIMEOUT_MS = 10_000

const decisionMap: Record<number, Decision> = {
  0: Decision.ALLOW,
  2: Decision.DENY,
}

function parseJsonOutput (stdout: string): Record<string, unknown> | null {
  if (stdout.trim().length === 0) {
    return null
  }
  const safeParse = fromThrowable(
    (text: string) => JSON.parse(text) as Record<string, unknown>,
    () => null
  )
  const result = safeParse(stdout.trim())
  return result.isOk() ? result.value : null
}

export function runHook (
  command: string,
  payload: string,
  timeoutMs?: number
): ResultAsync<HookResponse, MockError> {
  const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS

  return ResultAsync.fromPromise(
    new Promise<HookResponse>((resolve, reject) => {
      const startTime = Date.now()
      const child = spawn('bash', ['-c', command], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true,
      })

      let stdout = ''
      let stderr = ''
      let killed = false

      const timer = setTimeout(() => {
        killed = true
        if (child.pid !== undefined) {
          process.kill(-child.pid, 'SIGKILL')
        }
      }, timeout)

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      child.on('error', (e) => {
        clearTimeout(timer)
        reject(e)
      })

      child.on('close', (code) => {
        clearTimeout(timer)
        const durationMs = Date.now() - startTime

        if (killed) {
          reject(new Error(`Hook timed out after ${timeout}ms`))
          return
        }

        const exitCode = code ?? 1
        const decision = decisionMap[exitCode] ?? null

        resolve({
          exitCode,
          stdout,
          stderr,
          durationMs,
          decision,
          parsedOutput: parseJsonOutput(stdout),
        })
      })

      child.stdin.write(payload)
      child.stdin.end()
    }),
    (e): MockError => {
      const message = String(e)
      if (message.includes('timed out')) {
        return { code: MockErrorCode.HOOK_TIMEOUT, message }
      }
      return { code: MockErrorCode.SPAWN_FAILED, message: `Failed to spawn hook process: ${message}` }
    }
  )
}
