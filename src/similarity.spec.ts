import fs from "fs";
import path from "path";
import { computeSimilarity } from "./similarity";
import { RewriteRule, RewriteRules } from "./rewrite";

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
        {
          method: "POST",
          path: "/test",
          headers: {},
          body: Buffer.from([]),
        },
        {
          request: {
            method: "POST",
            path: "/test",
            headers: {},
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        new RewriteRules(),
        [],
      ),
    ).toBe(0);
  });

  it("excludes mismatching methods", () => {
    expect(
      computeSimilarity(
        {
          method: "GET",
          path: "/test",
          headers: {},
          body: Buffer.from([]),
        },
        {
          request: {
            method: "POST",
            path: "/test",
            headers: {},
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        new RewriteRules(),
        [],
      ),
    ).toBe(Infinity);
  });

  it("excludes mismatching paths", () => {
    expect(
      computeSimilarity(
        {
          method: "POST",
          path: "/test",
          headers: {},
          body: Buffer.from([]),
        },
        {
          request: {
            method: "POST",
            path: "/test/other",
            headers: {},
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        new RewriteRules(),
        [],
      ),
    ).toBe(Infinity);
  });

  it("counts query parameters differences", () => {
    expect(
      computeSimilarity(
        {
          method: "POST",
          path: "/test",
          headers: {},
          body: Buffer.from([]),
        },
        {
          request: {
            method: "POST",
            path: "/test?c=d",
            headers: {},
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        new RewriteRules(),
        [],
      ),
    ).toBe(1);
    expect(
      computeSimilarity(
        {
          method: "POST",
          path: "/test?a=b",
          headers: {},
          body: Buffer.from([]),
        },
        {
          request: {
            method: "POST",
            path: "/test",
            headers: {},
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        new RewriteRules(),
        [],
      ),
    ).toBe(1);
    expect(
      computeSimilarity(
        {
          method: "POST",
          path: "/test?a=b",
          headers: {},
          body: Buffer.from([]),
        },
        {
          request: {
            method: "POST",
            path: "/test?c=d",
            headers: {},
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        new RewriteRules(),
        [],
      ),
    ).toBe(2);
    expect(
      computeSimilarity(
        {
          method: "POST",
          path: "/test?a=b&c=d",
          headers: {},
          body: Buffer.from([]),
        },
        {
          request: {
            method: "POST",
            path: "/test?a=b&c=d",
            headers: {},
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        new RewriteRules(),
        [],
      ),
    ).toBe(0);
    expect(
      computeSimilarity(
        {
          method: "POST",
          path: "/test?c=f&a=b",
          headers: {},
          body: Buffer.from([]),
        },
        {
          request: {
            method: "POST",
            path: "/test?a=b&c=d",
            headers: {},
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        new RewriteRules(),
        [],
      ),
    ).toBe(1);
  });

  it("counts headers differences (ignoring extraneous ones)", () => {
    expect(
      computeSimilarity(
        {
          method: "POST",
          path: "/test",
          headers: {
            accept: "application/json",
            "user-agent": "Chrome",
            host: "local",
            connection: "persist",
            "x-region": "australia",
          },
          body: Buffer.from([]),
        },
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
        new RewriteRules(),
        [],
      ),
    ).toBe(0);
    expect(
      computeSimilarity(
        {
          method: "POST",
          path: "/test",
          headers: {
            accept: "application/json",
            "user-agent": "Chrome",
            host: "local",
            connection: "persist",
          },
          body: Buffer.from([]),
        },
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
        new RewriteRules(),
        [],
      ),
    ).toBe(1);
    expect(
      computeSimilarity(
        {
          method: "POST",
          path: "/test",
          headers: {
            accept: "application/json",
            "user-agent": "Chrome",
            host: "local",
            connection: "persist",
            "x-region": "australia",
          },
          body: Buffer.from([]),
        },
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
        new RewriteRules(),
        [],
      ),
    ).toBe(1);
  });

  it("counts headers differences (ignoring specified ones)", () => {
    expect(
      computeSimilarity(
        {
          method: "POST",
          path: "/test",
          headers: {
            one: "one",
            two: "two",
            three: "three",
            four: "four",
          },
          body: Buffer.from([]),
        },
        {
          request: {
            method: "POST",
            path: "/test",
            headers: {
              // one is missing
              two: "different two",
              three: "different three",
              four: "four", // four is the same
            },
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        new RewriteRules(),
        ["one", "two", "three"],
      ),
    ).toBe(0);
    expect(
      computeSimilarity(
        {
          method: "POST",
          path: "/test",
          headers: {
            one: "one",
            two: "two",
            three: "three",
            four: "four",
          },
          body: Buffer.from([]),
        },
        {
          request: {
            method: "POST",
            path: "/test",
            headers: {
              // one is missing
              two: "different two",
              three: "different three",
              four: "different four",
            },
            body: Buffer.from([]),
          },
          response: DUMMY_RESPONSE,
        },
        new RewriteRules(),
        ["one", "two", "three"],
      ),
    ).toBe(1);
  });

  it("dumps headers if non equal", () => {
    const logSpy = jest.spyOn(console, "log");

    computeSimilarity(
      {
        method: "POST",
        path: "/test",
        headers: {
          ignore: "ignore",
          one: "one",
          two: "two",
          three: "three",
          four: "four",
        },
        body: Buffer.from([]),
      },
      {
        request: {
          method: "POST",
          path: "/test",
          headers: {
            ignore: "different ignore",
            one: "one",
            two: "two",
            three: "three",
            four: "four",
          },
          body: Buffer.from([]),
        },
        response: DUMMY_RESPONSE,
      },
      new RewriteRules(),
      ["ignore"],
      true,
    );

    expect(logSpy).not.toHaveBeenCalled();

    computeSimilarity(
      {
        method: "POST",
        path: "/test",
        headers: {
          ignore: "ignore",
          one: "one",
          two: "two",
          three: "three",
          four: "four",
        },
        body: Buffer.from([]),
      },
      {
        request: {
          method: "POST",
          path: "/test",
          headers: {
            ignore: "different ignore",
            // one is missing
            two: "different two",
            three: "different three",
            four: "four", // four is the same
          },
          body: Buffer.from([]),
        },
        response: DUMMY_RESPONSE,
      },
      new RewriteRules(),
      ["ignore"],
      true,
    );

    expect(logSpy).toHaveBeenCalledWith(
      'debug: a: {"one":"one","two":"two","three":"three","four":"four"} / b: {"two":"different two","three":"different three","four":"four"}',
    );

    logSpy.mockRestore();
  });

  describe("JSON payload types", () => {
    it("reports no differences when the paylods are the same", () => {
      // The following payloads are identical, but formatted differently.
      expect(
        computeSimilarity(
          {
            method: "POST",
            path: "/test",
            headers: {
              "content-type": "application/json",
            },
            body: compactJsonBuffer({
              a: 1,
              b: 2,
              c: 3,
            }),
          },
          {
            request: {
              method: "POST",
              path: "/test",
              headers: {
                "content-type": "application/json",
              },
              body: wellFormattedJsonBuffer({
                a: 1,
                b: 2,
                c: 3,
              }),
            },
            response: DUMMY_RESPONSE,
          },
          new RewriteRules(),
          [],
        ),
      ).toBe(0);
    });

    it("reports differences when the payloads are different", () => {
      // The following payloads only have one field that differs (c).
      expect(
        computeSimilarity(
          {
            method: "POST",
            path: "/test",
            headers: {
              "content-type": "application/json",
            },
            body: compactJsonBuffer({
              a: 1,
              b: 2,
              c: 3,
            }),
          },
          {
            request: {
              method: "POST",
              path: "/test",
              headers: {
                "content-type": "application/json",
              },
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
          new RewriteRules(),
          [],
        ),
      ).toBe(1);

      // The following payloads have all different fields.
      expect(
        computeSimilarity(
          {
            method: "POST",
            path: "/test",
            headers: {
              "content-type": "application/json",
            },
            body: compactJsonBuffer({
              a: 1,
              b: 2,
              c: 3,
            }),
          },
          {
            request: {
              method: "POST",
              path: "/test",
              headers: {
                "content-type": "application/json",
              },
              body: wellFormattedJsonBuffer({
                d: 1,
                e: 2,
                f: 3,
              }),
            },
            response: DUMMY_RESPONSE,
          },
          new RewriteRules(),
          [],
        ),
      ).toBe(6);

      // The following payloads are identical after rewrite rules have been applied.
      expect(
        computeSimilarity(
          {
            method: "POST",
            path: "/test",
            headers: {
              "content-type": "application/json",
            },
            body: compactJsonBuffer({
              name: "Jane Doe",
              email:
                "jane.doe-some-test-6f82fbbe-d36a-4c5c-b47b-84100122fbbc@example.com",
              age: 42,
            }),
          },
          {
            request: {
              method: "POST",
              path: "/test",
              headers: {
                "content-type": "application/json",
              },
              body: wellFormattedJsonBuffer({
                name: "Jane Doe",
                email: "jane.doe-some-test@example.com",
                age: 42,
              }),
            },
            response: DUMMY_RESPONSE,
          },
          new RewriteRules().appendRule(
            new RewriteRule(
              /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(@example.com)$/gi,
              "$1",
            ),
          ),
          [],
        ),
      ).toBe(0);
    });
  });

  describe("text payload types", () => {
    it("reports no differences when the payloads are the same", () => {
      expect(
        computeSimilarity(
          {
            method: "POST",
            path: "/test",
            headers: {
              "content-type": "text/plain",
            },
            body: Buffer.from("abc"),
          },
          {
            request: {
              method: "POST",
              path: "/test",
              headers: {
                "content-type": "text/plain",
              },
              body: Buffer.from("abc"),
            },
            response: DUMMY_RESPONSE,
          },
          new RewriteRules(),
          [],
        ),
      ).toBe(0);
    });

    it("reports differences when the payloads are different", () => {
      expect(
        computeSimilarity(
          {
            method: "POST",
            path: "/test",
            headers: {
              "content-type": "text/plain",
            },
            body: Buffer.from("hello world"),
          },
          {
            request: {
              method: "POST",
              path: "/test",
              headers: {
                "content-type": "text/plain",
              },
              body: Buffer.from("hello Kevin"),
            },
            response: DUMMY_RESPONSE,
          },
          new RewriteRules(),
          [],
        ),
      ).toBe(6);
    });
  });

  describe("binary payload types", () => {
    const avatarFile1 = fs.readFileSync(
      path.join(__dirname, "..", "testdata", "avatar.jpg"),
    );
    const avatarFile2 = fs.readFileSync(
      path.join(__dirname, "..", "testdata", "avatar-small.jpg"),
    );

    it("reports no differences when the payloads are the same", () => {
      expect(
        computeSimilarity(
          {
            method: "POST",
            path: "/test",
            headers: {
              "content-type": "image/jpeg",
            },
            body: avatarFile1,
          },
          {
            request: {
              method: "POST",
              path: "/test",
              headers: {
                "content-type": "image/jpeg",
              },
              body: avatarFile1,
            },
            response: DUMMY_RESPONSE,
          },
          new RewriteRules(),
          [],
        ),
      ).toBe(0);
    });

    it("reports differences when the payloads are different", () => {
      expect(
        computeSimilarity(
          {
            method: "POST",
            path: "/test",
            headers: {
              "content-type": "image/jpeg",
            },
            body: avatarFile1,
          },
          {
            request: {
              method: "POST",
              path: "/test",
              headers: {
                "content-type": "image/jpeg",
              },
              body: avatarFile2,
            },
            response: DUMMY_RESPONSE,
          },
          new RewriteRules(),
          [],
        ),
      ).toBe(5149);
    });
  });

  describe("grpc-web payload types", () => {
    it("reports no differences when the payloads are the same", () => {
      const requestBody = Buffer.from(
        new Uint8Array([
          0x00, 0x00, 0x00, 0x00, 0x8c, 0x0a, 0x45, 0x62, 0x66, 0x66, 0x2d,
          0x74, 0x65, 0x73, 0x74, 0x2e, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x5f,
          0x75, 0x73, 0x65, 0x72, 0x2e, 0x30, 0x37, 0x30, 0x63, 0x36, 0x32,
          0x35, 0x65, 0x2d, 0x35, 0x66, 0x33, 0x61, 0x2d, 0x34, 0x33, 0x37,
          0x38, 0x2d, 0x38, 0x36, 0x34, 0x31, 0x2d, 0x65, 0x62, 0x33, 0x62,
          0x33, 0x38, 0x64, 0x35, 0x64, 0x38, 0x30, 0x30, 0x40, 0x74, 0x65,
          0x73, 0x74, 0x2e, 0x61, 0x69, 0x72, 0x74, 0x2e, 0x73, 0x6b, 0x12,
          0x2d, 0x70, 0x61, 0x73, 0x73, 0x77, 0x6f, 0x72, 0x64, 0x2e, 0x30,
          0x37, 0x30, 0x63, 0x36, 0x32, 0x35, 0x65, 0x2d, 0x35, 0x66, 0x33,
          0x61, 0x2d, 0x34, 0x33, 0x37, 0x38, 0x2d, 0x38, 0x36, 0x34, 0x31,
          0x2d, 0x65, 0x62, 0x33, 0x62, 0x33, 0x38, 0x64, 0x35, 0x64, 0x38,
          0x30, 0x30, 0x1a, 0x14, 0x42, 0x46, 0x46, 0x20, 0x69, 0x6e, 0x74,
          0x65, 0x67, 0x72, 0x61, 0x74, 0x69, 0x6f, 0x6e, 0x20, 0x74, 0x65,
          0x73, 0x74,
        ]),
      );
      expect(
        computeSimilarity(
          {
            method: "POST",
            path: "/test",
            headers: {
              "content-type": "application/grpc-web+proto",
            },
            body: requestBody,
          },
          {
            request: {
              method: "POST",
              path: "/test",
              headers: {
                "content-type": "application/grpc-web+proto",
              },
              body: requestBody,
            },
            response: DUMMY_RESPONSE,
          },
          new RewriteRules(),
          [],
        ),
      ).toBe(0);
    });

    it("reports differences when the payloads are different", () => {
      expect(
        computeSimilarity(
          {
            method: "POST",
            path: "/test",
            headers: {
              "content-type": "application/grpc-web+proto",
            },
            body: Buffer.from(
              new Uint8Array([
                0x00, 0x00, 0x00, 0x00, 0x8c, 0x0a, 0x45, 0x62, 0x66, 0x66,
                0x2d, 0x74, 0x65, 0x73, 0x74, 0x2e, 0x70, 0x72, 0x6f, 0x74,
                0x6f, 0x5f, 0x75, 0x73, 0x65, 0x72, 0x2e, 0x30, 0x37, 0x30,
                0x63, 0x36, 0x32, 0x35, 0x65, 0x2d, 0x35, 0x66, 0x33, 0x61,
                0x2d, 0x34, 0x33, 0x37, 0x38, 0x2d, 0x38, 0x36, 0x34, 0x31,
                0x2d, 0x65, 0x62, 0x33, 0x62, 0x33, 0x38, 0x64, 0x35, 0x64,
                0x38, 0x30, 0x30, 0x40, 0x74, 0x65, 0x73, 0x74, 0x2e, 0x61,
                0x69, 0x72, 0x74, 0x2e, 0x73, 0x6b, 0x12, 0x2d, 0x70, 0x61,
                0x73, 0x73, 0x77, 0x6f, 0x72, 0x64, 0x2e, 0x30, 0x37, 0x30,
                0x63, 0x36, 0x32, 0x35, 0x65, 0x2d, 0x35, 0x66, 0x33, 0x61,
                0x2d, 0x34, 0x33, 0x37, 0x38, 0x2d, 0x38, 0x36, 0x34, 0x31,
                0x2d, 0x65, 0x62, 0x33, 0x62, 0x33, 0x38, 0x64, 0x35, 0x64,
                0x38, 0x30, 0x30, 0x1a, 0x14, 0x42, 0x46, 0x46, 0x20, 0x69,
                0x6e, 0x74, 0x65, 0x67, 0x72, 0x61, 0x74, 0x69, 0x6f, 0x6e,
                0x20, 0x74, 0x65, 0x73, 0x74,
              ]),
            ),
          },
          {
            request: {
              method: "POST",
              path: "/test",
              headers: {
                "content-type": "application/grpc-web+proto",
              },
              body: Buffer.from(
                // This has the UUID in the email address changed compared to the request.
                new Uint8Array([
                  0x00, 0x00, 0x00, 0x00, 0x8c, 0x0a, 0x45, 0x62, 0x66, 0x66,
                  0x2d, 0x74, 0x65, 0x73, 0x74, 0x2e, 0x70, 0x72, 0x6f, 0x74,
                  0x6f, 0x5f, 0x75, 0x73, 0x65, 0x72, 0x2e, 0x35, 0x65, 0x62,
                  0x66, 0x32, 0x66, 0x36, 0x38, 0x2d, 0x62, 0x30, 0x66, 0x30,
                  0x2d, 0x34, 0x63, 0x37, 0x35, 0x2d, 0x39, 0x35, 0x37, 0x30,
                  0x2d, 0x31, 0x31, 0x62, 0x31, 0x65, 0x31, 0x39, 0x34, 0x36,
                  0x35, 0x32, 0x34, 0x40, 0x74, 0x65, 0x73, 0x74, 0x2e, 0x61,
                  0x69, 0x72, 0x74, 0x2e, 0x73, 0x6b, 0x12, 0x2d, 0x70, 0x61,
                  0x73, 0x73, 0x77, 0x6f, 0x72, 0x64, 0x2e, 0x30, 0x37, 0x30,
                  0x63, 0x36, 0x32, 0x35, 0x65, 0x2d, 0x35, 0x66, 0x33, 0x61,
                  0x2d, 0x34, 0x33, 0x37, 0x38, 0x2d, 0x38, 0x36, 0x34, 0x31,
                  0x2d, 0x65, 0x62, 0x33, 0x62, 0x33, 0x38, 0x64, 0x35, 0x64,
                  0x38, 0x30, 0x30, 0x1a, 0x14, 0x42, 0x46, 0x46, 0x20, 0x69,
                  0x6e, 0x74, 0x65, 0x67, 0x72, 0x61, 0x74, 0x69, 0x6f, 0x6e,
                  0x20, 0x74, 0x65, 0x73, 0x74,
                ]),
              ),
            },
            response: DUMMY_RESPONSE,
          },
          new RewriteRules(),
          [],
        ),
      ).toBe(1);
    });

    it("reports no differences when the payloads not different after rewrite rules", () => {
      expect(
        computeSimilarity(
          {
            method: "POST",
            path: "/test",
            headers: {
              "content-type": "application/grpc-web+proto",
            },
            body: Buffer.from(
              new Uint8Array([
                0x00, 0x00, 0x00, 0x00, 0x8c, 0x0a, 0x45, 0x62, 0x66, 0x66,
                0x2d, 0x74, 0x65, 0x73, 0x74, 0x2e, 0x70, 0x72, 0x6f, 0x74,
                0x6f, 0x5f, 0x75, 0x73, 0x65, 0x72, 0x2e, 0x30, 0x37, 0x30,
                0x63, 0x36, 0x32, 0x35, 0x65, 0x2d, 0x35, 0x66, 0x33, 0x61,
                0x2d, 0x34, 0x33, 0x37, 0x38, 0x2d, 0x38, 0x36, 0x34, 0x31,
                0x2d, 0x65, 0x62, 0x33, 0x62, 0x33, 0x38, 0x64, 0x35, 0x64,
                0x38, 0x30, 0x30, 0x40, 0x74, 0x65, 0x73, 0x74, 0x2e, 0x61,
                0x69, 0x72, 0x74, 0x2e, 0x73, 0x6b, 0x12, 0x2d, 0x70, 0x61,
                0x73, 0x73, 0x77, 0x6f, 0x72, 0x64, 0x2e, 0x30, 0x37, 0x30,
                0x63, 0x36, 0x32, 0x35, 0x65, 0x2d, 0x35, 0x66, 0x33, 0x61,
                0x2d, 0x34, 0x33, 0x37, 0x38, 0x2d, 0x38, 0x36, 0x34, 0x31,
                0x2d, 0x65, 0x62, 0x33, 0x62, 0x33, 0x38, 0x64, 0x35, 0x64,
                0x38, 0x30, 0x30, 0x1a, 0x14, 0x42, 0x46, 0x46, 0x20, 0x69,
                0x6e, 0x74, 0x65, 0x67, 0x72, 0x61, 0x74, 0x69, 0x6f, 0x6e,
                0x20, 0x74, 0x65, 0x73, 0x74,
              ]),
            ),
          },
          {
            request: {
              method: "POST",
              path: "/test",
              headers: {
                "content-type": "application/grpc-web+proto",
              },
              body: Buffer.from(
                // This has the UUID in the email address changed compared to the request.
                new Uint8Array([
                  0x00, 0x00, 0x00, 0x00, 0x8c, 0x0a, 0x45, 0x62, 0x66, 0x66,
                  0x2d, 0x74, 0x65, 0x73, 0x74, 0x2e, 0x70, 0x72, 0x6f, 0x74,
                  0x6f, 0x5f, 0x75, 0x73, 0x65, 0x72, 0x2e, 0x35, 0x65, 0x62,
                  0x66, 0x32, 0x66, 0x36, 0x38, 0x2d, 0x62, 0x30, 0x66, 0x30,
                  0x2d, 0x34, 0x63, 0x37, 0x35, 0x2d, 0x39, 0x35, 0x37, 0x30,
                  0x2d, 0x31, 0x31, 0x62, 0x31, 0x65, 0x31, 0x39, 0x34, 0x36,
                  0x35, 0x32, 0x34, 0x40, 0x74, 0x65, 0x73, 0x74, 0x2e, 0x61,
                  0x69, 0x72, 0x74, 0x2e, 0x73, 0x6b, 0x12, 0x2d, 0x70, 0x61,
                  0x73, 0x73, 0x77, 0x6f, 0x72, 0x64, 0x2e, 0x30, 0x37, 0x30,
                  0x63, 0x36, 0x32, 0x35, 0x65, 0x2d, 0x35, 0x66, 0x33, 0x61,
                  0x2d, 0x34, 0x33, 0x37, 0x38, 0x2d, 0x38, 0x36, 0x34, 0x31,
                  0x2d, 0x65, 0x62, 0x33, 0x62, 0x33, 0x38, 0x64, 0x35, 0x64,
                  0x38, 0x30, 0x30, 0x1a, 0x14, 0x42, 0x46, 0x46, 0x20, 0x69,
                  0x6e, 0x74, 0x65, 0x67, 0x72, 0x61, 0x74, 0x69, 0x6f, 0x6e,
                  0x20, 0x74, 0x65, 0x73, 0x74,
                ]),
              ),
            },
            response: DUMMY_RESPONSE,
          },
          new RewriteRules().appendRule(
            new RewriteRule(
              /\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(@test\.airt\.sk)$/gi,
              "$1",
            ),
          ),
          [],
        ),
      ).toBe(0);
    });
  });

  describe("grpc-web-text payload types", () => {
    it("reports no differences when the payloads are the same", () => {
      const requestBody = Buffer.from(
        "AAAAAIwKRWJmZi10ZXN0LnByb3RvX3VzZXIuMDcwYzYyNWUtNWYzYS00Mzc4LTg2NDEtZWIzYjM4ZDVkODAwQHRlc3QuYWlydC5zaxItcGFzc3dvcmQuMDcwYzYyNWUtNWYzYS00Mzc4LTg2NDEtZWIzYjM4ZDVkODAwGhRCRkYgaW50ZWdyYXRpb24gdGVzdA==",
      );
      expect(
        computeSimilarity(
          {
            method: "POST",
            path: "/test",
            headers: {
              "content-type": "application/grpc-web-text+proto",
            },
            body: requestBody,
          },
          {
            request: {
              method: "POST",
              path: "/test",
              headers: {
                "content-type": "application/grpc-web-text+proto",
              },
              body: requestBody,
            },
            response: DUMMY_RESPONSE,
          },
          new RewriteRules(),
          [],
        ),
      ).toBe(0);
    });

    it("reports differences when the payloads are different", () => {
      expect(
        computeSimilarity(
          {
            method: "POST",
            path: "/test",
            headers: {
              "content-type": "application/grpc-web-text+proto",
            },
            body: Buffer.from(
              "AAAAAIwKRWJmZi10ZXN0LnByb3RvX3VzZXIuMDcwYzYyNWUtNWYzYS00Mzc4LTg2NDEtZWIzYjM4ZDVkODAwQHRlc3QuYWlydC5zaxItcGFzc3dvcmQuMDcwYzYyNWUtNWYzYS00Mzc4LTg2NDEtZWIzYjM4ZDVkODAwGhRCRkYgaW50ZWdyYXRpb24gdGVzdA==",
            ),
          },
          {
            request: {
              method: "POST",
              path: "/test",
              headers: {
                "content-type": "application/grpc-web-text+proto",
              },
              body: Buffer.from(
                // This has the UUID in the email address changed compared to the request.
                "AAAAAIwKRWJmZi10ZXN0LnByb3RvX3VzZXIuNWViZjJmNjgtYjBmMC00Yzc1LTk1NzAtMTFiMWUxOTQ2NTI0QHRlc3QuYWlydC5zaxItcGFzc3dvcmQuMDcwYzYyNWUtNWYzYS00Mzc4LTg2NDEtZWIzYjM4ZDVkODAwGhRCRkYgaW50ZWdyYXRpb24gdGVzdA==",
              ),
            },
            response: DUMMY_RESPONSE,
          },
          new RewriteRules(),
          [],
        ),
      ).toBe(1);
    });

    it("reports no differences when the payloads not different after rewrite rules", () => {
      expect(
        computeSimilarity(
          {
            method: "POST",
            path: "/test",
            headers: {
              "content-type": "application/grpc-web-text+proto",
            },
            body: Buffer.from(
              "AAAAAIwKRWJmZi10ZXN0LnByb3RvX3VzZXIuMDcwYzYyNWUtNWYzYS00Mzc4LTg2NDEtZWIzYjM4ZDVkODAwQHRlc3QuYWlydC5zaxItcGFzc3dvcmQuMDcwYzYyNWUtNWYzYS00Mzc4LTg2NDEtZWIzYjM4ZDVkODAwGhRCRkYgaW50ZWdyYXRpb24gdGVzdA==",
            ),
          },
          {
            request: {
              method: "POST",
              path: "/test",
              headers: {
                "content-type": "application/grpc-web-text+proto",
              },
              body: Buffer.from(
                // This has the UUID in the email address changed compared to the request.
                "AAAAAIwKRWJmZi10ZXN0LnByb3RvX3VzZXIuNWViZjJmNjgtYjBmMC00Yzc1LTk1NzAtMTFiMWUxOTQ2NTI0QHRlc3QuYWlydC5zaxItcGFzc3dvcmQuMDcwYzYyNWUtNWYzYS00Mzc4LTg2NDEtZWIzYjM4ZDVkODAwGhRCRkYgaW50ZWdyYXRpb24gdGVzdA==",
              ),
            },
            response: DUMMY_RESPONSE,
          },
          new RewriteRules().appendRule(
            new RewriteRule(
              /\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(@test\.airt\.sk)$/gi,
              "$1",
            ),
          ),
          [],
        ),
      ).toBe(0);
    });
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
