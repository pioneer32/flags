import path from 'node:path';
import fs from 'fs-extra';
import Joi from 'joi';

import Env from './Env.js';
import ChainedError from './ChainedError.js';
import Logger from './Logger.js';

/* eslint-disable no-console */

type Params = {
  flagFile: string;
  flagPrefix: string;
  environments: string[];
  output: {
    jsonFile: string;
    typeDefFile?: string;
  };
};

type OutputParams = Omit<Params, 'output'> & {
  'output.jsonFile': Params['output']['jsonFile'];
  'output.typeDefFile': Params['output']['typeDefFile'];
};

type Deps = {
  env: Env;
};

const defaultConfig: Params = {
  flagFile: '{rootDir}/features.json',
  flagPrefix: 'FT_',
  environments: ['dev', 'tst', 'stg', 'prd'],
  output: {
    jsonFile: '{rootDir}/features.output.json',
    typeDefFile: '{rootDir}/features.output.d.ts',
  } as Params['output'],
};

const configSchema = Joi.object<Params>({
  flagFile: Joi.string().default(defaultConfig.flagFile),
  flagPrefix: Joi.string().default(defaultConfig.flagPrefix),
  environments: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[a-z\d_\-]+$/i)
        .required()
    )
    .min(1)
    .default(defaultConfig.environments),
  output: Joi.object<Params['output']>({
    jsonFile: Joi.string().required(),
    typeDefFile: Joi.string(),
  }).default(defaultConfig.output),
});

export default class Config {
  private _opts!: Params;
  constructor(private _deps: Deps) {}

  async load() {
    const filename = this.configFilename;
    if (!(await fs.pathExists(filename))) {
      Logger.warn(`No config file found. Defaulting. Using default options`);
      this._opts = { ...defaultConfig };
      return;
    }

    try {
      const opts = await fs.readJson(filename);
      this._opts = await configSchema.validateAsync(opts);
      Logger.info(`Config loaded from "${filename}"`);
    } catch (err) {
      throw new ChainedError(`Failed to load config file "${filename}"`, err as Error);
    }
  }

  get<T extends keyof OutputParams>(name: T): OutputParams[T] {
    this.ensureLoaded();
    switch (name) {
      case 'flagFile':
        return path.resolve(this.tempatePath(this._opts.flagFile)) as OutputParams[T];
      case 'flagPrefix':
        return this._opts.flagPrefix as OutputParams[T];
      case 'environments':
        return this._opts.environments as OutputParams[T];
      case 'output.jsonFile':
        return path.resolve(this.tempatePath(this._opts.output.jsonFile)) as OutputParams[T];
      case 'output.typeDefFile':
        return (this._opts.output.typeDefFile && path.resolve(this.tempatePath(this._opts.output.typeDefFile))) as OutputParams[T];
      default:
        throw new Error(`Unsupported config property: "${name}"`);
    }
  }

  async save() {
    const filename = this.configFilename;
    if (await fs.pathExists(filename)) {
      throw new Error(`Config file already exists at "${filename}"`);
    }
    try {
      await fs.writeJson(filename, this._opts, { spaces: '  ' });
      Logger.info(`Default config saved in "${filename}"`);
    } catch (err) {
      throw new ChainedError(`Failed to write config file "${filename}"`, err as Error);
    }
  }

  private get configFilename(): string {
    return path.resolve(this._deps.env.get('rootDir'), 'flags.config.json');
  }

  private ensureLoaded() {
    if (!this._opts) {
      throw new Error('Config is not loaded. Did you forget to call load()?');
    }
  }

  private tempatePath(val: string): string {
    return val.replace('{rootDir}', this._deps.env.get('rootDir'));
  }
}
