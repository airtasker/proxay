import path from "path";
import { main } from "../cli";

const MISSING_TAPES_DIR = path.join(__dirname, "tapes", "does-not-exist");

describe("CLI — --omit-empty-tapes with missing tapes directory", () => {
  test("logs an informational message and starts without panicking", async () => {
    const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const logSpy = jest.spyOn(console, "log").mockImplementation(jest.fn());
    try {
      const server = await main([
        "node",
        "proxay",
        "--mode",
        "replay",
        "--tapes-dir",
        MISSING_TAPES_DIR,
        "--port",
        "3097",
        "--omit-empty-tapes",
      ]);
      await server.stop();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "treating all tapes as empty (--omit-empty-tapes)",
        ),
      );
      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
      logSpy.mockRestore();
    }
  });

  test("panics without the flag", async () => {
    const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const errorSpy = jest.spyOn(console, "error").mockImplementation(jest.fn());
    try {
      await expect(
        main([
          "node",
          "proxay",
          "--mode",
          "replay",
          "--tapes-dir",
          MISSING_TAPES_DIR,
          "--port",
          "3098",
        ]),
      ).rejects.toThrow("process.exit called");

      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
