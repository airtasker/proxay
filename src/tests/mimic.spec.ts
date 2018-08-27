import axios from "axios";
import fs from "fs";
import path from "path";
import { PROXAY_HOST } from "./config";
import { setupServers } from "./setup";
import {
  BINARY_PATH,
  BINARY_RESPONSE,
  SIMPLE_TEXT_PATH,
  SIMPLE_TEXT_RESPONSE,
  UTF8_PATH,
  UTF8_RESPONSE
} from "./testserver";

describe("Mimic", () => {
  beforeAll(() => {
    // Delete the tape before running tests.
    const tapePath = path.join(__dirname, "tapes", "mimic", "default.yml");
    if (fs.existsSync(tapePath)) {
      fs.unlinkSync(tapePath);
    }
  });

  const servers = setupServers("mimic");

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
      responseType: "arraybuffer"
    });
    expect(response.data).toEqual(BINARY_RESPONSE);
  });

  test("only records each request once", async () => {
    const requestCount = servers.backend.requestCount;
    // First call will be recorded.
    expect((await axios.get(`${PROXAY_HOST}/only-records`)).data).toBe(
      "/only-records"
    );
    // Second call will be replayed.
    expect((await axios.get(`${PROXAY_HOST}/only-records`)).data).toBe(
      "/only-records"
    );
    expect(servers.backend.requestCount).toBe(requestCount + 1); // Unchanged.
  });

  test("can pick any tape", async () => {
    await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
      tape: "new-tape"
    });
  });
});
