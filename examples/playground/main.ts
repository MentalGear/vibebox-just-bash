/**
 * Main entry point for the playground
 * Initializes xterm.js and connects to the worker
 */

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

// Initialize terminal
const term = new Terminal({
  cursorBlink: true,
  fontSize: 14,
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  theme: {
    background: "#0f0f23",
    foreground: "#cccccc",
    cursor: "#e94560",
    cursorAccent: "#0f0f23",
    selectionBackground: "#3d3d5c",
    black: "#1a1a2e",
    red: "#e94560",
    green: "#4caf50",
    yellow: "#ff9800",
    blue: "#2196f3",
    magenta: "#9c27b0",
    cyan: "#00bcd4",
    white: "#eee",
    brightBlack: "#666",
    brightRed: "#ff6b6b",
    brightGreen: "#69f0ae",
    brightYellow: "#ffca28",
    brightBlue: "#64b5f6",
    brightMagenta: "#ce93d8",
    brightCyan: "#4dd0e1",
    brightWhite: "#fff",
  },
});

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
term.open(document.getElementById("terminal")!);
fitAddon.fit();

// Handle window resize
window.addEventListener("resize", () => fitAddon.fit());

// Worker and state management
const worker = new Worker("./dist/worker.js", { type: "module" });
let commandBuffer = "";
let historyIndex = -1;
const commandHistory: string[] = [];
let currentLine = "";
let isReady = false;
const pendingCallbacks = new Map<string, (result: ExecResult) => void>();
let callbackId = 0;

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const statusDot = document.getElementById("status-dot")!;
const statusText = document.getElementById("status-text")!;

function setStatus(status: string, text: string) {
  statusDot.className = "status-dot " + status;
  statusText.textContent = text;
}

// Send command to worker and get result
function execCommand(command: string): Promise<ExecResult> {
  return new Promise((resolve) => {
    const id = String(callbackId++);
    pendingCallbacks.set(id, resolve);
    worker.postMessage({ type: "exec", id, command });
  });
}

// Handle worker messages
worker.onmessage = (event) => {
  const msg = event.data;

  switch (msg.type) {
    case "ready":
      isReady = true;
      setStatus("ready", "Ready");
      term.writeln(
        "\x1b[1;32mjust-bash\x1b[0m v1.0 - A bash interpreter in your browser"
      );
      term.writeln("Type \x1b[1;36mhelp\x1b[0m for available commands, or try:");
      term.writeln("  \x1b[33mcat README.txt\x1b[0m    - View welcome message");
      term.writeln("  \x1b[33mls -la\x1b[0m           - List files");
      term.writeln("  \x1b[33mjq . example.json\x1b[0m - Parse JSON");
      term.writeln("");
      prompt();
      break;

    case "result":
      if (pendingCallbacks.has(msg.id)) {
        pendingCallbacks.get(msg.id)!(msg);
        pendingCallbacks.delete(msg.id);
      }
      break;

    case "clear":
      term.clear();
      break;

    case "error":
      if (msg.id && pendingCallbacks.has(msg.id)) {
        pendingCallbacks.get(msg.id)!({
          stdout: "",
          stderr: msg.message,
          exitCode: 1,
        });
        pendingCallbacks.delete(msg.id);
      } else {
        term.writeln("\x1b[31mError: " + msg.message + "\x1b[0m");
      }
      break;
  }
};

worker.onerror = (error) => {
  setStatus("", "Error");
  term.writeln("\x1b[31mWorker error: " + error.message + "\x1b[0m");
};

// Write prompt
function prompt() {
  term.write("\x1b[1;32m$\x1b[0m ");
}

