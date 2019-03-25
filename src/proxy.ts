import chalk from "chalk";
import { RequestWithHost, send } from "./sender";
import { TapeRecord } from "./tape";

/**
 * Proxies a specific request and returns the resulting record.
 */
export async function proxy(
  request: RequestWithHost,
  options: {
    loggingEnabled?: boolean;
    timeout?: number;
  }
): Promise<TapeRecord> {
  try {
    return await send(request, options);
  } catch (e) {
    if (e.code) {
      if (options.loggingEnabled) {
        console.error(
          chalk.red(
            `Could not proxy request ${request.method} ${request.path} (${
              e.code
            })`
          )
        );
      }
    } else {
      if (options.loggingEnabled) {
        console.error(
          chalk.red(
            `Could not proxy request ${request.method} ${request.path}`,
            e
          )
        );
      }
    }
    throw e;
  }
}
