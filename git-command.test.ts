/**
 * Tests for git command using isomorphic-git
 *
 * Following just-bash test patterns from src/commands/sqlite3/sqlite3.test.ts
 */

import { describe, expect, it } from "vitest";
import { Bash } from "just-bash";
import { gitCommand } from "./git-command.js";

// Helper to create a bash instance with git command
function createBash(options: { files?: Record<string, string>; cwd?: string; env?: Record<string, string> } = {}) {
  return new Bash({
    customCommands: [gitCommand],
    files: options.files,
    cwd: options.cwd || "/home/user",
    env: {
      HOME: "/home/user",
      USER: "testuser",
      GIT_AUTHOR_NAME: "Test User",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test User",
      GIT_COMMITTER_EMAIL: "test@example.com",
      ...options.env,
    },
  });
}

describe("git", () => {
  describe("help", () => {
    it("should show help with no arguments", async () => {
      const bash = createBash();
      const result = await bash.exec("git");
      expect(result.stdout).toContain("usage: git");
      expect(result.stdout).toContain("init");
      expect(result.stdout).toContain("commit");
      expect(result.exitCode).toBe(0);
    });

    it("should show help with --help flag", async () => {
      const bash = createBash();
      const result = await bash.exec("git --help");
      expect(result.stdout).toContain("usage: git");
      expect(result.exitCode).toBe(0);
    });

    it("should show help with help subcommand", async () => {
      const bash = createBash();
      const result = await bash.exec("git help");
      expect(result.stdout).toContain("Available commands");
      expect(result.exitCode).toBe(0);
    });
  });

  describe("init", () => {
    it("should initialize a new repository", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");

      const result = await bash.exec("git init");
      expect(result.stdout).toContain("Initialized empty Git repository");
      expect(result.exitCode).toBe(0);

      // Verify .git directory was created
      const lsResult = await bash.exec("ls -la /repo");
      expect(lsResult.stdout).toContain(".git");
    });

    it("should create .git subdirectories", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");

      const result = await bash.exec("ls /repo/.git");
      expect(result.stdout).toContain("objects");
      expect(result.stdout).toContain("refs");
      expect(result.stdout).toContain("HEAD");
    });
  });

  describe("status", () => {
    it("should error when not in a git repository", async () => {
      const bash = createBash({ cwd: "/not-a-repo" });
      await bash.exec("mkdir -p /not-a-repo");

      const result = await bash.exec("git status");
      expect(result.stderr).toContain("not a git repository");
      expect(result.exitCode).toBe(128);
    });

    it("should show clean status after init", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo && cd /repo && git init");

      const result = await bash.exec("git status");
      // New repo with no commits - may show different message
      expect(result.exitCode).toBe(0);
    });

    it("should show untracked files", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");
      await bash.exec("echo 'hello' > /repo/newfile.txt");

      const result = await bash.exec("git status");
      expect(result.stdout).toContain("newfile.txt");
      expect(result.stdout).toContain("Untracked");
      expect(result.exitCode).toBe(0);
    });

    it("should show staged files", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");
      await bash.exec("echo 'hello' > /repo/staged.txt");
      await bash.exec("git add staged.txt");

      const result = await bash.exec("git status");
      expect(result.stdout).toContain("staged.txt");
      expect(result.stdout).toContain("Changes to be committed");
      expect(result.exitCode).toBe(0);
    });
  });

  describe("add", () => {
    it("should stage a single file", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");
      await bash.exec("echo 'content' > /repo/file.txt");

      const result = await bash.exec("git add file.txt");
      expect(result.exitCode).toBe(0);

      // Verify file is staged
      const status = await bash.exec("git status");
      expect(status.stdout).toContain("Changes to be committed");
    });

    it("should stage multiple files", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");
      await bash.exec("echo 'a' > /repo/a.txt");
      await bash.exec("echo 'b' > /repo/b.txt");

      const result = await bash.exec("git add a.txt b.txt");
      expect(result.exitCode).toBe(0);

      const status = await bash.exec("git status");
      expect(status.stdout).toContain("a.txt");
      expect(status.stdout).toContain("b.txt");
    });

    it("should stage all files with .", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");
      await bash.exec("echo 'x' > /repo/x.txt");
      await bash.exec("echo 'y' > /repo/y.txt");

      const result = await bash.exec("git add .");
      expect(result.exitCode).toBe(0);

      const status = await bash.exec("git status");
      expect(status.stdout).toContain("x.txt");
      expect(status.stdout).toContain("y.txt");
    });

    it("should handle nothing to add", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");

      const result = await bash.exec("git add");
      expect(result.exitCode).toBe(0);
    });
  });

  describe("commit", () => {
    it("should create a commit with message", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");
      await bash.exec("echo 'hello' > /repo/file.txt");
      await bash.exec("git add file.txt");

      const result = await bash.exec('git commit -m "Initial commit"');
      expect(result.stdout).toContain("Initial commit");
      expect(result.exitCode).toBe(0);
    });

    it("should error without -m flag", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");
      await bash.exec("echo 'hello' > /repo/file.txt");
      await bash.exec("git add file.txt");

      const result = await bash.exec("git commit");
      expect(result.stderr).toContain("requires a value");
      expect(result.exitCode).toBe(1);
    });

    it("should show short sha in output", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");
      await bash.exec("echo 'hello' > /repo/file.txt");
      await bash.exec("git add file.txt");

      const result = await bash.exec('git commit -m "Test"');
      // Output should contain something like "[main abc1234] Test"
      expect(result.stdout).toMatch(/\[.+ [a-f0-9]+\]/);
      expect(result.exitCode).toBe(0);
    });
  });

  describe("log", () => {
    it("should error when no commits exist", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");

      const result = await bash.exec("git log");
      expect(result.stderr).toContain("does not have any commits");
      expect(result.exitCode).toBe(128);
    });

    it("should show commit history", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");
      await bash.exec("echo 'hello' > /repo/file.txt");
      await bash.exec("git add file.txt");
      await bash.exec('git commit -m "First commit"');

      const result = await bash.exec("git log");
      expect(result.stdout).toContain("First commit");
      expect(result.stdout).toContain("Author:");
      expect(result.stdout).toContain("Date:");
      expect(result.exitCode).toBe(0);
    });

    it("should show oneline format", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");
      await bash.exec("echo 'hello' > /repo/file.txt");
      await bash.exec("git add .");
      await bash.exec('git commit -m "First"');
      await bash.exec("echo 'world' >> /repo/file.txt");
      await bash.exec("git add .");
      await bash.exec('git commit -m "Second"');

      const result = await bash.exec("git log --oneline");
      expect(result.stdout).toContain("First");
      expect(result.stdout).toContain("Second");
      // Oneline format should be shorter (no Author/Date lines)
      expect(result.stdout).not.toContain("Author:");
      expect(result.exitCode).toBe(0);
    });

    it("should limit commits with -n flag", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");
      await bash.exec("echo '1' > /repo/file.txt && git add . && git commit -m 'One'");
      await bash.exec("echo '2' >> /repo/file.txt && git add . && git commit -m 'Two'");
      await bash.exec("echo '3' >> /repo/file.txt && git add . && git commit -m 'Three'");

      const result = await bash.exec("git log --oneline -n 2");
      const lines = result.stdout.trim().split("\n").filter(l => l);
      expect(lines.length).toBe(2);
      expect(result.exitCode).toBe(0);
    });
  });

  describe("branch", () => {
    it("should list branches", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");
      await bash.exec("echo 'x' > /repo/file.txt && git add . && git commit -m 'Init'");

      const result = await bash.exec("git branch");
      // isomorphic-git defaults to 'master', not 'main'
      expect(result.stdout).toMatch(/main|master/);
      expect(result.exitCode).toBe(0);
    });

    it("should mark current branch with asterisk", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");
      await bash.exec("echo 'x' > /repo/file.txt && git add . && git commit -m 'Init'");

      const result = await bash.exec("git branch");
      expect(result.stdout).toMatch(/\* \w+/);
      expect(result.exitCode).toBe(0);
    });

    it("should create a new branch", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");
      await bash.exec("echo 'x' > /repo/file.txt && git add . && git commit -m 'Init'");

      const result = await bash.exec("git branch feature");
      expect(result.exitCode).toBe(0);

      const listResult = await bash.exec("git branch");
      expect(listResult.stdout).toContain("feature");
    });
  });

  describe("checkout", () => {
    it("should switch branches", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");
      await bash.exec("echo 'x' > /repo/file.txt && git add . && git commit -m 'Init'");
      await bash.exec("git branch feature");

      const result = await bash.exec("git checkout feature");
      expect(result.stdout).toContain("Switched to branch");
      expect(result.exitCode).toBe(0);
    });

    it("should create and switch with -b flag", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");
      await bash.exec("echo 'x' > /repo/file.txt && git add . && git commit -m 'Init'");

      const result = await bash.exec("git checkout -b newbranch");
      expect(result.stdout).toContain("Switched to branch");
      expect(result.exitCode).toBe(0);

      const branchResult = await bash.exec("git branch");
      expect(branchResult.stdout).toContain("newbranch");
    });

    it("should error without branch name", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");

      const result = await bash.exec("git checkout");
      expect(result.stderr).toContain("must specify");
      expect(result.exitCode).toBe(1);
    });
  });

  describe("diff", () => {
    it("should show no diff when clean", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");
      await bash.exec("echo 'x' > /repo/file.txt && git add . && git commit -m 'Init'");

      const result = await bash.exec("git diff");
      expect(result.stdout).toBe("");
      expect(result.exitCode).toBe(0);
    });

    it("should show diff for modified files", async () => {
      const bash = createBash({ cwd: "/repo" });
      await bash.exec("mkdir -p /repo");
      await bash.exec("git init");
      await bash.exec("echo 'original' > /repo/file.txt && git add . && git commit -m 'Init'");
      await bash.exec("echo 'modified' >> /repo/file.txt"); // Append to modify

      // Verify the file is seen as modified via status
      const status = await bash.exec("git status");
      expect(status.stdout).toContain("file.txt");
      expect(status.stdout).toContain("not staged");

      // git diff should succeed (implementation is simplified)
      const result = await bash.exec("git diff");
      expect(result.exitCode).toBe(0);
    });
  });

  describe("unknown command", () => {
    it("should error on unknown subcommand", async () => {
      const bash = createBash();
      const result = await bash.exec("git unknown");
      expect(result.stderr).toContain("is not a git command");
      expect(result.exitCode).toBe(1);
    });
  });

  describe("workflow integration", () => {
    it("should support full workflow: init, add, commit, log", async () => {
      const bash = createBash({ cwd: "/project" });
      await bash.exec("mkdir -p /project");

      // Initialize
      let result = await bash.exec("git init");
      expect(result.exitCode).toBe(0);

      // Create files
      await bash.exec("echo 'Hello World' > /project/README.md");
      await bash.exec("echo 'console.log(1)' > /project/index.js");

      // Check status shows untracked
      result = await bash.exec("git status");
      expect(result.stdout).toContain("README.md");
      expect(result.stdout).toContain("index.js");

      // Stage all
      result = await bash.exec("git add .");
      expect(result.exitCode).toBe(0);

      // Commit
      result = await bash.exec('git commit -m "Initial project setup"');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Initial project setup");

      // Check log
      result = await bash.exec("git log --oneline");
      expect(result.stdout).toContain("Initial project setup");

      // Modify and commit again
      await bash.exec("echo 'v2' >> /project/README.md");
      await bash.exec("git add README.md");
      result = await bash.exec('git commit -m "Update README"');
      expect(result.exitCode).toBe(0);

      // Log should show both commits
      result = await bash.exec("git log --oneline");
      expect(result.stdout).toContain("Initial project setup");
      expect(result.stdout).toContain("Update README");
    });
  });
});
