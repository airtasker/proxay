import assertNever from "assert-never";
import chalk from "chalk";
import http from "http";
import { ensureBuffer } from "./buffer";
import { findFirstLeastUsedRecord, findRecordMatches } from "./matcher";
import { Persistence } from "./persistence";
import { send } from "./sender";
import { Headers, TapeRecord } from "./tape";

/**
 * A server that proxies or replays requests depending on the mode.
 */
export class RecordReplayServer {
  private server: http.Server;
  private persistence: Persistence;

  private mode: Mode;
  private proxiedHost?: string;
  private timeout: number;
  private currentTapeRecords: TapeRecord[] = [];
  private currentTape!: string;
  private loggingEnabled: boolean;
  private matchedRequestsCounts: Map<TapeRecord, number> = new Map();

  constructor(options: {
    initialMode: Mode;
    tapeDir: string;
    host?: string;
    timeout?: number;
    enableLogging?: boolean;
  }) {
    this.currentTapeRecords = [];
    this.mode = options.initialMode;
    this.proxiedHost = options.host;
    this.timeout = options.timeout || 5000;
    this.loggingEnabled = options.enableLogging || false;
    this.persistence = new Persistence(options.tapeDir);
    this.loadTape(DEFAULT_TAPE);

    this.server = http.createServer(async (req, res) => {
      if (!req.url) {
        if (this.loggingEnabled) {
          console.error(chalk.red("Received a request without URL."));
        }
        return;
      }
      if (!req.method) {
        if (this.loggingEnabled) {
          console.error(chalk.red("Received a request without HTTP method."));
        }
        return;
      }

      try {
        const requestBody = await receiveRequestBody(req);
        const requestPath = extractPath(req.url);
        if (
          requestPath === "/__proxay" ||
          requestPath.startsWith("/__proxay/")
        ) {
          this.handleProxayApi(req.method, requestPath, requestBody, res);
          return;
        }

        let record: TapeRecord | null;
        switch (this.mode) {
          case "replay":
            record = findFirstLeastUsedRecord(
              findRecordMatches(
                this.currentTapeRecords,
                req.method,
                requestPath,
                req.headers,
                requestBody
              ),
              this.matchedRequestsCounts
            );
            if (record) {
              if (this.loggingEnabled) {
                console.log(`Replayed: ${req.method} ${requestPath}`);
              }
            } else {
              if (this.loggingEnabled) {
                console.warn(
                  chalk.yellow(
                    `Unexpected request ${
                      req.method
                    } ${requestPath} has no matching record in tapes.`
                  )
                );
              }
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
            if (this.loggingEnabled) {
              console.log(`Recorded: ${req.method} ${requestPath}`);
            }
            break;
          case "mimic":
            record = findFirstLeastUsedRecord(
              findRecordMatches(
                this.currentTapeRecords,
                req.method,
                requestPath,
                req.headers,
                requestBody
              ),
              this.matchedRequestsCounts
            );
            if (record) {
              if (this.loggingEnabled) {
                console.log(`Replayed: ${req.method} ${requestPath}`);
              }
            } else {
              record = await this.proxy(
                req.method,
                requestPath,
                req.headers,
                requestBody
              );
              this.addRecordToTape(record);
              if (this.loggingEnabled) {
                console.log(`Recorded: ${req.method} ${requestPath}`);
              }
            }
            break;
          case "passthrough":
            record = await this.proxy(
              req.method,
              requestPath,
              req.headers,
              requestBody
            );
            if (this.loggingEnabled) {
              console.log(`Proxied: ${req.method} ${requestPath}`);
            }
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
        if (this.loggingEnabled) {
          console.error(chalk.red("Unexpected error:"), e);
        }
        res.statusCode = 500;
        res.end();
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
    try {
      return await send(
        this.proxiedHost,
        requestMethod,
        requestPath,
        requestHeaders,
        requestBody,
        this.timeout
      );
    } catch (e) {
      if (e.code) {
        if (this.loggingEnabled) {
          console.error(
            chalk.red(
              `Could not proxy request ${requestMethod} ${requestPath} (${
                e.code
              })`
            )
          );
        }
      } else {
        if (this.loggingEnabled) {
          console.error(
            chalk.red(
              `Could not proxy request ${requestMethod} ${requestPath}`,
              e
            )
          );
        }
      }
      throw e;
    }
  }

  /**
   * Handles requests that are intended for Proxay itself.
   */
  private handleProxayApi(
    requestMethod: string,
    requestPath: string,
    requestBody: Buffer,
    res: http.ServerResponse
  ) {
    // Sending a request to /__proxay will return a 200 (so tests can identify whether
    // their backend is Proxay or not).
    if (requestMethod.toLowerCase() === "get" && requestPath === "/__proxay") {
      res.end("Proxay!");
    }

    // Sending a request to /__proxay/tape will pick a specific tape and/or a new mode.
    if (
      requestMethod.toLowerCase() === "post" &&
      requestPath === "/__proxay/tape"
    ) {
      const json = requestBody.toString("utf8");
      let tape;
      let mode;
      try {
        const body = JSON.parse(json);
        tape = body.tape || this.currentTape;
        mode = body.mode || this.mode;
      } catch {
        tape = null;
        mode = this.mode;
      }
      if (mode !== this.mode) {
        this.mode = mode;
      }
      if (tape) {
        if (!this.persistence.isTapeNameValid(tape)) {
          const errorMessage = `Invalid tape name: ${tape}`;
          if (this.loggingEnabled) {
            console.error(chalk.red(errorMessage));
          }
          res.statusCode = 403;
          res.end(errorMessage);
          return;
        }
        if (this.loadTape(tape)) {
          res.end(`Updated tape: ${tape}`);
        } else {
          res.statusCode = 404;
          res.end(`Missing tape: ${tape}`);
        }
      } else {
        this.unloadTape();
        res.end(`Unloaded tape`);
      }
    }
  }

  /**
   * Loads a specific tape into memory (erasing it in record mode).
   *
   * @returns Whether the tape was found or not (always true in record/mimic mode).
   */
  private loadTape(tapeName: string): boolean {
    this.currentTape = tapeName;
    if (this.loggingEnabled) {
      console.log(chalk.blueBright(`Loaded tape: ${tapeName}`));
    }
    switch (this.mode) {
      case "record":
        this.currentTapeRecords = [];
        this.persistence.saveTapeToDisk(this.currentTape, []);
        return true;
      case "replay":
        try {
          this.currentTapeRecords = this.persistence.loadTapeFromDisk(
            this.currentTape
          );
          return true;
        } catch (e) {
          if (this.loggingEnabled) {
            console.warn(chalk.yellow(e.message));
          }
          return false;
        }
      case "mimic":
        try {
          this.currentTapeRecords = this.persistence.loadTapeFromDisk(
            this.currentTape
          );
        } catch (e) {
          this.currentTapeRecords = [];
          this.persistence.saveTapeToDisk(this.currentTape, []);
        }
        return true;
      case "passthrough":
        // Do nothing.
        return true;
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
