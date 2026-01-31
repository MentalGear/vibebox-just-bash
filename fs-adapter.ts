/**
 * Adapter to bridge just-bash's IFileSystem to isomorphic-git's expected fs interface.
 *
 * isomorphic-git expects a Node.js-like fs module with a `promises` property.
 * This adapter wraps IFileSystem methods to match that interface.
 */

import type { IFileSystem } from "just-bash/browser";

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

        if (encoding === "utf8") {
          return await fs.readFile(resolved, "utf8");
        }
        // Return as Uint8Array for binary reads
        return await fs.readFileBuffer(resolved);
      },

      async writeFile(
        filepath: string,
        data: Uint8Array | string,
        options?: { encoding?: "utf8"; mode?: number } | "utf8"
      ): Promise<void> {
        const resolved = resolvePath(filepath);
        await fs.writeFile(resolved, data);
      },

      async unlink(filepath: string): Promise<void> {
        const resolved = resolvePath(filepath);
        await fs.rm(resolved, { force: false });
      },

      async readdir(filepath: string): Promise<string[]> {
        const resolved = resolvePath(filepath);
        return await fs.readdir(resolved);
      },

      async mkdir(filepath: string, options?: { recursive?: boolean } | number): Promise<void> {
        const resolved = resolvePath(filepath);
        const recursive = typeof options === "object" ? options.recursive : false;
        await fs.mkdir(resolved, { recursive: recursive ?? false });
      },

      async rmdir(filepath: string): Promise<void> {
        const resolved = resolvePath(filepath);
        await fs.rm(resolved, { recursive: false });
      },

      async stat(filepath: string): Promise<Stats> {
        const resolved = resolvePath(filepath);
        const stat = await fs.stat(resolved);
        return new Stats(stat);
      },

      async lstat(filepath: string): Promise<Stats> {
        const resolved = resolvePath(filepath);
        const stat = await fs.lstat(resolved);
        return new Stats(stat);
      },

      async readlink(filepath: string): Promise<string> {
        const resolved = resolvePath(filepath);
        return await fs.readlink(resolved);
      },

      async symlink(target: string, filepath: string): Promise<void> {
        const resolved = resolvePath(filepath);
        await fs.symlink(target, resolved);
      },

      async chmod(filepath: string, mode: number): Promise<void> {
        const resolved = resolvePath(filepath);
        await fs.chmod(resolved, mode);
      },
    },
  };
}

export type FsAdapter = ReturnType<typeof createFsAdapter>;
