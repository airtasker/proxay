import axios from "axios";
import { PROXAY_HOST, TEST_SERVER_PORT } from "./config";
import { setupServers } from "./setup";
import {
  BINARY_PATH,
  BINARY_RESPONSE,
  GRPC_WEB_JSON_PATH,
  SIMPLE_TEXT_PATH,
  SIMPLE_TEXT_RESPONSE,
  UTF8_PATH,
  UTF8_RESPONSE,
} from "./testserver";

describe("Passthrough", () => {
  setupServers({ mode: "passthrough" });

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

describe("Passthrough with grpc-web+json unframing with explicit whitelisted hostname", () => {
  setupServers({
    mode: "passthrough",
    unframeGrpcWebJsonRequestsHostnames: [`localhost:${TEST_SERVER_PORT}`],
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

  test("unframes a grpc-web+json request", async () => {
    const requestBody = Buffer.from([
      0, 0, 0, 0, 31, 123, 34, 101, 109, 97, 105, 108, 34, 58, 34, 102, 111,
      111, 46, 98, 97, 114, 64, 101, 120, 97, 109, 112, 108, 101, 46, 99, 111,
      109, 34, 125,
    ]);
    const response = await axios.post(
      `${PROXAY_HOST}${GRPC_WEB_JSON_PATH}`,
      requestBody,
      {
        headers: {
          "content-type": "application/grpc-web+json",
          host: `localhost:${TEST_SERVER_PORT}`,
        },
      },
    );
    expect(response.headers["content-type"]).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.data).toEqual({ email: "foo.bar@example.com" });
  });
});

describe("Passthrough with grpc-web+json unframing with wildcard whitelisted hostname", () => {
  setupServers({
    mode: "passthrough",
    unframeGrpcWebJsonRequestsHostnames: ["*"],
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

  test("unframes a grpc-web+json request", async () => {
    const requestBody = Buffer.from([
      0, 0, 0, 0, 31, 123, 34, 101, 109, 97, 105, 108, 34, 58, 34, 102, 111,
      111, 46, 98, 97, 114, 64, 101, 120, 97, 109, 112, 108, 101, 46, 99, 111,
      109, 34, 125,
    ]);
    const response = await axios.post(
      `${PROXAY_HOST}${GRPC_WEB_JSON_PATH}`,
      requestBody,
      {
        headers: {
          "content-type": "application/grpc-web+json",
          host: `localhost:${TEST_SERVER_PORT}`,
        },
      },
    );
    expect(response.headers["content-type"]).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.data).toEqual({ email: "foo.bar@example.com" });
  });
});
