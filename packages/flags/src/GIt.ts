import Config from './Config.js';
import { simpleGit } from 'simple-git';

/* eslint-disable no-console */

type Deps = {
  config: Config;
};

export default class Git {
  private readonly git = simpleGit();

  constructor(private _deps: Deps) {}

  async ensureCleanTree() {
    if (!this._deps.config.get('git.commit')) {
      return;
    }
    const gitStatus = await this.git.status();
    if (gitStatus.detached) {
      throw new Error(`Git: Detached head detected. Please switch to a branch and try again.`);
    }
    if (!gitStatus.isClean()) {
      throw new Error(`Git: Uncommitted changes found. Please commit or stash your changes.`);
    }
  }

  async commit(message: string) {
    if (!this._deps.config.get('git.commit')) {
      return;
    }
    for (const file of [this._deps.config.get('flagFile'), this._deps.config.get('output.jsonFile'), this._deps.config.get('output.typeDefFile')].filter(
      Boolean
    )) {
      try {
        await this.git.add(file!);
      } catch (e) {
        console.warn((e as Error).message);
      }
    }
    const { staged } = await this.git.status();
    if (staged.length) {
      console.info(`Committing ${staged.length} files...`);
      await this.git.commit(message);
    } else {
      console.info(`Nothing to commit. Please check your .gitconfig file to make sure the flags' files aren't ignored`);
    }
  }
}
