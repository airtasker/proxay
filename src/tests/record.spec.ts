import axios from "axios";
import { existsSync } from "fs";
import { join } from "path";
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

describe("Record", () => {
  const servers = setupServers({
    mode: "record",
    defaultTapeName: "customDefault",
  });

  test("uses default tape name", async () => {
    await axios.get(`${PROXAY_HOST}${SIMPLE_TEXT_PATH}`);
    expect(existsSync(join(servers.tapeDir, "customDefault.yml"))).toBe(true);
  });

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

  test("can pick any tape", async () => {
    await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
      tape: "new-tape",
    });
  });
});
