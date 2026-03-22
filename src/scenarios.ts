import { ResultAsync, ok, err } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import { runHook } from './runner.js'
import { preToolUse, postToolUse } from './payload.js'
import { expectAllow, expectDeny, expectWarning } from './assertions.js'
import type { Scenario, ScenarioResult, StepResult, ScenarioStep, HookResponse, MockError } from './types.js'
import { HookEvent, MockErrorCode } from './types.js'

function buildPayload (step: ScenarioStep): string {
  if (step.event === HookEvent.POST_TOOL_USE) {
    return postToolUse(step.toolName, step.toolInput, step.toolResponse ?? '')
  }
  return preToolUse(step.toolName, step.toolInput)
}

const expectationCheckers: Record<string, (response: HookResponse, step: ScenarioStep) => Result<HookResponse, MockError>> = {
  allow: (response) => expectAllow(response),
  deny: (response, step) => {
    if (step.expectReason !== undefined) {
      const denyResult = expectDeny(response)
      if (denyResult.isErr()) return denyResult
      const reason = response.stderr.trim()
      const regex = new RegExp(step.expectReason)
      if (!regex.test(reason)) {
        return err({
          code: MockErrorCode.ASSERTION_FAILED,
          message: `Expected deny reason to match ${step.expectReason} but got: "${reason}"`,
        })
      }
      return ok(response)
    }
    return expectDeny(response)
  },
  warning: (response, step) => expectWarning(response, step.expectReason ?? '.*'),
}

function checkExpectation (step: ScenarioStep, response: HookResponse): StepResult {
  const checker = expectationCheckers[step.expect]
  if (checker === undefined) {
    return {
      step,
      passed: false,
      response,
      error: `Unknown expectation: ${step.expect}`,
    }
  }

  const result = checker(response, step)
  if (result.isErr()) {
    return {
      step,
      passed: false,
      response,
      error: result.error.message,
    }
  }

  return { step, passed: true, response }
}

export function runScenario (scenario: Scenario): ResultAsync<ScenarioResult, MockError> {
  const startTime = Date.now()

  return ResultAsync.fromPromise(
    (async (): Promise<ScenarioResult> => {
      const stepResults: StepResult[] = []

      for (const step of scenario.steps) {
        const payload = buildPayload(step)
        const hookResult = await runHook(step.hook, payload)

        if (hookResult.isErr()) {
          stepResults.push({
            step,
            passed: false,
            response: {
              exitCode: -1,
              stdout: '',
              stderr: '',
              durationMs: 0,
              decision: null,
              parsedOutput: null,
            },
            error: hookResult.error.message,
          })
          continue
        }

        stepResults.push(checkExpectation(step, hookResult.value))
      }

      return {
        scenario,
        steps: stepResults,
        passed: stepResults.every((s) => s.passed),
        durationMs: Date.now() - startTime,
      }
    })(),
    (e): MockError => ({
      code: MockErrorCode.SCENARIO_FAILED,
      message: `Scenario "${scenario.name}" failed: ${String(e)}`,
    })
  )
}
