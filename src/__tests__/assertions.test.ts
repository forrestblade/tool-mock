import { describe, it, expect } from 'vitest'
import { expectAllow, expectDeny, expectDenyReason, expectWarning } from '../assertions.js'
import type { HookResponse } from '../types.js'

function makeResponse (overrides: Partial<HookResponse> = {}): HookResponse {
  return {
    exitCode: 0,
    stdout: '',
    stderr: '',
    durationMs: 10,
    decision: 'allow',
    parsedOutput: null,
    ...overrides,
  }
}

describe('expectAllow', () => {
  it('returns ok for allow decision', () => {
    const response = makeResponse({ decision: 'allow' })
    const result = expectAllow(response)

    expect(result.isOk()).toBe(true)
  })

  it('returns err for deny decision', () => {
    const response = makeResponse({ decision: 'deny', exitCode: 2 })
    const result = expectAllow(response)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('ASSERTION_FAILED')
      expect(result.error.message).toContain('Expected allow')
    }
  })

  it('returns err for null decision', () => {
    const response = makeResponse({ decision: null, exitCode: 1 })
    const result = expectAllow(response)

    expect(result.isErr()).toBe(true)
  })
})

describe('expectDeny', () => {
  it('returns ok for deny decision', () => {
    const response = makeResponse({ decision: 'deny', exitCode: 2 })
    const result = expectDeny(response)

    expect(result.isOk()).toBe(true)
  })

  it('returns err for allow decision', () => {
    const response = makeResponse({ decision: 'allow' })
    const result = expectDeny(response)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('ASSERTION_FAILED')
      expect(result.error.message).toContain('Expected deny')
    }
  })
})

describe('expectDenyReason', () => {
  it('returns ok when reason matches string pattern', () => {
    const response = makeResponse({
      decision: 'deny',
      exitCode: 2,
      stderr: 'Access denied: sensitive file',
    })
    const result = expectDenyReason(response, 'sensitive')

    expect(result.isOk()).toBe(true)
  })

  it('returns ok when reason matches regex', () => {
    const response = makeResponse({
      decision: 'deny',
      exitCode: 2,
      stderr: 'Blocked: /etc/passwd',
    })
    const result = expectDenyReason(response, /\/etc\/passwd/)

    expect(result.isOk()).toBe(true)
  })

  it('returns err when reason does not match', () => {
    const response = makeResponse({
      decision: 'deny',
      exitCode: 2,
      stderr: 'Access denied',
    })
    const result = expectDenyReason(response, 'sensitive')

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toContain('Expected deny reason')
    }
  })

  it('returns err when decision is not deny', () => {
    const response = makeResponse({ decision: 'allow' })
    const result = expectDenyReason(response, 'anything')

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toContain('Expected deny')
    }
  })
})

describe('expectWarning', () => {
  it('returns ok when allow with matching stderr warning', () => {
    const response = makeResponse({
      decision: 'allow',
      stderr: 'Warning: this file is large',
    })
    const result = expectWarning(response, 'large')

    expect(result.isOk()).toBe(true)
  })

  it('returns ok when allow with matching stdout warning', () => {
    const response = makeResponse({
      decision: 'allow',
      stdout: '{"warning":"careful with that"}',
    })
    const result = expectWarning(response, 'careful')

    expect(result.isOk()).toBe(true)
  })

  it('returns err when denied', () => {
    const response = makeResponse({ decision: 'deny', exitCode: 2 })
    const result = expectWarning(response, 'anything')

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toContain('Expected allow')
    }
  })

  it('returns err when warning pattern does not match', () => {
    const response = makeResponse({
      decision: 'allow',
      stderr: 'all clear',
      stdout: '',
    })
    const result = expectWarning(response, 'danger')

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toContain('Expected warning matching')
    }
  })

  it('accepts regex patterns', () => {
    const response = makeResponse({
      decision: 'allow',
      stderr: 'Warning: file size is 1024 bytes',
    })
    const result = expectWarning(response, /\d+ bytes/)

    expect(result.isOk()).toBe(true)
  })
})
