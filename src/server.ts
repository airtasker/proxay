import assertNever from "assert-never";
import chalk from "chalk";
import http from "http";
import https from "https";
import { Persistence } from "./persistence";
import { Headers, TapeRecord } from "./tape";

/**
 * A server that proxies or replays requests depending on the mode.
 */
export class RecordReplayServer {
  private server: http.Server;
  private persistence: Persistence;

  private mode: Mode;
  private proxiedHost?: string;
  private currentTapeRecords: TapeRecord[] = [];
  private currentTape!: string;
  private loggingEnabled: boolean;

  constructor(options: {
    mode: Mode;
    tapeDir: string;
    host?: string;
    enableLogging?: boolean;
  }) {
    this.currentTapeRecords = [];
    this.mode = options.mode;
    this.proxiedHost = options.host;
    this.loggingEnabled = options.enableLogging || false;
    this.persistence = new Persistence(options.tapeDir);
    this.loadTape(DEFAULT_TAPE);

    this.server = http.createServer(async (req, res) => {
      if (!req.url) {
        this.loggingEnabled &&
          console.error(chalk.red("Received a request without URL."));
        return;
      }
      if (!req.method) {
        this.loggingEnabled &&
          console.error(chalk.red("Received a request without HTTP method."));
        return;
      }

      try {
        const requestBody = await receiveRequestBody(req);
        const requestPath = extractPath(req.url);

        if (requestPath.startsWith("/__proxay/")) {
          this.handleProxayApi(requestPath, requestBody, res);
          return;
        }

        let record: TapeRecord | null;
        switch (this.mode) {
          case "replay":
            record = this.findRecord(
              req.method,
              requestPath,
              req.headers,
              requestBody
            );
            if (record) {
              this.loggingEnabled &&
                console.log(`Replayed: ${req.method} ${requestPath}`);
            } else {
              this.loggingEnabled &&
                console.warn(
                  chalk.yellow(
                    `Unexpected request ${
                      req.method
                    } ${requestPath} has no matching record in tapes.`
                  )
                );
            }
            break;
          case "record":
            record = await this.proxy(
              req.method,
              requestPath,
              req.headers,
              requestBody
            );
            this.addRecordToTape(record);
            this.loggingEnabled &&
              console.log(`Recorded: ${req.method} ${requestPath}`);
            break;
          case "mimic":
            record = this.findRecord(
              req.method,
              requestPath,
              req.headers,
              requestBody
            );
            if (record) {
              this.loggingEnabled &&
                console.log(`Replayed: ${req.method} ${requestPath}`);
            } else {
              record = await this.proxy(
                req.method,
                requestPath,
                req.headers,
                requestBody
              );
              this.addRecordToTape(record);
              this.loggingEnabled &&
                console.log(`Recorded: ${req.method} ${requestPath}`);
            }
            break;
          case "passthrough":
            record = await this.proxy(
              req.method,
              requestPath,
              req.headers,
              requestBody
            );
            this.loggingEnabled &&
              console.log(`Proxied: ${req.method} ${requestPath}`);
            break;
          default:
            throw assertNever(this.mode);
        }

        if (record) {
          this.sendResponse(record, res);
        } else {
          res.statusCode = 500;
          res.end();
        }
      } catch (e) {
        this.loggingEnabled && console.error(chalk.red("Unexpected error:"), e);
      }
    });
  }

  /**
   * Starts the server.
   */
  async start(port: number) {
    await new Promise(resolve => this.server.listen(port, resolve));
  }

  /**
   * Stops the server.
   */
  async stop() {
    await new Promise(resolve => this.server.close(resolve));
  }

  /**
   * Handles requests that are intended for Proxay itself.
   */
  private handleProxayApi(
    requestPath: string,
    requestBody: Buffer,
    res: http.ServerResponse
  ) {
    // Sending a request to /__proxay/tape will pick a specific tape.
    if (requestPath === "/__proxay/tape") {
      const json = requestBody.toString("utf8");
      let tape;
      try {
        tape = JSON.parse(json).tape;
      } catch {
        tape = null;
      }
      if (tape) {
        if (!this.persistence.isTapeNameValid(tape)) {
          const errorMessage = `Invalid tape name: ${tape}`;
          this.loggingEnabled && console.error(chalk.red(errorMessage));
          res.statusCode = 403;
          res.end(errorMessage);
          return;
        }
        this.loadTape(tape);
        res.end(`Updated tape: ${tape}`);
      } else {
        this.unloadTape();
        res.end(`Unloaded tape`);
      }
    }
  }

  /**
   * Loads a specific tape into memory (erasing it in record mode).
   */
  private loadTape(tapeName: string) {
    this.currentTape = tapeName;
    this.loggingEnabled &&
      console.log(chalk.blueBright(`Loaded tape: ${tapeName}`));
    switch (this.mode) {
      case "record":
        this.currentTapeRecords = [];
        this.persistence.saveTapeToDisk(this.currentTape, []);
        break;
      case "replay":
        try {
          this.currentTapeRecords = this.persistence.loadTapeFromDisk(
            this.currentTape
          );
        } catch (e) {
          this.loggingEnabled && console.warn(chalk.yellow(e.message));
        }
        break;
      case "mimic":
        try {
          this.currentTapeRecords = this.persistence.loadTapeFromDisk(
            this.currentTape
          );
        } catch (e) {
          this.currentTapeRecords = [];
          this.persistence.saveTapeToDisk(this.currentTape, []);
        }
        break;
      case "passthrough":
        // Do nothing.
        break;
      default:
        throw assertNever(this.mode);
    }
  }

