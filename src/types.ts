export const HookEvent = { PRE_TOOL_USE: 'PreToolUse', POST_TOOL_USE: 'PostToolUse' } as const
export type HookEvent = typeof HookEvent[keyof typeof HookEvent]

export const Decision = { ALLOW: 'allow', DENY: 'deny' } as const
export type Decision = typeof Decision[keyof typeof Decision]

export const MockErrorCode = {
  SPAWN_FAILED: 'SPAWN_FAILED',
  HOOK_TIMEOUT: 'HOOK_TIMEOUT',
  HOOK_CRASHED: 'HOOK_CRASHED',
  PARSE_FAILED: 'PARSE_FAILED',
  ASSERTION_FAILED: 'ASSERTION_FAILED',
  SCENARIO_FAILED: 'SCENARIO_FAILED',
  IO_FAILED: 'IO_FAILED',
} as const
export type MockErrorCode = typeof MockErrorCode[keyof typeof MockErrorCode]

export interface MockError {
  readonly code: MockErrorCode
  readonly message: string
}

export interface ToolPayload {
  readonly tool_name: string
  readonly tool_input: Record<string, unknown>
  readonly tool_response?: unknown
}

export interface PreToolUsePayload {
  readonly hook_type: 'PreToolUse'
  readonly tool_name: string
  readonly tool_input: Record<string, unknown>
}

export interface PostToolUsePayload {
  readonly hook_type: 'PostToolUse'
  readonly tool_name: string
  readonly tool_input: Record<string, unknown>
  readonly tool_response: unknown
}

export interface HookResponse {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
  readonly durationMs: number
  readonly decision: Decision | null
  readonly parsedOutput: Record<string, unknown> | null
}

export interface MockDefinition {
  readonly name: string
  readonly description?: string
  readonly files?: Record<string, string>
  readonly commands?: Record<string, MockCommandResult>
  readonly mcpResponses?: Record<string, unknown>
}

export interface MockCommandResult {
  readonly stdout: string
  readonly stderr?: string
  readonly exitCode?: number
}

export interface ScenarioStep {
  readonly description: string
  readonly hook: string
  readonly event: HookEvent
  readonly toolName: string
  readonly toolInput: Record<string, unknown>
  readonly toolResponse?: unknown
  readonly expect: 'allow' | 'deny' | 'warning'
  readonly expectReason?: string
}

export interface Scenario {
  readonly name: string
  readonly steps: readonly ScenarioStep[]
}

export interface StepResult {
  readonly step: ScenarioStep
  readonly passed: boolean
  readonly response: HookResponse
  readonly error?: string
}

export interface ScenarioResult {
  readonly scenario: Scenario
  readonly steps: readonly StepResult[]
  readonly passed: boolean
  readonly durationMs: number
}
