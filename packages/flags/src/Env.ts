import path from 'node:path';
import { exec } from 'node:child_process';
import util from 'node:util';
import { findRoot } from '@manypkg/find-root';
import chalk from 'chalk';
import os from 'node:os';
import process from 'node:process';

const execAsync = util.promisify(exec);

/* eslint-disable no-console */

type Params = {
  rootDir: string;
  gitUserName: string;
  osUserName: string;
};

export default class Env {
  private _root!: string;
  private gitUserName!: string;
  async load() {
    const project = await findRoot(process.cwd());
    console.info(chalk.grey(`INFO Determined packager: ${project.tool.type}`));
    console.info(chalk.grey(`INFO Determined project root (monorepo root): "${project.rootDir}"`));
    this._root = project.rootDir;
    this.gitUserName = await this.getGitUsername();
  }

  get<T extends keyof Params>(name: T): Params[T] {
    this.ensureLoaded();
    switch (name) {
      case 'rootDir':
        return path.resolve(this._root);
      case 'gitUserName':
        return this.gitUserName;
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
    const [cp1, cp2] = await Promise.all([execAsync('git config user.name'), execAsync('git config user.email')]);
    if (cp1.stderr) {
      throw new Error(`Failed exec "git config user.name". Reason: ${cp1.stderr}`);
    }
    const name = cp1.stdout.trim();

    if (cp2.stderr) {
      console.error(chalk.red(`Failed exec "git config user.email". Reason: ${cp2.stderr}`));
      return name;
    }
    return `${name} <${cp2.stdout.trim()}>`;
  }
}
