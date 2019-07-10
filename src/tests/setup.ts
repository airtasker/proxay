import path from "path";
import { Mode } from "../modes";
import { RecordReplayServer } from "../server";
import { PROXAY_PORT, TEST_SERVER_HOST, TEST_SERVER_PORT } from "./config";
import { TestServer } from "./testserver";

export function setupServers({
  mode,
  tapeDirName = mode,
  defaultTapeName
}: {
  mode: Mode;
  tapeDirName?: string;
  defaultTapeName?: string;
}) {
  const servers = {} as {
    backend: TestServer;
    proxy: RecordReplayServer;
  };

  beforeEach(async done => {
    servers.backend = new TestServer();
    servers.proxy = new RecordReplayServer({
      initialMode: mode,
      tapeDir: path.join(__dirname, "tapes", tapeDirName),
      defaultTapeName,
      host: TEST_SERVER_HOST,
      timeout: 100
    });
    await Promise.all([
      servers.proxy.start(PROXAY_PORT),
      servers.backend.start(TEST_SERVER_PORT)
    ]);
    done();
  });

  afterEach(async done => {
    await Promise.all([servers.backend.stop(), servers.proxy.stop()]);
    done();
  });

  return servers;
}
