/**
 * Git Service
 *
 * Manages git operations for git-enabled notebooks using isomorphic-git.
 * Each notebook can optionally be a git repository with full version control.
 *
 * @module GitService
 */

import * as git from 'isomorphic-git';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface GitCommit {
  oid: string;
  message: string;
  author: {
    name: string;
    email: string;
    timestamp: number;
  };
  committer: {
    name: string;
    email: string;
    timestamp: number;
  };
}

export interface GitStatus {
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
}

export interface GitDiff {
  file: string;
  changes: string;
}

// ============================================================================
// GitService Class
// ============================================================================

export class GitService {
  private readonly baseDir: string;
  private readonly defaultAuthor = {
    name: 'Readied User',
    email: 'user@readied.app',
  };

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  // ==========================================================================
  // Repository Initialization
  // ==========================================================================

  /**
   * Initialize a git repository for a notebook
   *
   * @param notebookId - The notebook ID (used as repo directory name)
   * @returns The path to the initialized repository
   */
  async initRepository(notebookId: string): Promise<string> {
    const repoPath = this.getRepoPath(notebookId);

    // Create directory if it doesn't exist
    if (!fs.existsSync(repoPath)) {
      fs.mkdirSync(repoPath, { recursive: true });
    }

    // Initialize git repository
    await git.init({
      fs,
      dir: repoPath,
      defaultBranch: 'main',
    });

    // Create initial .gitignore
    const gitignorePath = path.join(repoPath, '.gitignore');
    const gitignoreContent = [
      '# Readied internal files',
      '.DS_Store',
      'Thumbs.db',
      '',
      '# Temporary files',
      '*.tmp',
      '*.temp',
      '',
    ].join('\n');

    fs.writeFileSync(gitignorePath, gitignoreContent, 'utf-8');

    // Initial commit with .gitignore
    await this.commit(notebookId, 'Initial commit', ['.gitignore']);

    return repoPath;
  }

  /**
   * Check if a notebook has a git repository
   */
  async isGitRepository(notebookId: string): Promise<boolean> {
    const repoPath = this.getRepoPath(notebookId);
    const gitDir = path.join(repoPath, '.git');
    return fs.existsSync(gitDir);
  }

  // ==========================================================================
  // File Operations
  // ==========================================================================

