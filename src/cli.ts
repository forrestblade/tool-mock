import { readFile } from 'node:fs/promises'
import { ResultAsync, fromThrowable } from '@valencets/resultkit'
import { preToolUse, postToolUse } from './payload.js'
import { runScenario } from './scenarios.js'
import type { Scenario, MockError } from './types.js'
import { MockErrorCode } from './types.js'

function loadScenarioFile (filePath: string): ResultAsync<Scenario, MockError> {
  return ResultAsync.fromPromise(
    readFile(filePath, 'utf-8'),
    (e): MockError => ({
      code: MockErrorCode.IO_FAILED,
      message: `Failed to read scenario file: ${String(e)}`,
    })
  ).andThen((content) => {
    const safeParse = fromThrowable(
      (text: string) => JSON.parse(text) as Scenario,
      (e): MockError => ({
        code: MockErrorCode.PARSE_FAILED,
        message: `Failed to parse scenario JSON: ${String(e)}`,
      })
    )
    return safeParse(content).toAsync()
  })
}

function printResults (result: Awaited<ReturnType<typeof runScenario>>): void {
  if (result.isErr()) {
    process.stderr.write(`Error: ${result.error.message}\n`)
    process.exitCode = 1
    return
  }

  const { scenario, steps, passed, durationMs } = result.value
  process.stdout.write(`\nScenario: ${scenario.name}\n`)
  process.stdout.write(`${'='.repeat(40)}\n`)

  for (const step of steps) {
    const icon = step.passed ? 'PASS' : 'FAIL'
    process.stdout.write(`  [${icon}] ${step.step.description}\n`)
    if (!step.passed && step.error !== undefined) {
      process.stdout.write(`         ${step.error}\n`)
    }
  }

  process.stdout.write(`\n${passed ? 'PASSED' : 'FAILED'} (${steps.length} steps, ${durationMs}ms)\n`)

  if (!passed) {
    process.exitCode = 1
  }
}

const commandHandlers: Record<string, (args: readonly string[]) => Promise<void>> = {
  run: async (args) => {
    const filePath = args[0]
    if (filePath === undefined) {
      process.stderr.write('Usage: tool-mock run <scenario.json>\n')
      process.exitCode = 1
      return
    }
    const loadResult = await loadScenarioFile(filePath)
    if (loadResult.isErr()) {
      process.stderr.write(`Error: ${loadResult.error.message}\n`)
      process.exitCode = 1
      return
    }
    const result = await runScenario(loadResult.value)
    printResults(result)
  },

  payload: async (args) => {
    const subcommand = args[0]
    const toolName = args[1]

    if (toolName === undefined) {
      process.stderr.write('Usage: tool-mock payload <pre|post> <tool> [--input json] [--response text]\n')
      process.exitCode = 1
      return
    }

    let input: Record<string, unknown> = {}
    let response = ''

    for (let i = 2; i < args.length; i++) {
      if (args[i] === '--input' && args[i + 1] !== undefined) {
        const safeParse = fromThrowable(
          (text: string) => JSON.parse(text) as Record<string, unknown>,
          () => null
        )
        const parsed = safeParse(args[i + 1] ?? '{}')
        if (parsed.isOk() && parsed.value !== null) {
          input = parsed.value
        }
        i++
      } else if (args[i] === '--response' && args[i + 1] !== undefined) {
        response = args[i + 1] ?? ''
        i++
      }
    }

    const payloadHandlers: Record<string, () => string> = {
      pre: () => preToolUse(toolName, input),
      post: () => postToolUse(toolName, input, response),
    }

    const handler = subcommand !== undefined ? payloadHandlers[subcommand] : undefined
    if (handler === undefined) {
      process.stderr.write('Usage: tool-mock payload <pre|post> <tool> [--input json] [--response text]\n')
      process.exitCode = 1
      return
    }

    process.stdout.write(handler() + '\n')
  },
}

export async function run (args: readonly string[]): Promise<void> {
  const command = args[0]

  if (command === undefined) {
    process.stderr.write('Usage: tool-mock <run|payload> [...args]\n')
    process.exitCode = 1
    return
  }

  const handler = commandHandlers[command]
  if (handler === undefined) {
    process.stderr.write(`Unknown command: ${command}\nUsage: tool-mock <run|payload> [...args]\n`)
    process.exitCode = 1
    return
  }

  await handler(args.slice(1))
}
