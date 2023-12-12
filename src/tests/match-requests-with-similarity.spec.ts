import axios from "axios";
import { PROXAY_HOST } from "./config";
import { setupServers } from "./setup";
import { JSON_IDENTITY_PATH } from "./testserver";

describe("Match requests without passing match arguement", () => {
  setupServers({ mode: "replay", tapeDirName: "match-requests" });

  it("Picks the best match for a given request", async () => {
    // Start recording in tape "tape".
    await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
      tape: "tape",
      mode: "record",
    });

    // Pre-record a few requests and responses.
    await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
      field1: {
        key1: "a",
        key2: "b",
      },
      field2: "c",
      field3: 1,
    });
    await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
      field1: {
        key1: "a",
        key2: "b",
        key3: "c",
      },
      field2: "d",
      field3: 1,
    });
    await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
      field1: {
        key1: "z",
        key2: "a",
      },
      field2: "d",
      field3: 1,
    });

    // Switch to replay mode, same tape.
    await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
      tape: "tape",
      mode: "replay",
    });

    // Make sure the best possible match is picked each time.
    expect(
      (
        await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
          field1: {
            key1: "z",
            key2: "a",
          },
          field2: "d",
          field3: 1,
        })
      ).data,
    ).toEqual({
      field1: {
        key1: "z",
        key2: "a",
      },
      field2: "d",
      field3: 1,
      requestCount: 3,
    });
    expect(
      (
        await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
          field1: {
            key1: "a",
            key2: "b",
          },
          field2: "d",
          field3: 1,
        })
      ).data,
    ).toEqual({
      field1: {
        key1: "a",
        key2: "b",
      },
      field2: "c",
      field3: 1,
      requestCount: 1,
    });
  });
});

describe("Match requests with match false", () => {
  setupServers({ mode: "replay", tapeDirName: "match-requests", match: false });

  it("Picks the best match for a given request", async () => {
    // Start recording in tape "tape".
    await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
      tape: "tape",
      mode: "record",
    });

    // Pre-record a few requests and responses.
    await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
      field1: {
        key1: "a",
        key2: "b",
      },
      field2: "c",
      field3: 1,
    });
    await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
      field1: {
        key1: "a",
        key2: "b",
        key3: "c",
      },
      field2: "d",
      field3: 1,
    });
    await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
      field1: {
        key1: "z",
        key2: "a",
      },
      field2: "d",
      field3: 1,
    });

    // Switch to replay mode, same tape.
    await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
      tape: "tape",
      mode: "replay",
    });

    // Make sure the best possible match is picked each time.
    expect(
      (
        await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
          field1: {
            key1: "z",
            key2: "a",
          },
          field2: "d",
          field3: 1,
        })
      ).data,
    ).toEqual({
      field1: {
        key1: "z",
        key2: "a",
      },
      field2: "d",
      field3: 1,
      requestCount: 3,
    });
    expect(
      (
        await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
          field1: {
            key1: "a",
            key2: "b",
          },
          field2: "d",
          field3: 1,
        })
      ).data,
    ).toEqual({
      field1: {
        key1: "a",
        key2: "b",
      },
      field2: "c",
      field3: 1,
      requestCount: 1,
    });
  });
});

describe("Match requests with match true", () => {
  setupServers({ mode: "replay", tapeDirName: "match-requests", match: true });

  it("Picks the best match for a given request", async () => {
    // Start recording in tape "tape".
    await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
      tape: "tape",
      mode: "record",
    });

    // Pre-record a few requests and responses.
    await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
      field1: {
        key1: "a",
        key2: "b",
      },
      field2: "c",
      field3: 1,
    });
    await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
      field1: {
        key1: "a",
        key2: "b",
        key3: "c",
      },
      field2: "d",
      field3: 1,
    });
    await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
      field1: {
        key1: "z",
        key2: "a",
      },
      field2: "d",
      field3: 1,
    });

    // Switch to replay mode, same tape.
    await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
      tape: "tape",
      mode: "replay",
    });

    // Make sure the best possible match is picked each time.
    expect(
      (
        await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
          field1: {
            key1: "z",
            key2: "a",
          },
          field2: "d",
          field3: 1,
        })
      ).data,
    ).toEqual({
      field1: {
        key1: "z",
        key2: "a",
      },
      field2: "d",
      field3: 1,
      requestCount: 3,
    });
    expect(
      (
        await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
          field1: {
            key1: "a",
            key2: "b",
          },
          field2: "c",
          field3: 1,
        })
      ).data,
    ).toEqual({
      field1: {
        key1: "a",
        key2: "b",
      },
      field2: "c",
      field3: 1,
      requestCount: 1,
    });
  });
});