// Process command
async function processCommand(cmd: string) {
  const trimmed = cmd.trim();

  if (!trimmed) {
    prompt();
    return;
  }

  // Add to history
  if (commandHistory[commandHistory.length - 1] !== trimmed) {
    commandHistory.push(trimmed);
  }
  historyIndex = commandHistory.length;

  // Handle built-in help command
  if (trimmed === "help") {
    term.writeln("\x1b[1;36mAvailable Commands:\x1b[0m");
    term.writeln("");
    term.writeln("\x1b[1mFile Operations:\x1b[0m");
    term.writeln("  ls, cat, head, tail, cp, mv, rm, mkdir, touch, find, tree");
    term.writeln("");
    term.writeln("\x1b[1mText Processing:\x1b[0m");
    term.writeln("  grep, sed, awk, sort, uniq, wc, cut, tr, paste, column");
    term.writeln("");
    term.writeln("\x1b[1mData Formats:\x1b[0m");
    term.writeln("  jq (JSON), base64, md5sum, sha256sum");
    term.writeln("");
    term.writeln("\x1b[1mShell:\x1b[0m");
    term.writeln("  echo, printf, env, export, pwd, cd, history, clear");
    term.writeln("");
    term.writeln("\x1b[1mExamples:\x1b[0m");
    term.writeln('  echo "Hello World"');
    term.writeln("  cat data.txt | sort | uniq");
    term.writeln('  jq ".features[]" example.json');
    term.writeln("  for i in 1 2 3; do echo $i; done");
    term.writeln("");
    prompt();
    return;
  }

  // Handle history command
  if (trimmed === "history") {
    commandHistory.forEach((cmd, i) => {
      term.writeln(`  ${i + 1}  ${cmd}`);
    });
    prompt();
    return;
  }

  setStatus("busy", "Running...");

  try {
    const result = await execCommand(trimmed);

    // Write stdout
    if (result.stdout) {
      const lines = result.stdout.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (i < lines.length - 1 || lines[i]) {
          term.writeln(lines[i]);
        }
      }
    }

    // Write stderr in red
    if (result.stderr) {
      const lines = result.stderr.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (i < lines.length - 1 || lines[i]) {
          term.writeln("\x1b[31m" + lines[i] + "\x1b[0m");
        }
      }
    }
  } catch (err) {
    term.writeln(
      "\x1b[31mError: " + (err instanceof Error ? err.message : err) + "\x1b[0m"
    );
  }

  setStatus("ready", "Ready");
  prompt();
}

// Handle terminal input
term.onData((data) => {
  if (!isReady) return;

  const code = data.charCodeAt(0);

  // Enter key
  if (data === "\r") {
    term.writeln("");
    processCommand(commandBuffer);
    commandBuffer = "";
    currentLine = "";
    return;
  }

  // Backspace
  if (data === "\x7f") {
    if (commandBuffer.length > 0) {
      commandBuffer = commandBuffer.slice(0, -1);
      term.write("\b \b");
    }
    return;
  }

  // Ctrl+C
  if (data === "\x03") {
    term.writeln("^C");
    commandBuffer = "";
    prompt();
    return;
  }

  // Ctrl+L (clear)
  if (data === "\x0c") {
    term.clear();
    prompt();
    term.write(commandBuffer);
    return;
  }

  // Ctrl+U (clear line)
  if (data === "\x15") {
    term.write("\r\x1b[K");
    prompt();
    commandBuffer = "";
    return;
  }

  // Arrow keys (escape sequences)
  if (data.startsWith("\x1b[")) {
    // Up arrow
    if (data === "\x1b[A") {
      if (historyIndex > 0) {
        historyIndex--;
        term.write("\r\x1b[K");
        prompt();
        commandBuffer = commandHistory[historyIndex];
        term.write(commandBuffer);
      }
      return;
    }

    // Down arrow
    if (data === "\x1b[B") {
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        term.write("\r\x1b[K");
        prompt();
        commandBuffer = commandHistory[historyIndex];
        term.write(commandBuffer);
      } else if (historyIndex === commandHistory.length - 1) {
        historyIndex = commandHistory.length;
        term.write("\r\x1b[K");
        prompt();
        commandBuffer = currentLine;
        term.write(commandBuffer);
      }
      return;
    }

    // Ignore other escape sequences
    return;
  }

  // Regular character - only printable ASCII
  if (code >= 32 && code < 127) {
    commandBuffer += data;
    term.write(data);
  }
});

// Focus terminal on click
document.getElementById("terminal-container")!.addEventListener("click", () => {
  term.focus();
});

// Initial focus
term.focus();
