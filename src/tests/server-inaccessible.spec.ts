import axios from "axios";
import { PROXAY_HOST } from "./config";
import { setupServers } from "./setup";

describe("Server inaccessible", () => {
  const servers = setupServers({
    mode: "passthrough",
    tapeDirName: "switching-tapes"
  });

  it("doesn't crash when server is inaccessible", async () => {
    await servers.backend.stop();
    try {
      await axios.get(`${PROXAY_HOST}/test`);
    } catch (e) {
      // Error is expected. We just don't want a crash.
    }
  });
});
