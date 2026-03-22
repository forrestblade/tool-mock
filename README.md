# tool-mock

Mock framework for testing Claude Code hooks. Build fake payloads, run hooks against them, assert decisions.

## Install

```bash
npm install -g tool-mock
```

## Library Usage

```typescript
import { preToolUse, postToolUse, runHook, expectAllow, expectDeny } from 'tool-mock'

// Build a mock payload
const payload = preToolUse('Read', { file_path: '/etc/passwd' })

// Run a hook against it
const response = await runHook('~/.claude/hooks/my-hook.sh', payload)

// Assert the decision
expectDeny(response.unwrap())
```

## CLI

```bash
# Generate payloads
tool-mock payload pre Read --input '{"file_path":"/etc/passwd"}'
tool-mock payload post Bash --input '{"command":"cat .env"}' --response 'SECRET=abc'

# Run a scenario file
tool-mock run scenario.json
```

## Scenarios

Define multi-step test scenarios in JSON:

```json
{
  "name": "scope-lock denies .env access",
  "steps": [
    {
      "description": "Reading .env should be denied",
      "hook": "~/.claude/hooks/scope-lock.sh",
      "event": "PreToolUse",
      "toolName": "Read",
      "toolInput": { "file_path": ".env" },
      "expect": "deny"
    }
  ]
}
```

## Requirements

- Node.js >= 22, ESM only

## License

MIT
