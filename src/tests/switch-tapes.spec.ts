import axios from "axios";
import { PROXAY_HOST } from "./config";
import { setupServers } from "./setup";

describe("Switching tapes", () => {
  const servers = setupServers("replay", "switching-tapes");

  it("can switch between record and replay mode", async () => {
    // Start in record mode.
    await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
      tape: "my-tape",
      mode: "record"
    });
    expect(servers.backend.requestCount).toBe(0);

    // First call should be recorded.
    expect((await axios.get(`${PROXAY_HOST}/recorded-path`)).data).toBe(
      "/recorded-path"
    );
    expect(servers.backend.requestCount).toBe(1);

    // Switch to replay mode, same tape.
    await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
      tape: "my-tape",
      mode: "replay"
    });

    // Second call should be replayed.
    expect((await axios.get(`${PROXAY_HOST}/recorded-path`)).data).toBe(
      "/recorded-path"
    );
    expect(servers.backend.requestCount).toBe(1);
  });
});
