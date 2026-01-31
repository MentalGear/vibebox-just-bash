/**
 * Git command implementation using isomorphic-git
 *
 * Provides git functionality in the browser using isomorphic-git
 * with a filesystem adapter for just-bash's IFileSystem.
 */

import * as git from "isomorphic-git";
import { defineCommand } from "just-bash/browser";
import { createFsAdapter } from "./fs-adapter.js";
import type { IFileSystem } from "just-bash/browser";

interface GitContext {
  fs: IFileSystem;
  cwd: string;
  env: Record<string, string>;
}

// Helper to get author info from env or defaults
function getAuthor(env: Record<string, string>) {
  return {
    name: env.GIT_AUTHOR_NAME || env.USER || "User",
    email: env.GIT_AUTHOR_EMAIL || `${env.USER || "user"}@localhost`,
  };
}

// Find git repository root by looking for .git directory
async function findGitRoot(fs: IFileSystem, cwd: string): Promise<string | null> {
  let dir = cwd;
  while (dir !== "/") {
    try {
      const stat = await fs.stat(`${dir}/.git`);
      if (stat.isDirectory) {
        return dir;
      }
    } catch {
      // .git not found, go up
    }
    const parent = dir.split("/").slice(0, -1).join("/") || "/";
    if (parent === dir) break;
    dir = parent;
  }
  // Check root
  try {
    const stat = await fs.stat("/.git");
    if (stat.isDirectory) return "/";
  } catch {
    // not found
  }
  return null;
}

// Subcommand handlers
async function gitInit(args: string[], ctx: GitContext): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const fsAdapter = createFsAdapter(ctx.fs, ctx.cwd);
  const dir = ctx.cwd;

  try {
    await git.init({ fs: fsAdapter, dir });
    return { stdout: `Initialized empty Git repository in ${dir}/.git/\n`, stderr: "", exitCode: 0 };
  } catch (err) {
    return { stdout: "", stderr: `error: ${err instanceof Error ? err.message : err}\n`, exitCode: 1 };
  }
}

async function gitAdd(args: string[], ctx: GitContext): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const fsAdapter = createFsAdapter(ctx.fs, ctx.cwd);
  const gitRoot = await findGitRoot(ctx.fs, ctx.cwd);

  if (!gitRoot) {
    return { stdout: "", stderr: "fatal: not a git repository\n", exitCode: 128 };
  }

  if (args.length === 0) {
    return { stdout: "", stderr: "Nothing specified, nothing added.\n", exitCode: 0 };
  }

  try {
    for (const filepath of args) {
      // Handle "." to add all files
      if (filepath === ".") {
        // Get all files recursively
        const allFiles = await getAllFiles(ctx.fs, gitRoot, gitRoot);
        for (const file of allFiles) {
          if (!file.startsWith(".git/")) {
            await git.add({ fs: fsAdapter, dir: gitRoot, filepath: file });
          }
        }
      } else {
        await git.add({ fs: fsAdapter, dir: gitRoot, filepath });
      }
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  } catch (err) {
    return { stdout: "", stderr: `error: ${err instanceof Error ? err.message : err}\n`, exitCode: 1 };
  }
}

// Helper to get all files recursively
async function getAllFiles(fs: IFileSystem, dir: string, base: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir);

  for (const entry of entries) {
    const fullPath = `${dir}/${entry}`;
    const stat = await fs.stat(fullPath);
    const relativePath = fullPath.slice(base.length + 1);

    if (stat.isDirectory) {
      if (entry !== ".git") {
        files.push(...(await getAllFiles(fs, fullPath, base)));
      }
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

async function gitCommit(args: string[], ctx: GitContext): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const fsAdapter = createFsAdapter(ctx.fs, ctx.cwd);
  const gitRoot = await findGitRoot(ctx.fs, ctx.cwd);

  if (!gitRoot) {
    return { stdout: "", stderr: "fatal: not a git repository\n", exitCode: 128 };
  }

  // Parse -m flag
  let message = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-m" && args[i + 1]) {
      message = args[i + 1];
      break;
    }
  }

  if (!message) {
    return { stdout: "", stderr: "error: switch `m' requires a value\n", exitCode: 1 };
  }

  try {
    const author = getAuthor(ctx.env);
    const sha = await git.commit({
      fs: fsAdapter,
      dir: gitRoot,
      message,
      author,
    });
    const shortSha = sha.slice(0, 7);
    return { stdout: `[main ${shortSha}] ${message}\n`, stderr: "", exitCode: 0 };
  } catch (err) {
    return { stdout: "", stderr: `error: ${err instanceof Error ? err.message : err}\n`, exitCode: 1 };
  }
}

