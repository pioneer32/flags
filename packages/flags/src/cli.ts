import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import process from 'node:process';
import banner from 'node-banner';
import chalk from 'chalk';

import FlagManager from './FlagManager.js';
import Config from './Config.js';
import Env from './Env.js';
import Prompter from './Prompter.js';

/* eslint-disable no-console */

const init = async () => {
  await banner('Feature Flags', 'The Ultimate Feature Flag Utility\n\n', 'white', 'white');
  const env = new Env();
  await env.load();
  const config = new Config({ env });
  await config.load();
  const prompter = new Prompter({ env, config });
  const flagManager = new FlagManager({ env, config });
  await flagManager.load();
  console.log('\n');
  return {
    env,
    config,
    flagManager,
    prompter,
  };
};

(async () => {
  await yargs(hideBin(process.argv))
    .command({
      command: ['add', 'new', 'create'],
      describe: 'Add a new flag interactively',
      handler: async () => {
        const { prompter, env, flagManager } = await init();
        const name = await prompter.askForNewFlagName();
        const username = env.get('gitUserName') || env.get('osUserName');
        const trx = flagManager.introduceNewFlag(name, username);
        const description = await prompter.askForValue('Description');
        await prompter.confirmDetails([
          ['Action', 'Adding a new Feature Flag'],
          ['with Name', name],
          ['with Description', description],
          ['enable for Environment(s)', trx.details.enabledForEnvs.join()],
          ['by User', username],
        ]);
        await trx.commit({ description });
        await flagManager.generateOutput();
      },
    })
    .command({
      command: ['remove', 'rm', 'delete', 'del'],
      describe: 'Remove a flag interactively',
      handler: async () => {
        const { prompter, flagManager, env } = await init();
        const name = await prompter.askForExistingFlagName(flagManager.getFlags());
        const username = env.get('gitUserName') || env.get('osUserName');
        const trx = flagManager.removeFlag(name, username);
        await prompter.confirmDetails([
          ['Action', 'Removing a Feature Flag'],
          ['with Name', name],
          ...(trx.details.description ? [['with Description', trx.details.description]] : []),
          ['which currently enabled for Environment(s)', trx.details.enabledForEnvs.join()],
          ['by User', username],
        ]);
        await trx.commit();
        await flagManager.generateOutput();
      },
    })
    .command({
      command: ['set', 'toggle', 'update'],
      describe: 'Set the states for a feature flag interactively',
      handler: async () => {
        const { prompter, env, flagManager } = await init();
        const name = await prompter.askForExistingFlagName(flagManager.getFlags());
        const username = env.get('gitUserName') || env.get('osUserName');
        const trx = flagManager.updateFlag(name, username);

        const description = await prompter.askForValue('Description', trx.details.description);
        const enabledFor = await prompter.askForEnvironment(trx.details.enabledFor);

        const descChange = description === trx.details.description;
        const envChange = enabledFor !== trx.details.enabledFor;

        if (!descChange && !envChange) {
          console.info('WARN No changes to make');
          return;
        }

        await prompter.confirmDetails([
          ['Action', 'Updating a Feature Flag'],
          ['with Name', name],
          ...(descChange ? [['with new Description', description]] : []),
          ...(envChange ? ([['enabling for Environment(s)', flagManager.calculateEnabledForEnvs(enabledFor).join()]] as [string, string][]) : []),

          ['by User', username],
        ]);
        await trx.commit({ description, enabledFor });
        await flagManager.generateOutput();
      },
    })
    .command({
      command: ['lint', 'check', 'validate'],
      describe: 'Check the feature flags files are well-formed',
      handler: async () => {
        await init(); // this loads Feature Flags file... and validates it
        console.info('INFO No error found');
      },
    })
    .command({
      command: ['gen', 'generate'],
      describe: 'Generate the ouput JSON and Typescript Type Definition files',
      handler: async () => {
        const { flagManager } = await init();
        await flagManager.generateOutput();
      },
    })
    .command({
      command: ['list', 'ls'],
      describe: 'List flags',
      handler: async () => {
        const { prompter, flagManager } = await init();
        prompter.printDetails(flagManager.getFlags().map(({ name, enabledForEnvs, description }) => [name, enabledForEnvs.join(), description]));
      },
    })
    .command({
      command: ['init'],
      describe: 'Initialise a default config file',
      handler: async () => {
        const { config } = await init();
        await config.save();
      },
    })
    .fail((msg, err) => {
      console.error(chalk.red(err?.message || msg));
      if (err) {
        throw err;
      }
      process.exit(1);
    })
    .demandCommand(1)
    .parseAsync();

  console.log(chalk.green('\nDone!\n'));
})();
