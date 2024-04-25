import path from 'node:path';
import { exec } from 'node:child_process';
import { findRoot } from '@manypkg/find-root';
import os from 'node:os';
import process from 'node:process';
import Logger from './Logger.js';

// util.promisify(exec) doesn't give access to stderr, when error code isn't 0
const execAsync = (label: string, cmd: string) => {
  return new Promise<string>((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (stderr) {
        Logger.warn(`[${label}] stderr: ${stderr}`);
      }
      if (error) {
        return reject(error);
      }
      resolve(stdout);
    });
  });
};

/* eslint-disable no-console */

type Params = {
  rootDir: string;
  gitUserName: string;
  osUserName: string;
};

export default class Env {
  private _root!: string;
  private gitUserName!: string | null;
  async load() {
    const project = await findRoot(process.cwd());
    Logger.info(`Determined packager: ${project.tool.type}`);
    Logger.info(`Determined project root (monorepo root): "${project.rootDir}"`);
    this._root = project.rootDir;
    this.gitUserName = await this.getGitUsername();
  }

  get<T extends keyof Params>(name: T): Params[T] {
    this.ensureLoaded();
    switch (name) {
      case 'rootDir':
        return path.resolve(this._root);
      case 'gitUserName':
        return this.gitUserName as Params[T];
      case 'osUserName':
        return os.userInfo.name;

      default:
        throw new Error(`Unsupported env param: "${name}"`);
    }
  }

  ensureLoaded() {
    if (!this._root) {
      throw new Error('Env is not loaded. Did you forget to call load()?');
    }
  }

  private async getGitUsername() {
    let gitUserName, gitUserEmail: string;
    try {
      gitUserName = (await execAsync('GIT', 'git config user.name')).trim();
    } catch (e) {
      return null;
    }

    try {
      gitUserEmail = await execAsync('GIT', 'git config user.email');
      return `${gitUserName} <${gitUserEmail.trim()}>`;
    } catch (e) {
      return gitUserName;
    }
  }
}
