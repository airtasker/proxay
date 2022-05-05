import axios from "axios";
import { PROXAY_HOST } from "./config";
import { setupServers } from "./setup";
import {
  BINARY_PATH,
  BINARY_RESPONSE,
  SIMPLE_TEXT_PATH,
  SIMPLE_TEXT_RESPONSE,
  UTF8_PATH,
  UTF8_RESPONSE,
} from "./testserver";

describe("Replay", () => {
  const servers = setupServers({ mode: "replay" });

  test("response: simple text", async () => {
    const response = await axios.get(`${PROXAY_HOST}${SIMPLE_TEXT_PATH}`);
    expect(response.data).toBe(SIMPLE_TEXT_RESPONSE);
  });

  test("response: utf-8", async () => {
    const response = await axios.get(`${PROXAY_HOST}${UTF8_PATH}`);
    expect(response.data).toBe(UTF8_RESPONSE);
  });

  test("response: binary", async () => {
    const response = await axios.get(`${PROXAY_HOST}${BINARY_PATH}`, {
      responseType: "arraybuffer",
    });
    expect(response.data).toEqual(BINARY_RESPONSE);
  });

  test("can pick an existing tape", async () => {
    await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
      tape: "existing-tape",
    });
  });

  test("makes the original request if no tape is found", async () => {
    const requestCount = servers.backend.requestCount;

    // Neither calls will be recorded.
    expect((await axios.get(`${PROXAY_HOST}/only-records`)).data).toBe(
        "/only-records"
    );
    expect((await axios.get(`${PROXAY_HOST}/only-records`)).data).toBe(
        "/only-records"
    );
    expect(servers.backend.requestCount).toBe(requestCount + 2); // Unchanged.
  });

});
