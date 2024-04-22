import fs from 'fs-extra';
import Joi from 'joi';
import { DateTime } from 'luxon';
import _ from 'lodash';

import Env from './Env.js';
import Config from './Config.js';
import ChainedError from './ChainedError.js';
import Logger from './Logger.js';

/* eslint-disable no-console */

type Deps = {
  env: Env;
  config: Config;
};

type Flag = {
  name: string;
  deleted?: boolean;
  description?: string;
  enabledFor: string;
  history: { action: string; by: string; at: string }[];
};

const flagsSchema = Joi.array<Flag[]>().items({
  name: Joi.string().required(),
  deleted: Joi.boolean().empty(false),
  description: Joi.string().empty(''),
  enabledFor: Joi.string().required(),
  history: Joi.array<Flag['history']>().items({
    action: Joi.string().required(),
    by: Joi.string().required(),
    at: Joi.date().iso().required(),
  }),
});

export default class FlagManager {
  private _flags!: Flag[];

  constructor(private _deps: Deps) {}

  async load() {
    const filename = this._deps.config.get('flagFile');
    if (!(await fs.pathExists(filename))) {
      Logger.warn(`No feature flags file found. A new file will be created at "${filename}"`);
      this._flags = [];
      return;
    }
    try {
      const flags = await fs.readJson(filename);
      this._flags = await flagsSchema.validateAsync(flags);
      Logger.info(`Feature flags loaded from "${filename}"`);
    } catch (err) {
      throw new ChainedError(`Failed to load flag file "${filename}"`, err as Error);
    }
  }

  async generateOutput() {
    this.ensureLoaded();
    const filenameJson = this._deps.config.get('output.jsonFile');
    const filenameTypeDef = this._deps.config.get('output.typeDefFile');
    const flags = this.flags.map(({ name }) => name);
    try {
      await Promise.all([
        fs
          .writeJson(
            filenameJson,
            this.flags.reduce((output, { name, enabledFor }) => {
              // eslint-disable-next-line no-param-reassign
              output[name] = this.calculateEnabledForEnvs(enabledFor);
              return output;
            }, {} as Record<string, string[]>),
            { spaces: '  ' }
          )
          .then(() => Logger.info(`Output JSON saved at "${filenameJson}"`)),
        ...(filenameTypeDef
          ? [
              fs
                .writeFile(
                  filenameTypeDef,
                  [
                    `/* This content is generated. Any change will be lost */`,
                    ``,
                    `export type FeatureFlagName =`,
                    ...flags.map((name) => `  | '${name}'`),
                    `  ;`,
                  ].join('\n')
                )
                .then(() => Logger.info(`Output Typescript Definition saved at "${filenameJson}"`)),
            ]
          : []),
      ]);
    } catch (err) {
      throw new ChainedError(`Failed to write output files`, err as Error);
    }
  }

  private async save() {
    const filename = this._deps.config.get('flagFile');
    try {
      await fs.writeJson(filename, this.flags, { spaces: '  ' });
      Logger.info(`Feature flags saved in "${filename}"`);
    } catch (err) {
      throw new ChainedError(`Failed to write flag file "${filename}"`, err as Error);
    }
  }

  private get flags(): Flag[] {
    this.ensureLoaded();
    return _.sortBy([...this._flags], ['name']);
  }

  introduceNewFlag(name: string, byUser: string) {
    this.ensureLoaded();
    const flag = this.getFlagEntry(name);
    if (flag) {
      throw new Error(
        flag.deleted
          ? `Feature Flag ${name} already existed in the past. Reusing names is not allowed. Please consider another name`
          : `Feature Flag ${name} already exists. Please consider another name`
      );
    }
    const enabledFor = this._deps.config.get('environments')[0];

    return {
      details: {
        enabledFor,
        enabledForEnvs: this.calculateEnabledForEnvs(enabledFor),
      },
      commit: async ({ description }: { description: string }) => {
        this._flags.push({
          name,
          description,
          enabledFor,
          history: [{ action: 'Introduce', by: byUser, at: DateTime.now().toISO()! }],
        });
        await this.save();
      },
    };
  }

  removeFlag(name: string, byUser: string) {
    this.ensureLoaded();
    const flag = this.getFlagEntry(name);
    if (!flag) {
      throw new Error(`Feature Flag ${name} does not exist`);
    }
    return {
      details: {
        enabledFor: flag.enabledFor,
        enabledForEnvs: this.calculateEnabledForEnvs(flag.enabledFor),
        description: flag.description,
      },
      commit: async () => {
        flag.history.push({ action: 'Delete', by: byUser, at: DateTime.now().toISO()! });
        flag.deleted = true;
        await this.save();
      },
    };
  }

  updateFlag(name: string, byUser: string) {
    this.ensureLoaded();
    const flag = this.getFlagEntry(name);
    if (!flag) {
      throw new Error(`Feature Flag ${name} does not exist`);
    }
    return {
      details: {
        enabledFor: flag.enabledFor,
        enabledForEnvs: this.calculateEnabledForEnvs(flag.enabledFor),
        description: flag.description,
      },
      commit: async ({ description, enabledFor }: { description: string; enabledFor: string }) => {
        flag.history.push({ action: 'Update', by: byUser, at: DateTime.now().toISO()! });
        flag.description = description;
        flag.enabledFor = enabledFor;
        await this.save();
      },
    };
  }

  getFlags() {
    this.ensureLoaded();
    return this.flags
      .filter(({ deleted }) => !deleted)
      .map(({ name, description, enabledFor }) => ({
        name,
        description,
        enabledFor,
        enabledForEnvs: this.calculateEnabledForEnvs(enabledFor),
      }));
  }

  private getFlagEntry(name: string): Flag | undefined {
    this.ensureLoaded();
    return this._flags.find((ft) => ft.name === name);
  }

  private ensureLoaded() {
    if (!this._flags) {
      throw new Error('Config is not loaded. Did you forget to call load()?');
    }
  }

  calculateEnabledForEnvs(enabledFor: string): string[] {
    this.ensureLoaded();
    let enabled = true;
    const environments = this._deps.config.get('environments');
    if (!environments.includes(enabledFor)) {
      return [];
    }
    return environments.filter((env) => {
      if (!enabled) {
        return false;
      }
      if (env === enabledFor) {
        enabled = false;
        return true;
      }
      return true;
    });
  }
}
