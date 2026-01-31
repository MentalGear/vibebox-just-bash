// Browser shim for Node.js process global
export const process = {
  env: {},
  platform: 'browser',
  version: 'v0.0.0',
  versions: {},
  cwd: () => '/',
  chdir: () => {},
  nextTick: (fn, ...args) => setTimeout(() => fn(...args), 0),
  stdout: { write: () => {} },
  stderr: { write: () => {} },
  stdin: { read: () => null },
  argv: [],
  exit: () => {},
  on: () => {},
  off: () => {},
  once: () => {},
  emit: () => {},
};

// Make it globally available
globalThis.process = process;
