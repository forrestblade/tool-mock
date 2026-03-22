import type { HookResponse, MockError } from './types.js'
import { MockErrorCode } from './types.js'
import { err, ok } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'

export function expectAllow (response: HookResponse): Result<HookResponse, MockError> {
  if (response.decision !== 'allow') {
    return err({
      code: MockErrorCode.ASSERTION_FAILED,
      message: `Expected allow but got ${response.decision ?? 'unknown'} (exit code ${response.exitCode})`,
    })
  }
  return ok(response)
}

export function expectDeny (response: HookResponse): Result<HookResponse, MockError> {
  if (response.decision !== 'deny') {
    return err({
      code: MockErrorCode.ASSERTION_FAILED,
      message: `Expected deny but got ${response.decision ?? 'unknown'} (exit code ${response.exitCode})`,
    })
  }
  return ok(response)
}

export function expectDenyReason (
  response: HookResponse,
  pattern: string | RegExp
): Result<HookResponse, MockError> {
  const denyResult = expectDeny(response)
  if (denyResult.isErr()) {
    return denyResult
  }

  const reason = response.stderr.trim()
  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern)

  if (!regex.test(reason)) {
    return err({
      code: MockErrorCode.ASSERTION_FAILED,
      message: `Expected deny reason to match ${String(pattern)} but got: "${reason}"`,
    })
  }
  return ok(response)
}

export function expectWarning (
  response: HookResponse,
  pattern: string | RegExp
): Result<HookResponse, MockError> {
  if (response.decision !== 'allow') {
    return err({
      code: MockErrorCode.ASSERTION_FAILED,
      message: `Expected allow (with warning) but got ${response.decision ?? 'unknown'} (exit code ${response.exitCode})`,
    })
  }

  const output = response.stderr.trim() + '\n' + response.stdout.trim()
  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern)

  if (!regex.test(output)) {
    return err({
      code: MockErrorCode.ASSERTION_FAILED,
      message: `Expected warning matching ${String(pattern)} but none found in output`,
    })
  }
  return ok(response)
}
