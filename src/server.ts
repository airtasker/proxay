import assertNever from "assert-never";
import chalk from "chalk";
import fs from "fs";
import http from "http";
import https from "https";
import net from "net";
import { ensureBuffer } from "./buffer";
import { HttpRequest } from "./http";
import { findNextRecordToReplay, findRecordMatches } from "./matcher";
import { Mode } from "./modes";
import { Persistence } from "./persistence";
import { RewriteRules } from "./rewrite";
import { send } from "./sender";
import { TapeRecord } from "./tape";

/**
 * A server that proxies or replays requests depending on the mode.
 */
export class RecordReplayServer {
  private server: net.Server;
  private persistence: Persistence;

  private mode: Mode;
  private proxiedHost?: string;
  private timeout: number;
  private currentTapeRecords: TapeRecord[] = [];
  private currentTape!: string;
  private loggingEnabled: boolean;
  private defaultTape: string;
  private replayedTapes: Set<TapeRecord> = new Set();
  private preventConditionalRequests?: boolean;
  private unframeGrpcWebJsonRequestsHostnames: string[];
  private rewriteBeforeDiffRules: RewriteRules;

  constructor(options: {
    initialMode: Mode;
    tapeDir: string;
    defaultTapeName: string;
    host?: string;
    timeout?: number;
    enableLogging?: boolean;
    redactHeaders?: string[];
    preventConditionalRequests?: boolean;
    httpsCA?: string;
    httpsKey?: string;
    httpsCert?: string;
    unframeGrpcWebJsonRequestsHostnames?: string[];
    rewriteBeforeDiffRules?: RewriteRules;
  }) {
    this.currentTapeRecords = [];
    this.mode = options.initialMode;
    this.proxiedHost = options.host;
    this.timeout = options.timeout || 5000;
    this.loggingEnabled = options.enableLogging || false;
    const redactHeaders = options.redactHeaders || [];
    this.persistence = new Persistence(options.tapeDir, redactHeaders);
    this.defaultTape = options.defaultTapeName;
    this.preventConditionalRequests = options.preventConditionalRequests;
    this.unframeGrpcWebJsonRequestsHostnames =
      options.unframeGrpcWebJsonRequestsHostnames || [];
    this.rewriteBeforeDiffRules =
      options.rewriteBeforeDiffRules || new RewriteRules();
    this.loadTape(this.defaultTape);

    const handler = async (
      req: http.IncomingMessage,
      res: http.ServerResponse,
    ) => {
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
        const request: HttpRequest = {
          method: req.method,
          path: extractPath(req.url),
          headers: req.headers,
          body: await receiveRequestBody(req),
        };

        // Is this a proxay API call?
        if (
          request.path === "/__proxay" ||
          request.path.startsWith("/__proxay/")
        ) {
          this.handleProxayApi(request, res);
          return;
        }

        // Potentially rewrite the request before processing it at all.
        this.rewriteRequest(request);

        // Process the request.
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
    };

    const httpServer = http.createServer(handler);
    let httpsServer: https.Server | null = null;
    if (options.httpsKey && options.httpsCert) {
      const httpsOptions = {
        ca: options.httpsCA ? fs.readFileSync(options.httpsCA) : undefined,
        key: fs.readFileSync(options.httpsKey),
        cert: fs.readFileSync(options.httpsCert),
      };
      httpsServer = https.createServer(httpsOptions, handler);
    }

    // Copied from https://stackoverflow.com/a/42019773/16286019
    this.server = net.createServer((socket) => {
      socket.once("data", (buffer) => {
        // Pause the socket
        socket.pause();

        // Determine if this is an HTTP(s) request
        const byte = buffer[0];

        let server;
        // First byte of HTTPS is a 22.
        if (byte === 22) {
          server = httpsServer;
        } else if (32 < byte && byte < 127) {
          server = httpServer;
        } else {
          console.error(
            chalk.red(
              `Unexpected starting byte of incoming request: ${byte}. Dropping request.`,
            ),
          );
        }

        if (server) {
          // Push the buffer back onto the front of the data stream
          socket.unshift(buffer);

          // Emit the socket to the HTTP(s) server
          server.emit("connection", socket);
        }

        // As of NodeJS 10.x the socket must be
        // resumed asynchronously or the socket
        // connection hangs, potentially crashing
        // the process. Prior to NodeJS 10.x
        // the socket may be resumed synchronously.
        process.nextTick(() => socket.resume());
      });
    });
  }

  /**
   * Starts the server.
   */
  async start(port: number) {
    await new Promise((resolve) =>
      this.server.listen(port, resolve as () => void),
    );
  }

  /**
   * Stops the server.
   */
  async stop() {
    await new Promise((resolve) => this.server.close(resolve));
  }

