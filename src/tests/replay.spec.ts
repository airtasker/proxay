import axios from "axios";
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

describe("Replay", () => {
  setupServers("replay");

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

  test("can pick an existing tape", async () => {
    await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
      tape: "existing-tape"
    });
  });

  test("cannot pick a tape that does not exist", async () => {
    await expect(
      axios.post(`${PROXAY_HOST}/__proxay/tape`, {
        tape: "does-not-exist-tape"
      })
    ).rejects.toEqual(new Error("Request failed with status code 404"));
  });
});
