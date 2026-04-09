import { brotliCompressSync, gzipSync } from "zlib";
import fs from "fs-extra";
import path from "path";
import os from "os";
import {
  Persistence,
  persistTape,
  reviveTape,
  redactRequestHeaders,
  redactRecordBodyFields,
} from "./persistence";

// Note the repetition. This is necessary otherwise Brotli compression
// will be null.
const UTF8_REQUEST = "😊 Hello 😊 Hello 😊 Hello";
const UTF8_RESPONSE = "Hello 💩 Hello 💩 Hello 💩";

const BINARY_REQUEST = Buffer.from([
  // These are not valid UTF-8 characters, on purpose.
  2, 48, 34, 104, 155, 1, 234, 140, 2, 48, 34, 104, 155, 1, 234, 140, 2, 48, 34,
  104, 155, 1, 234, 140,
]);

const BINARY_RESPONSE = Buffer.from([
  // These are not valid UTF-8 characters, on purpose.
  12, 48, 249, 104, 255, 33, 203, 179, 12, 48, 249, 104, 255, 33, 203, 179, 12,
  48, 249, 104, 255, 33, 203, 179,
]);

const UTF8_REQUEST_BROTLI = Buffer.from(
  brotliCompressSync(Buffer.from(UTF8_REQUEST, "utf8"))!,
);
const UTF8_RESPONSE_BROTLI = Buffer.from(
  brotliCompressSync(Buffer.from(UTF8_RESPONSE, "utf8"))!,
);
const BINARY_REQUEST_BROTLI = Buffer.from(brotliCompressSync(BINARY_REQUEST)!);
const BINARY_RESPONSE_BROTLI = Buffer.from(
  brotliCompressSync(BINARY_RESPONSE)!,
);

const UTF8_REQUEST_GZIP = gzipSync(Buffer.from(UTF8_REQUEST, "utf8"));
const UTF8_RESPONSE_GZIP = gzipSync(Buffer.from(UTF8_RESPONSE, "utf8"));
const BINARY_REQUEST_GZIP = gzipSync(BINARY_REQUEST);
const BINARY_RESPONSE_GZIP = gzipSync(BINARY_RESPONSE);

describe("Redaction", () => {
  it("redacts specified headers", () => {
    const sensitiveData = "some sensitive data";
    const hostname = "some-host";
    const record = {
      request: {
        method: "GET",
        path: "/path",
        headers: { host: hostname, "x-auth-token": sensitiveData },
        body: Buffer.from(UTF8_REQUEST, "utf8"),
      },
      response: {
        status: {
          code: 200,
        },
        headers: {},
        body: Buffer.from(UTF8_RESPONSE, "utf8"),
      },
    };
    redactRequestHeaders(record, ["x-auth-token"]);
    expect(record.request.headers["x-auth-token"]).toEqual("XXXX");
    expect(record.request.headers.host).toEqual(hostname);
  });
});

