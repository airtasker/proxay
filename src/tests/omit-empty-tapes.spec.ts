import axios from "axios";
import { existsSync } from "fs";
import { join } from "path";
import { PROXAY_HOST } from "./config";
import { setupServers } from "./setup";
import { SIMPLE_TEXT_PATH, SIMPLE_TEXT_RESPONSE } from "./testserver";

describe("omitEmptyTapes — record mode", () => {
  const servers = setupServers({ mode: "record", omitEmptyTapes: true });

  test("does not create a tape file when no requests are made", async () => {
    await axios.post(`${PROXAY_HOST}/__proxay/tape`, { tape: "empty-tape" });
    expect(existsSync(join(servers.tapeDir, "empty-tape.yml"))).toBe(false);
  });

  test("creates a tape file once a request is made", async () => {
    await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
      tape: "non-empty-tape",
    });
    await axios.get(`${PROXAY_HOST}${SIMPLE_TEXT_PATH}`);
    expect(existsSync(join(servers.tapeDir, "non-empty-tape.yml"))).toBe(true);
  });
});

describe("omitEmptyTapes — record mode (default behaviour preserved)", () => {
  const servers = setupServers({ mode: "record" });

  test("creates an empty tape file when no requests are made", async () => {
    await axios.post(`${PROXAY_HOST}/__proxay/tape`, { tape: "empty-tape" });
    expect(existsSync(join(servers.tapeDir, "empty-tape.yml"))).toBe(true);
  });
});

describe("omitEmptyTapes — mimic mode", () => {
  const servers = setupServers({ mode: "mimic", omitEmptyTapes: true });

  test("does not create a tape file when no requests are made", async () => {
    await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
      tape: "empty-mimic-tape",
    });
    expect(existsSync(join(servers.tapeDir, "empty-mimic-tape.yml"))).toBe(
      false,
    );
  });
});

describe("omitEmptyTapes — replay mode", () => {
  setupServers({ mode: "replay", omitEmptyTapes: true });

  test("switching to a non-existent tape succeeds (returns 200)", async () => {
    const response = await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
      tape: "does-not-exist-tape",
    });
    expect(response.status).toBe(200);
  });

  test("logs an informational message instead of a warning when tape is missing", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(jest.fn());
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(jest.fn());
    try {
      await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
        tape: "does-not-exist-tape",
      });
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("treating as empty (--omit-empty-tapes)"),
      );
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("No tape found with name"),
      );
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  test("requests against an empty (missing) tape return no response (500)", async () => {
    await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
      tape: "does-not-exist-tape",
    });
    await expect(
      axios.get(`${PROXAY_HOST}${SIMPLE_TEXT_PATH}`),
    ).rejects.toEqual(new Error("Request failed with status code 500"));
  });
});

describe("omitEmptyTapes — replay mode (default behaviour preserved)", () => {
  setupServers({ mode: "replay" });

  test("switching to a non-existent tape still returns 404 without the flag", async () => {
    await expect(
      axios.post(`${PROXAY_HOST}/__proxay/tape`, {
        tape: "does-not-exist-tape",
      }),
    ).rejects.toEqual(new Error("Request failed with status code 404"));
  });
});

describe("omitEmptyTapes — replay mode with existing tape", () => {
  setupServers({
    mode: "replay",
    tapeDirName: "replay",
    omitEmptyTapes: true,
  });

  test("still replays from an existing tape correctly", async () => {
    const response = await axios.get(`${PROXAY_HOST}${SIMPLE_TEXT_PATH}`);
    expect(response.data).toBe(SIMPLE_TEXT_RESPONSE);
  });
});
