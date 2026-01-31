/**
 * Web Worker that runs just-bash
 *
 * Handles messages from the main thread to execute bash commands
 * and sends results back.
 */

import { Bash, defineCommand } from "just-bash/browser";

type WorkerMessage =
  | { type: "exec"; id: string; command: string }
  | { type: "init"; files?: Record<string, string> }
  | { type: "readFile"; id: string; path: string }
  | { type: "writeFile"; id: string; path: string; content: string }
  | { type: "getCwd" }
  | { type: "getEnv" };

type WorkerResponse =
  | { type: "ready" }
  | { type: "result"; id: string; stdout: string; stderr: string; exitCode: number }
  | { type: "file"; id: string; content: string }
  | { type: "written"; id: string }
  | { type: "cwd"; cwd: string }
  | { type: "env"; env: Record<string, string> }
  | { type: "error"; id?: string; message: string };

// Custom clear command to send clear signal to terminal
const clearCommand = defineCommand("clear", async () => {
  self.postMessage({ type: "clear" });
  return { stdout: "", stderr: "", exitCode: 0 };
});

// Create bash instance with in-memory filesystem
let bash = new Bash({
  customCommands: [clearCommand],
  files: {
    "/home/user/.bashrc": 'export PS1="$ "',
    "/home/user/README.txt":
      "Welcome to just-bash playground!\n\nThis is a bash interpreter running entirely in your browser.\nTry some commands like: ls, echo, cat, grep, awk, sed, jq, etc.\n",
    "/home/user/example.json": '{"name": "just-bash", "version": "1.0", "features": ["in-memory fs", "web worker", "xterm.js"]}',
    "/home/user/data.txt": "apple\nbanana\ncherry\ndate\nelderberry\nfig\ngrape\n",
  },
  cwd: "/home/user",
  env: {
    HOME: "/home/user",
    USER: "user",
    PATH: "/bin:/usr/bin",
    SHELL: "/bin/bash",
    TERM: "xterm-256color",
  },
});

function send(message: WorkerResponse) {
  self.postMessage(message);
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case "init": {
        // Reinitialize bash with optional files
        const files = msg.files || {};
        bash = new Bash({
          customCommands: [clearCommand],
          files: {
            "/home/user/.bashrc": 'export PS1="$ "',
            "/home/user/README.txt":
              "Welcome to just-bash playground!\n\nThis is a bash interpreter running entirely in your browser.\nTry some commands like: ls, echo, cat, grep, awk, sed, jq, etc.\n",
            ...files,
          },
          cwd: "/home/user",
          env: {
            HOME: "/home/user",
            USER: "user",
            PATH: "/bin:/usr/bin",
            SHELL: "/bin/bash",
            TERM: "xterm-256color",
          },
        });
        send({ type: "ready" });
        break;
      }

      case "exec": {
        const result = await bash.exec(msg.command);
        send({
          type: "result",
          id: msg.id,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        });
        break;
      }

      case "readFile": {
        const content = await bash.readFile(msg.path);
        send({ type: "file", id: msg.id, content });
        break;
      }

      case "writeFile": {
        await bash.writeFile(msg.path, msg.content);
        send({ type: "written", id: msg.id });
        break;
      }

      case "getCwd": {
        send({ type: "cwd", cwd: bash.getCwd() });
        break;
      }

      case "getEnv": {
        send({ type: "env", env: bash.getEnv() });
        break;
      }

      default:
        send({ type: "error", message: `Unknown message type` });
    }
  } catch (err) {
    const id = "id" in msg ? msg.id : undefined;
    send({
      type: "error",
      id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

// Signal that worker is ready
send({ type: "ready" });