async function gitStatus(args: string[], ctx: GitContext): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const fsAdapter = createFsAdapter(ctx.fs, ctx.cwd);
  const gitRoot = await findGitRoot(ctx.fs, ctx.cwd);

  if (!gitRoot) {
    return { stdout: "", stderr: "fatal: not a git repository\n", exitCode: 128 };
  }

  try {
    const matrix = await git.statusMatrix({ fs: fsAdapter, dir: gitRoot });
    const lines: string[] = [];

    // Status matrix columns: [filepath, HEAD, workdir, stage]
    // Values: 0=absent, 1=identical, 2=different
    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];

    for (const [filepath, head, workdir, stage] of matrix) {
      if (head === 0 && workdir === 2 && stage === 0) {
        untracked.push(filepath as string);
      } else if (head === 0 && workdir === 2 && stage === 2) {
        staged.push(`new file:   ${filepath}`);
      } else if (head === 1 && workdir === 2 && stage === 1) {
        unstaged.push(`modified:   ${filepath}`);
      } else if (head === 1 && workdir === 2 && stage === 2) {
        staged.push(`modified:   ${filepath}`);
      } else if (head === 1 && workdir === 0 && stage === 0) {
        staged.push(`deleted:    ${filepath}`);
      } else if (head === 1 && workdir === 2 && stage === 3) {
        staged.push(`modified:   ${filepath}`);
        unstaged.push(`modified:   ${filepath}`);
      }
    }

    if (staged.length === 0 && unstaged.length === 0 && untracked.length === 0) {
      lines.push("nothing to commit, working tree clean");
    } else {
      if (staged.length > 0) {
        lines.push("Changes to be committed:");
        lines.push('  (use "git restore --staged <file>..." to unstage)');
        for (const s of staged) {
          lines.push(`\t${s}`);
        }
        lines.push("");
      }

      if (unstaged.length > 0) {
        lines.push("Changes not staged for commit:");
        lines.push('  (use "git add <file>..." to update what will be committed)');
        for (const s of unstaged) {
          lines.push(`\t${s}`);
        }
        lines.push("");
      }

      if (untracked.length > 0) {
        lines.push("Untracked files:");
        lines.push('  (use "git add <file>..." to include in what will be committed)');
        for (const f of untracked) {
          lines.push(`\t${f}`);
        }
        lines.push("");
      }
    }

    return { stdout: lines.join("\n") + "\n", stderr: "", exitCode: 0 };
  } catch (err) {
    return { stdout: "", stderr: `error: ${err instanceof Error ? err.message : err}\n`, exitCode: 1 };
  }
}

async function gitLog(args: string[], ctx: GitContext): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const fsAdapter = createFsAdapter(ctx.fs, ctx.cwd);
  const gitRoot = await findGitRoot(ctx.fs, ctx.cwd);

  if (!gitRoot) {
    return { stdout: "", stderr: "fatal: not a git repository\n", exitCode: 128 };
  }

  // Parse --oneline flag
  const oneline = args.includes("--oneline");

  // Parse -n flag
  let depth = 10;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-n" && args[i + 1]) {
      depth = parseInt(args[i + 1], 10);
      break;
    }
    if (args[i].startsWith("-n")) {
      depth = parseInt(args[i].slice(2), 10);
    }
  }

  try {
    const commits = await git.log({ fs: fsAdapter, dir: gitRoot, depth });
    const lines: string[] = [];

    for (const commit of commits) {
      if (oneline) {
        lines.push(`${commit.oid.slice(0, 7)} ${commit.commit.message.split("\n")[0]}`);
      } else {
        lines.push(`commit ${commit.oid}`);
        lines.push(`Author: ${commit.commit.author.name} <${commit.commit.author.email}>`);
        const date = new Date(commit.commit.author.timestamp * 1000);
        lines.push(`Date:   ${date.toUTCString()}`);
        lines.push("");
        lines.push(`    ${commit.commit.message}`);
        lines.push("");
      }
    }

    return { stdout: lines.join("\n"), stderr: "", exitCode: 0 };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("Could not find")) {
      return { stdout: "", stderr: "fatal: your current branch does not have any commits yet\n", exitCode: 128 };
    }
    return { stdout: "", stderr: `error: ${errMsg}\n`, exitCode: 1 };
  }
}