describe("Persistence", () => {
  it("persists utf-8", () => {
    expect(
      persistTape({
        request: {
          method: "GET",
          path: "/path",
          headers: {},
          body: Buffer.from(UTF8_REQUEST, "utf8"),
        },
        response: {
          status: {
            code: 200,
          },
          headers: {},
          body: Buffer.from(UTF8_RESPONSE, "utf8"),
        },
      }),
    ).toEqual({
      request: {
        method: "GET",
        path: "/path",
        headers: {},
        body: {
          encoding: "utf8",
          data: UTF8_REQUEST,
          compression: "none",
        },
      },
      response: {
        status: {
          code: 200,
        },
        headers: {},
        body: {
          encoding: "utf8",
          data: UTF8_RESPONSE,
          compression: "none",
        },
      },
    });
  });

  it("persists binary", () => {
    expect(
      persistTape({
        request: {
          method: "GET",
          path: "/path",
          headers: {},
          body: BINARY_REQUEST,
        },
        response: {
          status: {
            code: 200,
          },
          headers: {},
          body: BINARY_RESPONSE,
        },
      }),
    ).toEqual({
      request: {
        method: "GET",
        path: "/path",
        headers: {},
        body: {
          encoding: "base64",
          data: "AjAiaJsB6owCMCJomwHqjAIwImibAeqM",
        },
      },
      response: {
        status: {
          code: 200,
        },
        headers: {},
        body: {
          encoding: "base64",
          data: "DDD5aP8hy7MMMPlo/yHLswww+Wj/Icuz",
        },
      },
    });
  });

  it("persists utf-8 encoded with brotli decompressed", () => {
    expect(
      persistTape({
        request: {
          method: "GET",
          path: "/path",
          headers: {
            "content-encoding": "br",
          },
          body: UTF8_REQUEST_BROTLI,
        },
        response: {
          status: {
            code: 200,
          },
          headers: {
            "content-encoding": "br",
          },
          body: UTF8_RESPONSE_BROTLI,
        },
      }),
    ).toEqual({
      request: {
        method: "GET",
        path: "/path",
        headers: {
          "content-encoding": "br",
        },
        body: {
          encoding: "utf8",
          data: UTF8_REQUEST,
          compression: "br",
        },
      },
      response: {
        status: {
          code: 200,
        },
        headers: {
          "content-encoding": "br",
        },
        body: {
          encoding: "utf8",
          data: UTF8_RESPONSE,
          compression: "br",
        },
      },
    });
  });

  it("persists binary encoded with brotli still compressed", () => {
    expect(
      persistTape({
        request: {
          method: "GET",
          path: "/path",
          headers: {
            "content-encoding": "br",
          },
          body: BINARY_REQUEST_BROTLI,
        },
        response: {
          status: {
            code: 200,
          },
          headers: {
            "content-encoding": "br",
          },
          body: BINARY_RESPONSE_BROTLI,
        },
      }),
    ).toEqual({
      request: {
        method: "GET",
        path: "/path",
        headers: {
          "content-encoding": "br",
        },
        body: {
          encoding: "base64",
          data: "GxcA+I+UrMm1WkAERl0HoDFuCn3CAZLOAQ==",
        },
      },
      response: {
        status: {
          code: 200,
        },
        headers: {
          "content-encoding": "br",
        },
        body: {
          encoding: "base64",
          data: "GxcA+I+UrPmFmgFmOV+HoM3+C33CAeJOAQ==",
        },
      },
    });
  });

  it("persists utf-8 encoded with gzip decompressed", () => {
    expect(
      persistTape({
        request: {
          method: "GET",
          path: "/path",
          headers: {
            "content-encoding": "gzip",
          },
          body: UTF8_REQUEST_GZIP,
        },
        response: {
          status: {
            code: 200,
          },
          headers: {
            "content-encoding": "gzip",
          },
          body: UTF8_RESPONSE_GZIP,
        },
      }),
    ).toEqual({
      request: {
        method: "GET",
        path: "/path",
        headers: {
          "content-encoding": "gzip",
        },
        body: {
          encoding: "utf8",
          data: UTF8_REQUEST,
          compression: "gzip",
        },
      },
      response: {
        status: {
          code: 200,
        },
        headers: {
          "content-encoding": "gzip",
        },
        body: {
          encoding: "utf8",
          data: UTF8_RESPONSE,
          compression: "gzip",
        },
      },
    });
  });

  it("persists binary encoded with gzip still compressed", () => {
    expect(
      persistTape({
        request: {
          method: "GET",
          path: "/path",
          headers: {
            "content-encoding": "gzip",
          },
          body: BINARY_REQUEST_GZIP,
        },
        response: {
          status: {
            code: 200,
          },
          headers: {
            "content-encoding": "gzip",
          },
          body: BINARY_RESPONSE_GZIP,
        },
      }),
    ).toEqual({
      request: {
        method: "GET",
        path: "/path",
        headers: {
          "content-encoding": "gzip",
        },
        body: {
          encoding: "base64",
          data: "H4sIAAAAAAAAA2MyUMqYzfiqhwmNBgCNSozuGAAAAA==",
        },
      },
      response: {
        status: {
          code: 200,
        },
        headers: {
          "content-encoding": "gzip",
        },
        body: {
          encoding: "base64",
          data: "H4sIAAAAAAAAA+Mx+JnxX/H0Zh40GgB5ykTGGAAAAA==",
        },
      },
    });
  });

  it("reads utf-8", () => {
    expect(
      reviveTape({
        request: {
          method: "GET",
          path: "/path",
          headers: {},
          body: {
            encoding: "utf8",
            data: UTF8_REQUEST,
            compression: "none",
          },
        },
        response: {
          status: {
            code: 200,
          },
          headers: {},
          body: {
            encoding: "utf8",
            data: UTF8_RESPONSE,
            compression: "none",
          },
        },
      }),
    ).toEqual({
      request: {
        method: "GET",
        path: "/path",
        headers: {},
        body: Buffer.from(UTF8_REQUEST, "utf8"),
      },
      response: {
        status: {
          code: 200,
        },
        headers: {},
        body: Buffer.from(UTF8_RESPONSE, "utf8"),
      },
    });
  });

  it("reads binary from base64", () => {
    expect(
      reviveTape({
        request: {
          method: "GET",
          path: "/path",
          headers: {},
          body: {
            encoding: "base64",
            data: "AjAiaJsB6owCMCJomwHqjAIwImibAeqM",
          },
        },
        response: {
          status: {
            code: 200,
          },
          headers: {},
          body: {
            encoding: "base64",
            data: "DDD5aP8hy7MMMPlo/yHLswww+Wj/Icuz",
          },
        },
      }),
    ).toEqual({
      request: {
        method: "GET",
        path: "/path",
        headers: {},
        body: BINARY_REQUEST,
      },
      response: {
        status: {
          code: 200,
        },
        headers: {},
        body: BINARY_RESPONSE,
      },
    });
  });

  it("re-encodes brotli from utf-8", () => {
    expect(
      reviveTape({
        request: {
          method: "GET",
          path: "/path",
          headers: {},
          body: {
            encoding: "utf8",
            data: UTF8_REQUEST,
            compression: "br",
          },
        },
        response: {
          status: {
            code: 200,
          },
          headers: {},
          body: {
            encoding: "utf8",
            data: UTF8_RESPONSE,
            compression: "br",
          },
        },
      }),
    ).toEqual({
      request: {
        method: "GET",
        path: "/path",
        headers: {},
        body: UTF8_REQUEST_BROTLI,
      },
      response: {
        status: {
          code: 200,
        },
        headers: {},
        body: UTF8_RESPONSE_BROTLI,
      },
    });
  });

  it("re-encodes gzip from utf-8", () => {
    expect(
      reviveTape({
        request: {
          method: "GET",
          path: "/path",
          headers: {},
          body: {
            encoding: "utf8",
            data: UTF8_REQUEST,
            compression: "gzip",
          },
        },
        response: {
          status: {
            code: 200,
          },
          headers: {},
          body: {
            encoding: "utf8",
            data: UTF8_RESPONSE,
            compression: "gzip",
          },
        },
      }),
    ).toEqual({
      request: {
        method: "GET",
        path: "/path",
        headers: {},
        body: UTF8_REQUEST_GZIP,
      },
      response: {
        status: {
          code: 200,
        },
        headers: {},
        body: UTF8_RESPONSE_GZIP,
      },
    });
  });
});

