import axios from "axios";
import { PROXAY_HOST } from "./config";
import { setupServers } from "./setup";

describe("Proxay endpoint", () => {
  setupServers("replay");

  it("returns a 200 for /__proxay", async () => {
    const response = await axios.get(`${PROXAY_HOST}/__proxay`);
    expect(response.status).toBe(200);
  });
});
