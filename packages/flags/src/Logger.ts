import chalk from 'chalk';

export default class Logger {
  public static error(msg: string) {
    console.error(chalk.red(`ERR ${msg}`));
  }

  public static warn(msg: string) {
    console.warn(chalk.yellow(`WARN ${msg}`));
  }

  public static info(msg: string) {
    console.info(chalk.grey(`INFO ${msg}`));
  }

  public static message(msg: string) {
    console.log(chalk.white(`MSG ${msg}`));
  }
}
