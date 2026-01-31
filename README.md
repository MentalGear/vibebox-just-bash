# just-bash Playground

An interactive bash playground that runs just-bash in a Web Worker with xterm.js as the terminal interface.

## Features

- Full bash interpreter running in the browser
- In-memory virtual filesystem
- Command history (up/down arrows)
- Standard terminal shortcuts (Ctrl+C, Ctrl+L, Ctrl+U)
- Syntax highlighting for errors

## Quick Start

```bash
# Install dependencies
pnpm install

# Build the worker and start dev server
pnpm dev
```

Then open http://localhost:3000 in your browser.

## Architecture

```
index.html          Main page with xterm.js terminal
    |
    v
worker.ts           Web Worker running just-bash
    |
    v
just-bash/browser   Browser-compatible just-bash build
```

### Communication Protocol

The main thread and worker communicate via `postMessage`:

**Main -> Worker:**
- `{ type: 'exec', id: string, command: string }` - Execute a bash command
- `{ type: 'init', files?: Record<string, string> }` - Reinitialize with files
- `{ type: 'readFile', id: string, path: string }` - Read a file
- `{ type: 'writeFile', id: string, path: string, content: string }` - Write a file

**Worker -> Main:**
- `{ type: 'ready' }` - Worker is ready
- `{ type: 'result', id: string, stdout, stderr, exitCode }` - Command result
- `{ type: 'clear' }` - Clear terminal (from `clear` command)
- `{ type: 'error', id?: string, message: string }` - Error occurred

## Available Commands

Most bash built-ins and common utilities work:

- **File ops:** ls, cat, head, tail, cp, mv, rm, mkdir, touch, find, tree
- **Text processing:** grep, sed, awk, sort, uniq, wc, cut, tr, paste
- **Data formats:** jq (JSON), base64, md5sum, sha256sum
- **Shell:** echo, printf, env, export, pwd, cd, for/while/if

## Example Commands

```bash
# List files
ls -la

# View a file
cat README.txt

# Parse JSON
jq '.features[]' example.json

# Text processing pipeline
cat data.txt | sort | uniq | wc -l

# Loop
for i in 1 2 3; do echo "Number: $i"; done

# Variables and arithmetic
x=5; echo $((x * 2))
```

## Customization

### Adding Initial Files

Edit `worker.ts` to add files to the initial filesystem:

```typescript
const bash = new Bash({
  files: {
    "/home/user/myfile.txt": "content here",
    "/data/config.json": '{"key": "value"}',
  },
});
```

### Custom Commands

Add custom commands in `worker.ts`:

```typescript
import { defineCommand } from "just-bash/browser";

const myCommand = defineCommand("mycmd", async (args) => ({
  stdout: `Hello from custom command! Args: ${args.join(", ")}\n`,
  stderr: "",
  exitCode: 0,
}));

const bash = new Bash({
  customCommands: [myCommand],
});
```

## Production Build

For production, you may want to:

1. Bundle xterm.js locally instead of using CDN
2. Minify the worker bundle
3. Add service worker for offline support

```bash
# Build worker only
pnpm build

# Serve the built files
pnpm serve
```

## Browser Compatibility

Requires browsers with:
- Web Workers with ES modules (`type: 'module'`)
- ES2020+ features

Tested in Chrome, Firefox, Safari, and Edge (latest versions).
