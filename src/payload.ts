import type { PreToolUsePayload, PostToolUsePayload } from './types.js'

export function preToolUse (toolName: string, toolInput: Record<string, unknown>): string {
  const payload: PreToolUsePayload = {
    hook_type: 'PreToolUse',
    tool_name: toolName,
    tool_input: toolInput,
  }
  return JSON.stringify(payload)
}

export function postToolUse (
  toolName: string,
  toolInput: Record<string, unknown>,
  toolResponse: unknown
): string {
  const payload: PostToolUsePayload = {
    hook_type: 'PostToolUse',
    tool_name: toolName,
    tool_input: toolInput,
    tool_response: toolResponse,
  }
  return JSON.stringify(payload)
}
