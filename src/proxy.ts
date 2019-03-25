import chalk from "chalk";
import { send } from "./sender";
import { Headers, TapeRecord } from "./tape";

/**
 * Proxies a specific request and returns the resulting record.
 */
export async function proxy(
  request: {
    host: string;
    method: string;
    path: string;
    headers: Headers;
    body: Buffer;
    timeout: number;
  },
  options: {
    loggingEnabled?: boolean;
  }
): Promise<TapeRecord> {
  try {
    return await send(
      request.host,
      request.method,
      request.path,
      request.headers,
      request.body,
      request.timeout
    );
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
