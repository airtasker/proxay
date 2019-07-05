import assertNever from "assert-never";
import chalk from "chalk";
import http from "http";
import { ensureBuffer } from "./buffer";
import { findNextRecordToReplay, findRecordMatches } from "./matcher";
import { Mode } from "./modes";
import { Persistence } from "./persistence";
import { Request, send } from "./sender";
import { TapeRecord } from "./tape";

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
  private replayedTapes: Set<TapeRecord> = new Set();

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
        const request: Request = {
          method: req.method,
          path: extractPath(req.url),
          headers: req.headers,
          body: await receiveRequestBody(req)
        };
        if (
          request.path === "/__proxay" ||
          request.path.startsWith("/__proxay/")
        ) {
          this.handleProxayApi(request, res);
          return;
        }
        const record = await this.fetchResponse(request);
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
   * Handles requests that are intended for Proxay itself.
   */
  private handleProxayApi(request: Request, res: http.ServerResponse) {
    // Sending a request to /__proxay will return a 200 (so tests can identify whether
    // their backend is Proxay or not).
    if (
      request.method.toLowerCase() === "get" &&
      request.path === "/__proxay"
    ) {
      res.end("Proxay!");
    }

    // Sending a request to /__proxay/tape will pick a specific tape and/or a new mode.
    if (
      request.method.toLowerCase() === "post" &&
      request.path === "/__proxay/tape"
    ) {
      const json = request.body.toString("utf8");
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

  private async fetchResponse(request: Request): Promise<TapeRecord | null> {
    switch (this.mode) {
      case "replay":
        return this.fetchReplayResponse(request);
      case "record":
        return this.fetchRecordResponse(request);
      case "mimic":
        return this.fetchMimicResponse(request);
      case "passthrough":
        return this.fetchPassthroughResponse(request);
      default:
        throw assertNever(this.mode);
    }
  }

  /**
   * Fetches the response from the tape, returning null otherwise.
   */
  private async fetchReplayResponse(
    request: Request
  ): Promise<TapeRecord | null> {
    const record = findNextRecordToReplay(
      findRecordMatches(
        this.currentTapeRecords,
        request.method,
        request.path,
        request.headers,
        request.body
      ),
      this.replayedTapes
    );
    if (record) {
      this.replayedTapes.add(record);
      if (this.loggingEnabled) {
        console.log(`Replayed: ${request.method} ${request.path}`);
      }
    } else {
      if (this.loggingEnabled) {
        console.warn(
          chalk.yellow(
            `Unexpected request ${request.method} ${request.path} has no matching record in tapes.`
          )
        );
      }
    }
    return record;
  }

  /**
   * Fetches the response directly from the proxied host and records it.
   */
  private async fetchRecordResponse(
    request: Request
  ): Promise<TapeRecord | null> {
    if (!this.proxiedHost) {
      throw new Error("Missing proxied host");
    }
    const record = await send(
      {
        host: this.proxiedHost,
        method: request.method,
        path: request.path,
        headers: request.headers,
        body: request.body
      },
      {
        loggingEnabled: this.loggingEnabled,
        timeout: this.timeout
      }
    );
    this.addRecordToTape(record);
    if (this.loggingEnabled) {
      console.log(`Recorded: ${request.method} ${request.path}`);
    }
    return record;
  }

  /**
   * Fetches the response from the tape if present, otherwise from the proxied host.
   */
  private async fetchMimicResponse(
    request: Request
  ): Promise<TapeRecord | null> {
    let record = findNextRecordToReplay(
      findRecordMatches(
        this.currentTapeRecords,
        request.method,
        request.path,
        request.headers,
        request.body
      ),
      this.replayedTapes
    );
    if (record) {
      this.replayedTapes.add(record);
      if (this.loggingEnabled) {
        console.log(`Replayed: ${request.method} ${request.path}`);
      }
    } else {
      if (!this.proxiedHost) {
        throw new Error("Missing proxied host");
      }
      record = await send(
        {
          host: this.proxiedHost,
          method: request.method,
          path: request.path,
          headers: request.headers,
          body: request.body
        },
        {
          loggingEnabled: this.loggingEnabled,
          timeout: this.timeout
        }
      );
      this.addRecordToTape(record);
      if (this.loggingEnabled) {
        console.log(`Recorded: ${request.method} ${request.path}`);
      }
    }
    return record;
  }

  /**
   * Fetches the response directly from the proxied host without recording it.
   */
  private async fetchPassthroughResponse(
    request: Request
  ): Promise<TapeRecord | null> {
    if (!this.proxiedHost) {
      throw new Error("Missing proxied host");
    }
    const record = await send(
      {
        host: this.proxiedHost,
        method: request.method,
        path: request.path,
        headers: request.headers,
        body: request.body
      },
      {
        loggingEnabled: this.loggingEnabled,
        timeout: this.timeout
      }
    );
    if (this.loggingEnabled) {
      console.log(`Proxied: ${request.method} ${request.path}`);
    }
    return record;
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

function receiveRequestBody(req: http.IncomingMessage): Promise<Buffer> {
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