describe("Tape append and load round-trip", () => {
  let tmpDir: string;
  let persistence: Persistence;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "proxay-test-"));
    persistence = new Persistence(tmpDir, [], []);
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it("appends records incrementally and loads them back", async () => {
    const records = [
      {
        request: {
          method: "GET",
          path: "/first",
          headers: {},
          body: Buffer.from("request1", "utf8"),
        },
        response: {
          status: { code: 200 },
          headers: {},
          body: Buffer.from("response1", "utf8"),
        },
      },
      {
        request: {
          method: "POST",
          path: "/second",
          headers: { "content-type": "application/json" },
          body: Buffer.from('{"key":"value"}', "utf8"),
        },
        response: {
          status: { code: 201 },
          headers: {},
          body: Buffer.from('{"id":1}', "utf8"),
        },
      },
      {
        request: {
          method: "GET",
          path: "/third",
          headers: {},
          body: BINARY_REQUEST,
        },
        response: {
          status: { code: 200 },
          headers: {},
          body: BINARY_RESPONSE,
        },
      },
    ];

    await persistence.initTapeOnDisk("test");
    for (const record of records) {
      await persistence.appendRecordToDisk("test", record);
    }

    const loaded = await persistence.loadTapeFromDisk("test");
    expect(loaded).toHaveLength(3);

    // UTF-8 records
    expect(loaded[0].request.method).toEqual("GET");
    expect(loaded[0].request.path).toEqual("/first");
    expect(loaded[0].request.body.toString("utf8")).toEqual("request1");
    expect(loaded[0].response.status.code).toEqual(200);
    expect(loaded[0].response.body.toString("utf8")).toEqual("response1");

    expect(loaded[1].request.method).toEqual("POST");
    expect(loaded[1].request.path).toEqual("/second");
    expect(loaded[1].response.status.code).toEqual(201);

    // Binary record (base64 encoded, bodies should match original)
    expect(loaded[2].request.method).toEqual("GET");
    expect(loaded[2].request.path).toEqual("/third");
    expect(Buffer.compare(loaded[2].request.body, BINARY_REQUEST)).toEqual(0);
    expect(Buffer.compare(loaded[2].response.body, BINARY_RESPONSE)).toEqual(0);
  });

  it("produces the same result as saveTapeToDisk", async () => {
    const record = {
      request: {
        method: "GET",
        path: "/path",
        headers: {},
        body: Buffer.from(UTF8_REQUEST, "utf8"),
      },
      response: {
        status: { code: 200 },
        headers: {},
        body: Buffer.from(UTF8_RESPONSE, "utf8"),
      },
    };

    // Write using append
    await persistence.initTapeOnDisk("append");
    await persistence.appendRecordToDisk("append", record);
    const appendLoaded = await persistence.loadTapeFromDisk("append");

    // Write using full save
    await persistence.saveTapeToDisk("full", [record]);
    const fullLoaded = await persistence.loadTapeFromDisk("full");

    expect(appendLoaded).toEqual(fullLoaded);
  });

  it("loads empty tape after init", async () => {
    await persistence.initTapeOnDisk("empty");
    const loaded = await persistence.loadTapeFromDisk("empty");
    expect(loaded).toHaveLength(0);
  });
});

