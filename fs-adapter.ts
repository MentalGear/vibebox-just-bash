/**
 * Adapter to bridge just-bash's IFileSystem to isomorphic-git's expected fs interface.
 *
 * isomorphic-git expects a Node.js-like fs module with a `promises` property.
 * This adapter wraps IFileSystem methods to match that interface.
 */

import type { IFileSystem } from "just-bash/browser";

/**
 * Create a Node.js-style error with code property
 */
function createFsError(code: string, message: string, path: string): Error & { code: string } {
  const err = new Error(`${code}: ${message}, '${path}'`) as Error & { code: string };
  err.code = code;
  return err;
}

/**
 * Wrap an async operation to convert just-bash errors to Node.js-style errors
 */
async function wrapFsOp<T>(op: () => Promise<T>, path: string): Promise<T> {
  try {
    return await op();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("no such file") || msg.includes("ENOENT") || msg.includes("not found") || msg.includes("does not exist")) {
      throw createFsError("ENOENT", "no such file or directory", path);
    }
    if (msg.includes("ENOTDIR") || msg.includes("not a directory")) {
      throw createFsError("ENOTDIR", "not a directory", path);
    }
    if (msg.includes("EISDIR") || msg.includes("is a directory")) {
      throw createFsError("EISDIR", "illegal operation on a directory", path);
    }
    if (msg.includes("EEXIST") || msg.includes("already exists")) {
      throw createFsError("EEXIST", "file already exists", path);
    }
    if (msg.includes("ENOTEMPTY") || msg.includes("not empty")) {
      throw createFsError("ENOTEMPTY", "directory not empty", path);
    }
    throw err;
  }
}

/**
 * Node.js-compatible Stats object for isomorphic-git
 */
class Stats {
  mode: number;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  uid: number = 1000;
  gid: number = 1000;
  ino: number = 0;

  private _isFile: boolean;
  private _isDirectory: boolean;
  private _isSymbolicLink: boolean;

  constructor(stat: { mode: number; size: number; mtime: Date; isFile: boolean; isDirectory: boolean; isSymbolicLink: boolean }) {
    this.mode = stat.mode;
    this.size = stat.size;
    this.mtimeMs = stat.mtime.getTime();
    this.ctimeMs = stat.mtime.getTime();
    this._isFile = stat.isFile;
    this._isDirectory = stat.isDirectory;
    this._isSymbolicLink = stat.isSymbolicLink;
  }

  isFile(): boolean {
    return this._isFile;
  }

  isDirectory(): boolean {
    return this._isDirectory;
  }

  isSymbolicLink(): boolean {
    return this._isSymbolicLink;
  }
}

/**
 * Creates an isomorphic-git compatible fs adapter from a just-bash IFileSystem
 */
export function createFsAdapter(fs: IFileSystem, cwd: string) {
  const resolvePath = (filepath: string): string => {
    if (filepath.startsWith("/")) {
      return filepath;
    }
    return fs.resolvePath(cwd, filepath);
  };

  return {
    promises: {
      async readFile(
        filepath: string,
        options?: { encoding?: "utf8" } | "utf8"
      ): Promise<Uint8Array | string> {
        const resolved = resolvePath(filepath);
        const encoding = typeof options === "string" ? options : options?.encoding;

        return wrapFsOp(async () => {
          if (encoding === "utf8") {
            return await fs.readFile(resolved, "utf8");
          }
          // Return as Uint8Array for binary reads
          return await fs.readFileBuffer(resolved);
        }, resolved);
      },

      async writeFile(
        filepath: string,
        data: Uint8Array | string,
        options?: { encoding?: "utf8"; mode?: number } | "utf8"
      ): Promise<void> {
        const resolved = resolvePath(filepath);
        // Ensure parent directory exists
        const parentDir = resolved.split("/").slice(0, -1).join("/") || "/";
        try {
          await fs.mkdir(parentDir, { recursive: true });
        } catch {
          // Ignore if exists
        }
        await wrapFsOp(() => fs.writeFile(resolved, data), resolved);
      },

      async unlink(filepath: string): Promise<void> {
        const resolved = resolvePath(filepath);
        await wrapFsOp(() => fs.rm(resolved, { force: false }), resolved);
      },

      async readdir(filepath: string): Promise<string[]> {
        const resolved = resolvePath(filepath);
        return wrapFsOp(() => fs.readdir(resolved), resolved);
      },

      async mkdir(filepath: string, options?: { recursive?: boolean } | number): Promise<void> {
        const resolved = resolvePath(filepath);
        const recursive = typeof options === "object" ? options.recursive : false;
        await wrapFsOp(() => fs.mkdir(resolved, { recursive: recursive ?? false }), resolved);
      },

      async rmdir(filepath: string): Promise<void> {
        const resolved = resolvePath(filepath);
        await wrapFsOp(() => fs.rm(resolved, { recursive: false }), resolved);
      },

      async stat(filepath: string): Promise<Stats> {
        const resolved = resolvePath(filepath);
        return wrapFsOp(async () => {
          const stat = await fs.stat(resolved);
          return new Stats(stat);
        }, resolved);
      },

      async lstat(filepath: string): Promise<Stats> {
        const resolved = resolvePath(filepath);
        return wrapFsOp(async () => {
          const stat = await fs.lstat(resolved);
          return new Stats(stat);
        }, resolved);
      },

      async readlink(filepath: string): Promise<string> {
        const resolved = resolvePath(filepath);
        return wrapFsOp(() => fs.readlink(resolved), resolved);
      },

      async symlink(target: string, filepath: string): Promise<void> {
        const resolved = resolvePath(filepath);
        await wrapFsOp(() => fs.symlink(target, resolved), resolved);
      },

      async chmod(filepath: string, mode: number): Promise<void> {
        const resolved = resolvePath(filepath);
        await wrapFsOp(() => fs.chmod(resolved, mode), resolved);
      },
    },
  };
}

export type FsAdapter = ReturnType<typeof createFsAdapter>;