  /**
   * Write a note file to the git repository
   *
   * @param notebookId - The notebook ID
   * @param noteId - The note ID (used as filename)
   * @param content - The note content (markdown)
   */
  async writeNoteFile(notebookId: string, noteId: string, content: string): Promise<void> {
    const repoPath = this.getRepoPath(notebookId);
    const filePath = path.join(repoPath, `${noteId}.md`);

    // Ensure directory exists
    if (!fs.existsSync(repoPath)) {
      throw new Error(`Repository not found for notebook ${notebookId}`);
    }

    // Write file
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Read a note file from the git repository
   */
  async readNoteFile(notebookId: string, noteId: string): Promise<string | null> {
    const repoPath = this.getRepoPath(notebookId);
    const filePath = path.join(repoPath, `${noteId}.md`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Delete a note file from the git repository
   */
  async deleteNoteFile(notebookId: string, noteId: string): Promise<void> {
    const repoPath = this.getRepoPath(notebookId);
    const filePath = path.join(repoPath, `${noteId}.md`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // ==========================================================================
  // Git Operations
  // ==========================================================================

  /**
   * Stage and commit changes
   *
   * @param notebookId - The notebook ID
   * @param message - Commit message
   * @param files - Files to stage (relative to repo root). If empty, stages all changes.
   * @returns The commit SHA
   */
  async commit(
    notebookId: string,
    message: string,
    files: string[] = []
  ): Promise<string> {
    const repoPath = this.getRepoPath(notebookId);

    // Stage files
    if (files.length === 0) {
      // Stage all changes
      const status = await this.status(notebookId);
      files = [...status.modified, ...status.added, ...status.deleted, ...status.untracked];
    }

    for (const file of files) {
      await git.add({
        fs,
        dir: repoPath,
        filepath: file,
      });
    }

    // Commit
    const sha = await git.commit({
      fs,
      dir: repoPath,
      message,
      author: this.defaultAuthor,
    });

    return sha;
  }

  /**
   * Get repository status (modified, added, deleted, untracked files)
   */
  async status(notebookId: string): Promise<GitStatus> {
    const repoPath = this.getRepoPath(notebookId);

    const statusMatrix = await git.statusMatrix({
      fs,
      dir: repoPath,
    });

    const result: GitStatus = {
      modified: [],
      added: [],
      deleted: [],
      untracked: [],
    };

    for (const [filepath, HEADStatus, workdirStatus, stageStatus] of statusMatrix) {
      // Skip .git directory
      if (filepath === '.git' || filepath.startsWith('.git/')) {
        continue;
      }

      // Status matrix values:
      // [filepath, HEAD, WORKDIR, STAGE]
      // 0 = file not present, 1 = file present (same), 2 = file present (modified)

      // Untracked (new file not in HEAD, in workdir, not staged)
      if (HEADStatus === 0 && workdirStatus === 2 && stageStatus === 0) {
        result.untracked.push(filepath);
      }
      // Added (new file staged)
      else if (HEADStatus === 0 && workdirStatus === 2 && stageStatus === 2) {
        result.added.push(filepath);
      }
      // Modified (in HEAD, modified in workdir, not staged)
      else if (HEADStatus === 1 && workdirStatus === 2 && stageStatus === 1) {
        result.modified.push(filepath);
      }
      // Deleted (in HEAD, not in workdir)
      else if (HEADStatus === 1 && workdirStatus === 0 && stageStatus === 1) {
        result.deleted.push(filepath);
      }
    }

    return result;
  }

  /**
   * Get commit history
   *
   * @param notebookId - The notebook ID
   * @param limit - Maximum number of commits to return (default: 50)
   * @returns Array of commits, newest first
   */
  async log(notebookId: string, limit = 50): Promise<GitCommit[]> {
    const repoPath = this.getRepoPath(notebookId);

    const commits = await git.log({
      fs,
      dir: repoPath,
      depth: limit,
    });

    return commits.map(commit => ({
      oid: commit.oid,
      message: commit.commit.message,
      author: {
        name: commit.commit.author.name,
        email: commit.commit.author.email,
        timestamp: commit.commit.author.timestamp,
      },
      committer: {
        name: commit.commit.committer.name,
        email: commit.commit.committer.email,
        timestamp: commit.commit.committer.timestamp,
      },
    }));
  }

  /**
   * Checkout a specific commit (revert repository to that state)
   *
   * @param notebookId - The notebook ID
   * @param commitSha - The commit SHA to checkout
   */
  async checkout(notebookId: string, commitSha: string): Promise<void> {
    const repoPath = this.getRepoPath(notebookId);

    await git.checkout({
      fs,
      dir: repoPath,
      ref: commitSha,
      force: true, // Discard local changes
    });
  }

  /**
   * Get diff between two commits or working directory
   *
   * @param _notebookId - The notebook ID
   * @param _commitSha1 - First commit SHA (or 'HEAD')
   * @param _commitSha2 - Second commit SHA (optional, defaults to working directory)
   */
  async diff(
    _notebookId: string,
    _commitSha1: string,
    _commitSha2?: string
  ): Promise<GitDiff[]> {
    // TODO: Implement diff functionality
    // isomorphic-git doesn't have built-in diff, need to implement or use external library
    throw new Error('Diff not yet implemented');
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get the filesystem path to a notebook's git repository
   */
  private getRepoPath(notebookId: string): string {
    return path.join(this.baseDir, 'notebooks', notebookId);
  }

  /**
   * Get the base directory for all git repositories
   */
  getBaseDir(): string {
    return this.baseDir;
  }
}
