import axios from "axios";
import { PROXAY_HOST } from "./config";
import { setupServers } from "./setup";
import { JSON_IDENTITY_PATH } from "./testserver";

describe("Match requests", () => {
  setupServers("replay", "match-requests");

  it("Picks the best match for a given request", async () => {
    // Start recording in tape "tape".
    await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
      tape: "tape",
      mode: "record"
    });

    // Pre-record a few requests and responses.
    await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
      field1: {
        key1: "a",
        key2: "b"
      },
      field2: "c",
      field3: 1
    });
    await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
      field1: {
        key1: "a",
        key2: "b",
        key3: "c"
      },
      field2: "d",
      field3: 1
    });
    await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
      field1: {
        key1: "z",
        key2: "a"
      },
      field2: "d",
      field3: 1
    });

    // Switch to replay mode, same tape.
    await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
      tape: "tape",
      mode: "replay"
    });

    // Make sure the best possible match is picked each time.
    expect(
      (await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
        field1: {
          key1: "z",
          key2: "a"
        },
        field2: "d",
        field3: 1
      })).data
    ).toEqual({
      field1: {
        key1: "z",
        key2: "a"
      },
      field2: "d",
      field3: 1,
      requestCount: 3,
    });
    expect(
      (await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
        field1: {
          key1: "a",
          key2: "b"
        },
        field2: "d",
        field3: 1
      })).data
    ).toEqual({
      field1: {
        key1: "a",
        key2: "b"
      },
      field2: "c",
      field3: 1,
      requestCount: 1,
    });
    expect(
      (await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
        field1: {
          key1: "a",
          key2: "b",
          key3: "c"
        },
        unrelatedField: "abc"
      })).data
    ).toEqual({
      field1: {
        key1: "a",
        key2: "b",
        key3: "c"
      },
      field2: "d",
      field3: 1,
      requestCount: 2,
    });
    expect(
      (await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}?abc=123`, {
        field1: {
          key1: "a",
          key2: "b",
          key3: "c"
        },
        unrelatedField: "abc"
      })).data
    ).toEqual({
      field1: {
        key1: "a",
        key2: "b",
        key3: "c"
      },
      field2: "d",
      field3: 1,
      requestCount: 2,
    });
  });

  describe('When more than one requests are the same', () => {
    describe('when replaying get request', () => {
      beforeAll(async () => {
        await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
          tape: "tape",
          mode: "record"
        });

        await axios.get(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`);

        await axios.get(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`);
      });

      it("Picks the request that hasn't been matched over the request has been matched", async () => {
        await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
          tape: "tape",
          mode: "replay"
        });

        const response1 = await axios.get(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`);

        const response2 = await axios.get(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`);

        expect(response1.data.requestCount).not.toEqual(response2.data.requestCount);
      });
    });

    describe('when replaying post request', () => {
      beforeAll(async () => {
        await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
          tape: "tape",
          mode: "record"
        });

        await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
          field3: 1,
        });

        await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
          field3: 1,
        });
      });

      it("Picks the request that hasn't been matched over the request has been matched", async () => {
        await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
          tape: "tape",
          mode: "replay"
        });

        const response1 = await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
          field3: 1
        });

        const response2 = await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
          field3: 1
        });

        expect(response1.data.requestCount).not.toEqual(response2.data.requestCount);
      });

      describe('when there are more requests than recorded', () => {
        beforeAll(async () => {
          await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
            tape: "tape",
            mode: "record"
          });

          await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
            field3: 1,
          });

          await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
            field3: 1,
          });
        });

        it("Pick the last request", async () => {
          await axios.post(`${PROXAY_HOST}/__proxay/tape`, {
            tape: "tape",
            mode: "replay"
          });

          await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
            field3: 1
          });

          const response2 = await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
            field3: 1
          });

          const response3 = await axios.post(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`, {
            field3: 1
          });

          expect(response3.data.requestCount).toEqual(response2.data.requestCount);
        })
      });
    })
  });
});