  /**
   * Unloads the current tape, falling back to the default.
   */
  private unloadTape() {
    this.loadTape(DEFAULT_TAPE);
  }

  /**
   * Adds a new record to the current tape and saves to disk.
   */
  private addRecordToTape(record: TapeRecord) {
    this.currentTapeRecords.push(record);
    this.persistence.saveTapeToDisk(this.currentTape, this.currentTapeRecords);
  }

  /**
   * Finds a matching record for a particular request.
   */
  private findRecord(
    requestMethod: string,
    requestPath: string,
    _requestHeaders: Headers,
    requestBody: Buffer
  ): TapeRecord | null {
    const potentialMatches = this.currentTapeRecords.filter(
      record =>
        record.request.method === requestMethod &&
        pathWithoutQueryParameters(record.request.path) ===
          pathWithoutQueryParameters(requestPath)
    );
    const sameQueryParameters = potentialMatches.filter(
      record => record.request.path === requestPath
    );
    const identicalBody = potentialMatches.filter(record =>
      record.request.body.equals(requestBody)
    );
    const identicalBodyAndQueryParameters = potentialMatches.filter(
      record =>
        record.request.path === requestPath &&
        record.request.body.equals(requestBody)
    );
    // Pick the best fit.
    return (
      identicalBodyAndQueryParameters[0] ||
      identicalBody[0] ||
      sameQueryParameters[0] ||
      potentialMatches[0] ||
      null
    );
  }

  /**
   * Proxies a specific request and returns the resulting record.
   */
  async proxy(
    requestMethod: string,
    requestPath: string,
    requestHeaders: Headers,
    requestBody: Buffer
  ): Promise<TapeRecord> {
    if (!this.proxiedHost) {
      throw new Error("Missing proxied host");
    }
    const [scheme, hostnameWithPort] = this.proxiedHost.split("://");
    const [hostname, port] = hostnameWithPort.split(":");
    try {
      const response = await new Promise<http.IncomingMessage>(resolve => {
        const requestOptions: http.RequestOptions = {
          hostname: hostname,
          method: requestMethod,
          path: requestPath,
          port,
          headers: {
            ...requestHeaders,
            host: hostname
          }
        };
        const proxyRequest =
          scheme === "http"
            ? http.request(requestOptions, resolve)
            : https.request(requestOptions, resolve);
        proxyRequest.write(requestBody);
        proxyRequest.end();
      });

      const statusCode = response.statusCode || 200;
      let responseBody = await new Promise<Buffer>(resolve => {
        let chunks: Buffer[] = [];
        response.on("data", chunk => {
          chunks.push(ensureBuffer(chunk));
        });
        response.on("end", () => resolve(Buffer.concat(chunks)));
      });
      return {
        request: {
          method: requestMethod,
          path: requestPath,
          headers: requestHeaders,
          body: requestBody
        },
        response: {
          status: {
            code: statusCode
          },
          headers: response.headers,
          body: responseBody
        }
      };
    } catch (e) {
      if (e.code) {
        this.loggingEnabled &&
          console.error(
            chalk.red(
              `Could not proxy request ${requestMethod} ${requestPath} (${
                e.code
              })`
            )
          );
      } else {
        this.loggingEnabled &&
          console.error(
            chalk.red(
              `Could not proxy request ${requestMethod} ${requestPath}`,
              e
            )
          );
      }
      throw e;
    }
  }

  /**
   * Sends a particular response to the client.
   */
  private sendResponse(record: TapeRecord, res: http.ServerResponse) {
    res.statusCode = record.response.status.code;
    Object.keys(record.response.headers).forEach(headerName => {
      const headerValue = record.response.headers[headerName];
      if (headerValue) {
        res.setHeader(headerName, headerValue);
      }
    });
    res.end(record.response.body);
  }
}

function receiveRequestBody(req: http.ServerRequest): Promise<Buffer> {
  const requestChunks: Buffer[] = [];
  req.on("data", chunk => {
    requestChunks.push(ensureBuffer(chunk));
  });
  return new Promise(resolve => {
    req.on("end", () => resolve(Buffer.concat(requestChunks)));
  });
}

function ensureBuffer(stringOrBuffer: string | Buffer) {
  return typeof stringOrBuffer === "string"
    ? Buffer.from(stringOrBuffer, "utf8")
    : stringOrBuffer;
}

function extractPath(url: string) {
  const schemePosition = url.indexOf("://");
  let path;
  if (schemePosition !== -1) {
    const pathPosition = url.indexOf("/", schemePosition + 3);
    path = url.substr(pathPosition);
  } else {
    path = url;
  }
  return path;
}

function pathWithoutQueryParameters(path: string) {
  const questionMarkPosition = path.indexOf("?");
  if (questionMarkPosition !== -1) {
    return path.substr(0, questionMarkPosition);
  } else {
    return path;
  }
}

const DEFAULT_TAPE = "default";

/**
 * Possible modes.
 */
export type Mode = ReplayMode | RecordMode | MimicMode | PassthroughMode;

/**
 * Replays requests from tapes. Fails any unexpected requests.
 */
export type ReplayMode = "replay";

/**
 * Records requests. Ignores recorded tapes.
 */
export type RecordMode = "record";

/**
 * Records requests the first time it encounters them, then replays them.
 */
export type MimicMode = "mimic";

/**
 * Acts as a pass-through proxy. No recording occurs.
 */
export type PassthroughMode = "passthrough";
