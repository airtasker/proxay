import chalk from "chalk";
import http from "http";
import https from "https";
import { ensureBuffer } from "./buffer";
import { HttpRequestWithHost } from "./core";
import { TapeRecord } from "./tape";

/**
 * Sends a network request and returns the recorded tape.
 */
export async function send(
  request: HttpRequestWithHost,
  options: {
    loggingEnabled?: boolean;
    timeout?: number;
  },
): Promise<TapeRecord> {
  try {
    const [scheme, hostnameWithPort] = request.host.split("://");
    const [hostname, port] = hostnameWithPort.split(":");
    const response = await new Promise<http.IncomingMessage>(
      (resolve, reject) => {
        const requestOptions: http.RequestOptions = {
          hostname,
          method: request.method,
          path: request.path,
          port,
          headers: {
            ...request.headers,
            host: hostname,
          },
          timeout: options.timeout,
        };
        const proxyRequest =
          scheme === "http"
            ? http.request(requestOptions, resolve)
            : https.request(requestOptions, resolve);
        proxyRequest.on("error", reject);
        proxyRequest.write(request.body);
        proxyRequest.end();
      },
    );
    const statusCode = response.statusCode || 200;
    const responseBody = await new Promise<Buffer>((resolve) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => {
        chunks.push(ensureBuffer(chunk));
      });
      response.on("end", () => resolve(Buffer.concat(chunks)));
    });
    return {
      request: {
        method: request.method,
        path: request.path,
        headers: request.headers,
        body: request.body,
      },
      response: {
        status: {
          code: statusCode,
        },
        headers: response.headers,
        body: responseBody,
      },
    };
  } catch (e) {
    if (options.loggingEnabled) {
      const errorCode = (e as Record<string, any>)?.code;
      console.error(
        chalk.red(
          `Could not send request ${request.method} ${request.path} (error: ${
            errorCode || "unknown"
          })`,
        ),
      );
    }
    throw e;
  }
}
