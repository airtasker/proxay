import express, { Express } from "express";
import http from "http";

export const SIMPLE_TEXT_PATH = "/simpletext";
export const SIMPLE_TEXT_RESPONSE = "Plain text!";

export const UTF8_PATH = "/utf8";
export const UTF8_RESPONSE = "😊 Hello 💩";

export const BINARY_PATH = "/binary";
export const BINARY_RESPONSE = Buffer.from([
  // These are not valid UTF-8 characters, on purpose.
  12,
  48,
  249,
  104,
  255,
  33,
  203,
  179
]);

/**
 * A test server used as a fake backend.
 */
export class TestServer {
  private app: Express;
  private server?: http.Server;

  requestCount = 0;

  constructor() {
    this.app = express();
    this.app.use((_req, _res, next) => {
      this.requestCount += 1;
      next();
    });
    this.app.get(SIMPLE_TEXT_PATH, (_req, res) => {
      res.send(SIMPLE_TEXT_RESPONSE);
    });
    this.app.get(UTF8_PATH, (_req, res) => {
      res.send(UTF8_RESPONSE);
    });
    this.app.get(BINARY_PATH, (_req, res) => {
      res.send(BINARY_RESPONSE);
    });
    this.app.get("/*", (req, res) => {
      res.send(req.path);
    });
  }

  /**
   * Starts the server.
   */
  async start(port: number) {
    await new Promise(
      resolve => (this.server = this.app.listen(port, resolve))
    );
  }

  /**
   * Stops the server.
   */
  async stop() {
    await new Promise((resolve, reject) => {
      if (!this.server) {
        return reject();
      }
      this.server.close(resolve);
    });
  }
}