async function gitBranch(args: string[], ctx: GitContext): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const fsAdapter = createFsAdapter(ctx.fs, ctx.cwd);
  const gitRoot = await findGitRoot(ctx.fs, ctx.cwd);

  if (!gitRoot) {
    return { stdout: "", stderr: "fatal: not a git repository\n", exitCode: 128 };
  }

  try {
    if (args.length === 0) {
      // List branches
      const branches = await git.listBranches({ fs: fsAdapter, dir: gitRoot });
      const currentBranch = await git.currentBranch({ fs: fsAdapter, dir: gitRoot });
      const lines = branches.map((b) => (b === currentBranch ? `* ${b}` : `  ${b}`));
      return { stdout: lines.join("\n") + "\n", stderr: "", exitCode: 0 };
    } else {
      // Create new branch
      const branchName = args[0];
      await git.branch({ fs: fsAdapter, dir: gitRoot, ref: branchName });
      return { stdout: "", stderr: "", exitCode: 0 };
    }
  } catch (err) {
    return { stdout: "", stderr: `error: ${err instanceof Error ? err.message : err}\n`, exitCode: 1 };
  }
}

async function gitCheckout(args: string[], ctx: GitContext): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const fsAdapter = createFsAdapter(ctx.fs, ctx.cwd);
  const gitRoot = await findGitRoot(ctx.fs, ctx.cwd);

  if (!gitRoot) {
    return { stdout: "", stderr: "fatal: not a git repository\n", exitCode: 128 };
  }

  if (args.length === 0) {
    return { stdout: "", stderr: "error: you must specify path(s) or branch to checkout\n", exitCode: 1 };
  }

  // Parse -b flag for creating new branch
  const createBranch = args[0] === "-b";
  const ref = createBranch ? args[1] : args[0];

  if (!ref) {
    return { stdout: "", stderr: "error: you must specify a branch name\n", exitCode: 1 };
  }

  try {
    if (createBranch) {
      await git.branch({ fs: fsAdapter, dir: gitRoot, ref });
    }
    await git.checkout({ fs: fsAdapter, dir: gitRoot, ref });
    return { stdout: `Switched to branch '${ref}'\n`, stderr: "", exitCode: 0 };
  } catch (err) {
    return { stdout: "", stderr: `error: ${err instanceof Error ? err.message : err}\n`, exitCode: 1 };
  }
}

async function gitDiff(args: string[], ctx: GitContext): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const fsAdapter = createFsAdapter(ctx.fs, ctx.cwd);
  const gitRoot = await findGitRoot(ctx.fs, ctx.cwd);

  if (!gitRoot) {
    return { stdout: "", stderr: "fatal: not a git repository\n", exitCode: 128 };
  }

  try {
    const matrix = await git.statusMatrix({ fs: fsAdapter, dir: gitRoot });
    const lines: string[] = [];

    for (const [filepath, head, workdir, stage] of matrix) {
      // Show diff for modified files not yet staged
      if (workdir === 2 && stage !== 2) {
        lines.push(`diff --git a/${filepath} b/${filepath}`);
        lines.push(`--- a/${filepath}`);
        lines.push(`+++ b/${filepath}`);
        lines.push("@@ (diff content not shown - use git diff <file> for full diff)");
        lines.push("");
      }
    }

    if (lines.length === 0) {
      return { stdout: "", stderr: "", exitCode: 0 };
    }

    return { stdout: lines.join("\n"), stderr: "", exitCode: 0 };
  } catch (err) {
    return { stdout: "", stderr: `error: ${err instanceof Error ? err.message : err}\n`, exitCode: 1 };
  }
}

async function gitHelp(): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const help = `usage: git <command> [<args>]

Available commands:
  init        Create an empty Git repository
  add         Add file contents to the index
  commit      Record changes to the repository
  status      Show the working tree status
  log         Show commit logs
  branch      List, create, or delete branches
  checkout    Switch branches or restore working tree files
  diff        Show changes between commits, commit and working tree, etc

Example:
  git init
  echo "Hello" > file.txt
  git add file.txt
  git commit -m "Initial commit"
  git log --oneline
`;
  return { stdout: help, stderr: "", exitCode: 0 };
}

// Main git command
export const gitCommand = defineCommand("git", async (args, ctx) => {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  const gitCtx: GitContext = {
    fs: ctx.fs,
    cwd: ctx.cwd,
    env: ctx.env,
  };

  switch (subcommand) {
    case "init":
      return gitInit(subArgs, gitCtx);
    case "add":
      return gitAdd(subArgs, gitCtx);
    case "commit":
      return gitCommit(subArgs, gitCtx);
    case "status":
      return gitStatus(subArgs, gitCtx);
    case "log":
      return gitLog(subArgs, gitCtx);
    case "branch":
      return gitBranch(subArgs, gitCtx);
    case "checkout":
      return gitCheckout(subArgs, gitCtx);
    case "diff":
      return gitDiff(subArgs, gitCtx);
    case "help":
    case "--help":
    case "-h":
    case undefined:
      return gitHelp();
    default:
      return {
        stdout: "",
        stderr: `git: '${subcommand}' is not a git command. See 'git help'.\n`,
        exitCode: 1,
      };
  }
});
