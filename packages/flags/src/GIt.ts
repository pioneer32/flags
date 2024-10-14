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
    await this.git.add(
      [this._deps.config.get('flagFile'), this._deps.config.get('output.jsonFile'), this._deps.config.get('output.typeDefFile')].filter(Boolean) as string[]
    );
    await this.git.commit(message);
  }
}
