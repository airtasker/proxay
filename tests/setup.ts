import path from "path";
import { Mode, RecordReplayServer } from "../src/server";
import { PROXAY_PORT, TEST_SERVER_HOST, TEST_SERVER_PORT } from "./config";
import { TestServer } from "./testserver";

export function setupServers(mode: Mode) {
  let backendServer: TestServer;
  let proxyServer: RecordReplayServer;

  beforeAll(async done => {
    backendServer = new TestServer();
    proxyServer = new RecordReplayServer({
      mode,
      tapeDir: path.join(__dirname, "tapes", mode),
      host: TEST_SERVER_HOST,
      enableLogging: true
    });
    await Promise.all([
      proxyServer.start(PROXAY_PORT),
      backendServer.start(TEST_SERVER_PORT)
    ]);
    done();
  });

  afterAll(async done => {
    await Promise.all([backendServer.stop(), proxyServer.stop()]);
    done();
  });
}