describe("Body Field Redaction", () => {
  it("redacts simple JSON fields in request body", () => {
    const requestJson = JSON.stringify({
      email: "user@example.com",
      password: "secret123",
      username: "testuser",
    });

    const record = {
      request: {
        method: "POST",
        path: "/login",
        headers: {},
        body: Buffer.from(requestJson, "utf8"),
      },
      response: {
        status: { code: 200 },
        headers: {},
        body: Buffer.from("{}", "utf8"),
      },
    };

    redactRecordBodyFields(record, ["password"]);

    const redactedRequest = JSON.parse(record.request.body.toString("utf8"));
    expect(redactedRequest.email).toEqual("user@example.com");
    expect(redactedRequest.password).toEqual("XXXX");
    expect(redactedRequest.username).toEqual("testuser");
  });

  it("redacts fields case-insensitively", () => {
    const requestJson = JSON.stringify({
      Password: "secret123",
      ACCESS_TOKEN: "token456",
    });

    const record = {
      request: {
        method: "POST",
        path: "/login",
        headers: {},
        body: Buffer.from(requestJson, "utf8"),
      },
      response: {
        status: { code: 200 },
        headers: {},
        body: Buffer.from("{}", "utf8"),
      },
    };

    redactRecordBodyFields(record, ["password", "access_token"]);

    const redactedRequest = JSON.parse(record.request.body.toString("utf8"));
    expect(redactedRequest.Password).toEqual("XXXX");
    expect(redactedRequest.ACCESS_TOKEN).toEqual("XXXX");
  });

  it("redacts nested JSON fields", () => {
    const requestJson = JSON.stringify({
      user: {
        email: "user@example.com",
        credentials: {
          password: "secret123",
          api_key: "key789",
        },
      },
    });

    const record = {
      request: {
        method: "POST",
        path: "/api/user",
        headers: {},
        body: Buffer.from(requestJson, "utf8"),
      },
      response: {
        status: { code: 200 },
        headers: {},
        body: Buffer.from("{}", "utf8"),
      },
    };

    redactRecordBodyFields(record, ["password", "api_key"]);

    const redactedRequest = JSON.parse(record.request.body.toString("utf8"));
    expect(redactedRequest.user.email).toEqual("user@example.com");
    expect(redactedRequest.user.credentials.password).toEqual("XXXX");
    expect(redactedRequest.user.credentials.api_key).toEqual("XXXX");
  });

  it("redacts fields in arrays", () => {
    const requestJson = JSON.stringify({
      users: [
        { username: "user1", password: "pass1" },
        { username: "user2", password: "pass2" },
      ],
    });

    const record = {
      request: {
        method: "POST",
        path: "/api/users",
        headers: {},
        body: Buffer.from(requestJson, "utf8"),
      },
      response: {
        status: { code: 200 },
        headers: {},
        body: Buffer.from("{}", "utf8"),
      },
    };

    redactRecordBodyFields(record, ["password"]);

    const redactedRequest = JSON.parse(record.request.body.toString("utf8"));
    expect(redactedRequest.users[0].username).toEqual("user1");
    expect(redactedRequest.users[0].password).toEqual("XXXX");
    expect(redactedRequest.users[1].username).toEqual("user2");
    expect(redactedRequest.users[1].password).toEqual("XXXX");
  });

  it("redacts fields in response body", () => {
    const responseJson = JSON.stringify({
      user: {
        id: 123,
        access_token: "token123",
        refresh_token: "refresh456",
      },
    });

    const record = {
      request: {
        method: "POST",
        path: "/login",
        headers: {},
        body: Buffer.from("{}", "utf8"),
      },
      response: {
        status: { code: 200 },
        headers: {},
        body: Buffer.from(responseJson, "utf8"),
      },
    };

    redactRecordBodyFields(record, ["access_token", "refresh_token"]);

    const redactedResponse = JSON.parse(record.response.body.toString("utf8"));
    expect(redactedResponse.user.id).toEqual(123);
    expect(redactedResponse.user.access_token).toEqual("XXXX");
    expect(redactedResponse.user.refresh_token).toEqual("XXXX");
  });

  it("does not modify non-JSON bodies", () => {
    const plainText = "This is plain text, not JSON";

    const record = {
      request: {
        method: "POST",
        path: "/text",
        headers: {},
        body: Buffer.from(plainText, "utf8"),
      },
      response: {
        status: { code: 200 },
        headers: {},
        body: Buffer.from("OK", "utf8"),
      },
    };

    redactRecordBodyFields(record, ["password"]);

    expect(record.request.body.toString("utf8")).toEqual(plainText);
    expect(record.response.body.toString("utf8")).toEqual("OK");
  });

  it("does not modify binary bodies", () => {
    const record = {
      request: {
        method: "POST",
        path: "/binary",
        headers: {},
        body: BINARY_REQUEST,
      },
      response: {
        status: { code: 200 },
        headers: {},
        body: BINARY_RESPONSE,
      },
    };

    const originalRequest = Buffer.from(BINARY_REQUEST);
    const originalResponse = Buffer.from(BINARY_RESPONSE);

    redactRecordBodyFields(record, ["password"]);

    expect(record.request.body).toEqual(originalRequest);
    expect(record.response.body).toEqual(originalResponse);
  });

  it("handles empty body gracefully", () => {
    const record = {
      request: {
        method: "GET",
        path: "/empty",
        headers: {},
        body: Buffer.from("", "utf8"),
      },
      response: {
        status: { code: 200 },
        headers: {},
        body: Buffer.from("", "utf8"),
      },
    };

    redactRecordBodyFields(record, ["password"]);

    expect(record.request.body.toString("utf8")).toEqual("");
    expect(record.response.body.toString("utf8")).toEqual("");
  });

  it("does nothing when no fields to redact", () => {
    const requestJson = JSON.stringify({
      email: "user@example.com",
      password: "secret123",
    });

    const record = {
      request: {
        method: "POST",
        path: "/login",
        headers: {},
        body: Buffer.from(requestJson, "utf8"),
      },
      response: {
        status: { code: 200 },
        headers: {},
        body: Buffer.from("{}", "utf8"),
      },
    };

    redactRecordBodyFields(record, []);

    const redactedRequest = JSON.parse(record.request.body.toString("utf8"));
    expect(redactedRequest.email).toEqual("user@example.com");
    expect(redactedRequest.password).toEqual("secret123");
  });
});
