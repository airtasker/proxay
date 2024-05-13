import { setupServers } from "./setup";
import axios from "axios";
import { PROXAY_HOST, PROXAY_PORT } from "./config";
import { JSON_IDENTITY_PATH } from "./testserver";

describe("SendProxyPort", () => {
  describe("regular sendProxyPort mode", () => {
    setupServers({ mode: "passthrough" });
    test("response: hostname without port", async () => {
      const response = await axios.get(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`);
      expect(response.data.hostname).toBe("localhost");
    });
  });

  describe("regular sendProxyPort mode", () => {
    setupServers({ mode: "passthrough", sendProxyPort: true });
    test("response: hostname with port", async () => {
      const response = await axios.get(`${PROXAY_HOST}${JSON_IDENTITY_PATH}`);
      expect(response.data.hostname).toBe("localhost:" + PROXAY_PORT);
    });
  });
});
