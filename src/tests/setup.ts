import path from "path";
import { rimrafSync } from "rimraf";
import { Mode } from "../modes";
import { RecordReplayServer } from "../server";
import { PROXAY_PORT, TEST_SERVER_HOST, TEST_SERVER_PORT } from "./config";
import { TestServer } from "./testserver";

export function setupServers({
  mode,
  tapeDirName = mode,
  defaultTapeName = "default",
  exactRequestMatching,
  sendProxyPort = false,
}: {
  mode: Mode;
  tapeDirName?: string;
  defaultTapeName?: string;
  exactRequestMatching?: boolean;
  sendProxyPort?: boolean;
}) {
  const tapeDir = path.join(__dirname, "tapes", tapeDirName);
  const servers = { tapeDir } as {
    backend: TestServer;
    proxy: RecordReplayServer;
    tapeDir: string;
  };

  beforeEach(() => {
    if (mode !== "replay") {
      rimrafSync(tapeDir);
    }
  });

  beforeAll(async () => {
    servers.backend = new TestServer();
    servers.proxy = new RecordReplayServer({
      initialMode: mode,
      tapeDir,
      defaultTapeName,
      host: TEST_SERVER_HOST,
      timeout: 100,
      enableLogging: true,
      exactRequestMatching,
      proxyPortToSend: sendProxyPort ? PROXAY_PORT : undefined,
    });
    await Promise.all([
      servers.proxy.start(PROXAY_PORT),
      servers.backend.start(TEST_SERVER_PORT),
    ]);
  });

  afterAll(async () => {
    await Promise.all([servers.backend.stop(), servers.proxy.stop()]);

    // Sleep briefly to allow the OS to free up the port so that we can re-bind it again in the
    // next test.
    await new Promise((r) => setTimeout(r, 1000));
  }, 10000);

  return servers;
}
