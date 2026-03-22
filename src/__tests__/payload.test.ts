import { describe, it, expect } from 'vitest'
import { preToolUse, postToolUse } from '../payload.js'

describe('preToolUse', () => {
  it('builds a PreToolUse payload for Read', () => {
    const result = JSON.parse(preToolUse('Read', { file_path: '/etc/passwd' }))

    expect(result).toEqual({
      hook_type: 'PreToolUse',
      tool_name: 'Read',
      tool_input: { file_path: '/etc/passwd' },
    })
  })

  it('builds a PreToolUse payload for Write', () => {
    const result = JSON.parse(preToolUse('Write', {
      file_path: '/tmp/test.ts',
      content: 'console.log("hi")',
    }))

    expect(result).toEqual({
      hook_type: 'PreToolUse',
      tool_name: 'Write',
      tool_input: {
        file_path: '/tmp/test.ts',
        content: 'console.log("hi")',
      },
    })
  })

  it('builds a PreToolUse payload for Bash', () => {
    const result = JSON.parse(preToolUse('Bash', { command: 'ls -la' }))

    expect(result).toEqual({
      hook_type: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls -la' },
    })
  })

  it('builds a PreToolUse payload for MCP tools', () => {
    const result = JSON.parse(preToolUse('mcp__sentinel__get_state', { session_id: 'abc' }))

    expect(result).toEqual({
      hook_type: 'PreToolUse',
      tool_name: 'mcp__sentinel__get_state',
      tool_input: { session_id: 'abc' },
    })
  })

  it('returns valid JSON string', () => {
    const payload = preToolUse('Grep', { pattern: 'foo' })
    expect(() => JSON.parse(payload)).not.toThrow()
  })

  it('handles empty tool input', () => {
    const result = JSON.parse(preToolUse('Read', {}))

    expect(result.tool_input).toEqual({})
  })
})

describe('postToolUse', () => {
  it('builds a PostToolUse payload for Bash', () => {
    const result = JSON.parse(postToolUse(
      'Bash',
      { command: 'cat .env' },
      'SECRET_KEY=abc123'
    ))

    expect(result).toEqual({
      hook_type: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'cat .env' },
      tool_response: 'SECRET_KEY=abc123',
    })
  })

  it('builds a PostToolUse payload for Read with object response', () => {
    const result = JSON.parse(postToolUse(
      'Read',
      { file_path: '/tmp/test.json' },
      { content: '{"key": "value"}', lines: 1 }
    ))

    expect(result).toEqual({
      hook_type: 'PostToolUse',
      tool_name: 'Read',
      tool_input: { file_path: '/tmp/test.json' },
      tool_response: { content: '{"key": "value"}', lines: 1 },
    })
  })

  it('handles null tool response', () => {
    const result = JSON.parse(postToolUse('Write', { file_path: '/tmp/x' }, null))

    expect(result.tool_response).toBeNull()
  })

  it('returns valid JSON string', () => {
    const payload = postToolUse('Bash', { command: 'echo hi' }, 'hi')
    expect(() => JSON.parse(payload)).not.toThrow()
  })
})
