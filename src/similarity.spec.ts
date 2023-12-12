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
      ),
    ).toBe(1);
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
        ),
      ).toBe(0);
    })

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
        ),
      ).toBe(0);
    });
  })

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
        ),
      ).toBe(0);
    })

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
        ),
      ).toBe(6);
    });
  })

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
        ),
      ).toBe(5149);
    });
  })

  describe("grpc-web payload types", () => {

  })

  describe("grpc-web-text payload types", () => {

  })
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
