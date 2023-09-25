import fs from "fs";
import path from "path";
import { computeSimilarity } from "./similarity";

const DUMMY_RESPONSE = {
  headers: {},
  body: Buffer.from([]),
  status: {
    code: 200,
  },
};

describe("similarity", () => {
  it("detects exact matches", () => {
    expect(
      computeSimilarity(
        "POST",
        "/test",
        {},
        Buffer.from([]),
        {
          request: {
            method: "POST",
            path: "/test",
            headers: {},
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        []
      )
    ).toBe(0);
  });

  it("excludes mismatching methods", () => {
    expect(
      computeSimilarity(
        "GET",
        "/test",
        {},
        Buffer.from([]),
        {
          request: {
            method: "POST",
            path: "/test",
            headers: {},
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        []
      )
    ).toBe(Infinity);
  });

  it("excludes mismatching paths", () => {
    expect(
      computeSimilarity(
        "POST",
        "/test",
        {},
        Buffer.from([]),
        {
          request: {
            method: "POST",
            path: "/test/other",
            headers: {},
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        []
      )
    ).toBe(Infinity);
  });

  it("counts query parameters differences", () => {
    expect(
      computeSimilarity(
        "POST",
        "/test",
        {},
        Buffer.from([]),
        {
          request: {
            method: "POST",
            path: "/test?c=d",
            headers: {},
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        []
      )
    ).toBe(1);
    expect(
      computeSimilarity(
        "POST",
        "/test?a=b",
        {},
        Buffer.from([]),
        {
          request: {
            method: "POST",
            path: "/test",
            headers: {},
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        []
      )
    ).toBe(1);
    expect(
      computeSimilarity(
        "POST",
        "/test?a=b",
        {},
        Buffer.from([]),
        {
          request: {
            method: "POST",
            path: "/test?c=d",
            headers: {},
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        []
      )
    ).toBe(2);
    expect(
      computeSimilarity(
        "POST",
        "/test?a=b&c=d",
        {},
        Buffer.from([]),
        {
          request: {
            method: "POST",
            path: "/test?a=b&c=d",
            headers: {},
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        []
      )
    ).toBe(0);
    expect(
      computeSimilarity(
        "POST",
        "/test?c=f&a=b",
        {},
        Buffer.from([]),
        {
          request: {
            method: "POST",
            path: "/test?a=b&c=d",
            headers: {},
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        []
      )
    ).toBe(1);
  });

  it("counts headers differences (ignoring extraneous ones)", () => {
    expect(
      computeSimilarity(
        "POST",
        "/test",
        {
          accept: "application/json",
          "user-agent": "Chrome",
          host: "local",
          connection: "persist",
          "x-region": "australia",
        },
        Buffer.from([]),
        {
          request: {
            method: "POST",
            path: "/test",
            headers: {
              accept: "application/vnd.api+json",
              "user-agent": "Firefox",
              host: "google.com",
              "x-region": "australia",
            },
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        []
      )
    ).toBe(0);
    expect(
      computeSimilarity(
        "POST",
        "/test",
        {
          accept: "application/json",
          "user-agent": "Chrome",
          host: "local",
          connection: "persist",
        },
        Buffer.from([]),
        {
          request: {
            method: "POST",
            path: "/test",
            headers: {
              accept: "application/vnd.api+json",
              "user-agent": "Firefox",
              host: "google.com",
              "x-region": "UK",
            },
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        []
      )
    ).toBe(1);
    expect(
      computeSimilarity(
        "POST",
        "/test",
        {
          accept: "application/json",
          "user-agent": "Chrome",
          host: "local",
          connection: "persist",
          "x-region": "australia",
        },
        Buffer.from([]),
        {
          request: {
            method: "POST",
            path: "/test",
            headers: {
              accept: "application/vnd.api+json",
              "user-agent": "Firefox",
              host: "google.com",
              "x-region": "UK",
            },
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        []
      )
    ).toBe(1);
  });

  it("relies on JSON payload similarity", () => {
    // The following payloads are identical, but formatted differently.
    expect(
      computeSimilarity(
        "POST",
        "/test",
        {},
        compactJsonBuffer({
          a: 1,
          b: 2,
          c: 3,
        }),
        {
          request: {
            method: "POST",
            path: "/test",
            headers: {},
            body: wellFormattedJsonBuffer({
              a: 1,
              b: 2,
              c: 3,
            }),
          },
          response: DUMMY_RESPONSE,
        },
        []
      )
    ).toBe(0);

    // The following payloads only have one field that differs (c).
    expect(
      computeSimilarity(
        "POST",
        "/test",
        {},
        compactJsonBuffer({
          a: 1,
          b: 2,
          c: 3,
        }),
        {
          request: {
            method: "POST",
            path: "/test",
            headers: {},
            body: wellFormattedJsonBuffer({
              a: 1,
              b: 2,
              c: {
                d: 4,
                e: 5,
              },
            }),
          },
          response: DUMMY_RESPONSE,
        },
        []
      )
    ).toBe(1);

    // The following payloads have all different fields.
    expect(
      computeSimilarity(
        "POST",
        "/test",
        {},
        compactJsonBuffer({
          a: 1,
          b: 2,
          c: 3,
        }),
        {
          request: {
            method: "POST",
            path: "/test",
            headers: {},
            body: wellFormattedJsonBuffer({
              d: 1,
              e: 2,
              f: 3,
            }),
          },
          response: DUMMY_RESPONSE,
        },
        []
      )
    ).toBe(6);
  });

  it("relies on string similarity", () => {
    expect(
      computeSimilarity(
        "POST",
        "/test",
        {},
        Buffer.from("abc"),
        {
          request: {
            method: "POST",
            path: "/test",
            headers: {},
            body: Buffer.from("abc"),
          },
          response: DUMMY_RESPONSE,
        },
        []
      )
    ).toBe(0);
    expect(
      computeSimilarity(
        "POST",
        "/test",
        {},
        Buffer.from("hello world"),
        {
          request: {
            method: "POST",
            path: "/test",
            headers: {},
            body: Buffer.from("hello Kevin"),
          },
          response: DUMMY_RESPONSE,
        },
        []
      )
    ).toBe(6);
  });

  it("relies on file payload similarity", () => {
    const avatarFile1 = fs.readFileSync(
      path.join(__dirname, "..", "testdata", "avatar.jpg")
    );
    const avatarFile2 = fs.readFileSync(
      path.join(__dirname, "..", "testdata", "avatar-small.jpg")
    );
    expect(
      computeSimilarity(
        "POST",
        "/test",
        {},
        avatarFile1,
        {
          request: {
            method: "POST",
            path: "/test",
            headers: {},
            body: avatarFile1,
          },
          response: DUMMY_RESPONSE,
        },
        []
      )
    ).toBe(0);
    expect(
      computeSimilarity(
        "POST",
        "/test",
        {},
        avatarFile1,
        {
          request: {
            method: "POST",
            path: "/test",
            headers: {},
            body: avatarFile2,
          },
          response: DUMMY_RESPONSE,
        },
        []
      )
    ).toBe(5149);
  });
});

/**
 * Returns a buffer with compact JSON.
 */
function compactJsonBuffer(data: unknown) {
  return Buffer.from(JSON.stringify(data));
}

/**
 * Returns a buffer with well-formatted JSON (different from compactJson).
 */
function wellFormattedJsonBuffer(data: unknown) {
  return Buffer.from(JSON.stringify(data, null, 2));
}
