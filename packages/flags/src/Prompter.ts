import { confirm, input, select } from '@inquirer/prompts';
import process from 'node:process';
import chalk from 'chalk';

import Env from './Env.js';
import Config from './Config.js';

/* eslint-disable no-console */

type Deps = {
  env: Env;
  config: Config;
};

export default class Prompter {
  constructor(private _deps: Deps) {}

  async askForNewFlagName() {
    const flagName = await input({
      message: 'Flag name',
      validate: (val) => {
        if (!val.match(/^[A-Z0-9_]+$/)) {
          return `The flag name should match [A-Z0-9_]+, got "${val}"`;
        }
        return true;
      },
      transformer: (val) => this.prefixFeatureFlagName(val),
    });
    return this.prefixFeatureFlagName(flagName);
  }

  async askForExistingFlagName(flags: { name: string; description?: string; enabledForEnvs: string[] }[]) {
    return select({
      message: 'Select a flag',
      choices: flags.map(({ name, enabledForEnvs, description }) => ({
        value: name,
        name: `${name}${enabledForEnvs?.length ? ` [${enabledForEnvs.join()}]` : ''}`,
        ...(description ? { description } : {}),
      })),
    });
  }

  async askForEnvironment(enabledFor: string) {
    return select({
      message: "Select environment it's enabled for",
      default: enabledFor,
      choices: this._deps.config.get('environments').map((env) => ({
        name: env,
        value: env,
      })),
    });
  }

  async askForValue(message: string, value?: string | undefined) {
    return input({ message, default: value });
  }

  printDetails(details: (string | undefined)[][]) {
    console.log('');
    details.forEach(([name, value, extra]) => {
      console.log(`${chalk.white(name || '')} ${chalk.yellow(value || '')}${extra ? chalk.grey(` ${extra}`) : ''}`);
    });
    console.log('');
  }

  async confirmDetails(details: string[][]) {
    this.printDetails(details);
    const answer = await confirm({ message: 'Does the above look correct?' });
    if (!answer) {
      process.exit(1);
    }
    console.log('');
  }

  private prefixFeatureFlagName(val: string): string {
    const flagPrefix = this._deps.config.get('flagPrefix');
    if (!flagPrefix) {
      return val;
    }
    return `${flagPrefix}${val.replace(new RegExp(`^${this._deps.config.get('flagPrefix')}`), '')}`;
  }
}
