import { CustomError } from 'ts-custom-error';

export default class ChainedError extends CustomError {
  public cause?: Error;

  public constructor(message?: string, cause?: Error) {
    super(message);
    this.cause = cause;
    let newStack = this.stack || '';
    if (cause) {
      newStack += `\n Caused by: ${cause.stack || cause}`;
    }
    this.stack = newStack;
  }
}