  /**
   * Handles requests that are intended for Proxay itself.
   */
  private handleProxayApi(request: HttpRequest, res: http.ServerResponse) {
    // Sending a request to /__proxay will return a 200 (so tests can identify whether
    // their backend is Proxay or not).
    if (
      request.method.toLowerCase() === "get" &&
      request.path === "/__proxay"
    ) {
      res.end("Proxay!");
      return;
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
      return;
    }

    // If we got here, we don't know what to do. Return a 404.
    res.statusCode = 404;
    res.end(`Unhandled proxay request.\n\n${JSON.stringify(request)}`);
  }

  /**
   * Potentially rewrite the request before processing it.
   */
  private rewriteRequest(request: HttpRequest) {
    // Grab the `host` header of the request.
    const hostname = (request.headers.host || null) as string | null;

    // Potentially prevent 304 responses from being able to be generated.
    if (
      this.preventConditionalRequests &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      // Headers are always coming in as lowercase.
      delete request.headers["if-modified-since"];
      delete request.headers["if-none-match"];
    }

    // Potentially unframe a grpc-web+json request.
    if (
      request.method === "POST" &&
      request.headers["content-type"] === "application/grpc-web+json" &&
      (this.unframeGrpcWebJsonRequestsHostnames.includes("*") ||
        (hostname != null &&
          this.unframeGrpcWebJsonRequestsHostnames.includes(hostname)))
    ) {
      this.rewriteGrpcWebJsonRequest(request);
    }
  }

  /**
   * Rewrite a gRPC-web+json request to be unframed.
   */
  private rewriteGrpcWebJsonRequest(request: HttpRequest) {
    /**
     * From the gRPC specification (https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-HTTP2.md)
     *
     * The repeated sequence of Length-Prefixed-Message items is delivered in DATA frames:
     *   Length-Prefixed-Message → Compressed-Flag Message-Length Message
     *   Compressed-Flag → 0 / 1 # encoded as 1 byte unsigned integer
     *   Message-Length → {length of Message} # encoded as 4 byte unsigned integer (big endian)
     *   Message → *{binary octet}
     */
    const compressionFlag = request.body.readUInt8(0);
    const messageLength = request.body.readUInt32BE(1);
    if (compressionFlag !== 0) {
      console.error(
        `The gRPC-web compression flag was set to 1. Do not know how to handle compressed request paylods. Aborting gRPC-web+json rewrite.`,
      );
      return;
    }

    // Sanity check the content length.
    const rawContentLength = request.headers["content-length"] as
      | string
      | undefined;
    if (rawContentLength !== undefined) {
      const contentLength = parseInt(rawContentLength, 10);
      if (contentLength !== messageLength + 5) {
        console.log(
          `Unexpected content length. Header says "${rawContentLength}". gRPC payload length preamble says "${messageLength}".`,
        );
      }
    }

    // Rewrite the request to be unframed.
    request.headers["content-length"] = messageLength.toString();
    request.headers["content-type"] = "application/json";
    request.body = request.body.subarray(5);
  }

  private async fetchResponse(
    request: HttpRequest,
  ): Promise<TapeRecord | null> {
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
    request: HttpRequest,
  ): Promise<TapeRecord | null> {
    const record = findNextRecordToReplay(
      findRecordMatches(
        request,
        this.currentTapeRecords,
        this.rewriteBeforeDiffRules,
      ),
      this.replayedTapes,
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
            `Unexpected request ${request.method} ${request.path} has no matching record in tapes.`,
          ),
        );
      }
    }
    return record;
  }

  /**
   * Fetches the response directly from the proxied host and records it.
   */
  private async fetchRecordResponse(
    request: HttpRequest,
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
        body: request.body,
      },
      {
        loggingEnabled: this.loggingEnabled,
        timeout: this.timeout,
      },
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
    request: HttpRequest,
  ): Promise<TapeRecord | null> {
    let record = findNextRecordToReplay(
      findRecordMatches(
        request,
        this.currentTapeRecords,
        this.rewriteBeforeDiffRules,
      ),
      this.replayedTapes,
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
          body: request.body,
        },
        {
          loggingEnabled: this.loggingEnabled,
          timeout: this.timeout,
        },
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
    request: HttpRequest,
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
        body: request.body,
      },
      {
        loggingEnabled: this.loggingEnabled,
        timeout: this.timeout,
      },
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
            this.currentTape,
          );
          return true;
        } catch (e) {
          if (this.loggingEnabled) {
            console.warn(chalk.yellow((e as Error)?.message));
          }
          return false;
        }
      case "mimic":
        try {
          this.currentTapeRecords = this.persistence.loadTapeFromDisk(
            this.currentTape,
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
    this.loadTape(this.defaultTape);
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
    Object.keys(record.response.headers).forEach((headerName) => {
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
  req.on("data", (chunk) => {
    requestChunks.push(ensureBuffer(chunk));
  });
  return new Promise((resolve) => {
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
