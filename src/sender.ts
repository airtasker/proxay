import http from "http";
import https from "https";
import { ensureBuffer } from "./buffer";
import { Headers, TapeRecord } from "./tape";

/**
 * Sends a network request and returns the recorded tape.
 */
export async function send(
  host: string,
  method: string,
  path: string,
  headers: Headers,
  body: Buffer,
  timeout?: number
): Promise<TapeRecord> {
  const [scheme, hostnameWithPort] = host.split("://");
  const [hostname, port] = hostnameWithPort.split(":");
  const response = await new Promise<http.IncomingMessage>(
    (resolve, reject) => {
      const requestOptions: http.RequestOptions = {
        hostname,
        method,
        path,
        port,
        headers: {
          ...headers,
          host: hostname
        },
        timeout
      };
      const proxyRequest =
        scheme === "http"
          ? http.request(requestOptions, resolve)
          : https.request(requestOptions, resolve);
      proxyRequest.on("error", reject);
      proxyRequest.write(body);
      proxyRequest.end();
    }
  );
  const statusCode = response.statusCode || 200;
  const responseBody = await new Promise<Buffer>(resolve => {
    const chunks: Buffer[] = [];
    response.on("data", chunk => {
      chunks.push(ensureBuffer(chunk));
    });
    response.on("end", () => resolve(Buffer.concat(chunks)));
  });
  return {
    request: {
      method,
      path,
      headers,
      body
    },
    response: {
      status: {
        code: statusCode
      },
      headers: response.headers,
      body: responseBody
    }
  };
}
