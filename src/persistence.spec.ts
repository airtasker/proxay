import brotli from "brotli";
import { gzipSync } from "zlib";
import { persistTape, reviveTape, redactRequestHeaders } from "./persistence";

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
  brotli.compress(Buffer.from(UTF8_REQUEST, "utf8"))!
);
const UTF8_RESPONSE_BROTLI = Buffer.from(
  brotli.compress(Buffer.from(UTF8_RESPONSE, "utf8"))!
);
const BINARY_REQUEST_BROTLI = Buffer.from(brotli.compress(BINARY_REQUEST)!);
const BINARY_RESPONSE_BROTLI = Buffer.from(brotli.compress(BINARY_RESPONSE)!);

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
      })
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
      })
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
      })
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
      })
    ).toEqual({
      request: {
        method: "GET",
        path: "/path",
        headers: {
          "content-encoding": "br",
        },
        body: {
          encoding: "base64",
          data: "GxcAAI6UrMm1WkAERl0HoDFuCn3CIekc",
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
          data: "GxcAAI6UrPmFmgFmOV+HoM3+C33CIe4U",
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
      })
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
      })
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
      })
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
      })
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
      })
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
      })
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
