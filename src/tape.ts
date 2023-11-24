import { HttpHeaders, HttpRequest, HttpResponse } from "./core";

/**
 * A record of a specific HTTP interaction (request + response).
 */
export interface TapeRecord {
  request: HttpRequest;
  response: HttpResponse;
}

/**
 * A persisted version of {@link TapeRecord}.
 */
export interface PersistedTapeRecord {
  request: {
    method: string;
    path: string;
    headers: HttpHeaders;
    body: PersistedBuffer;
  };
  response: {
    status: {
      code: number;
    };
    headers: HttpHeaders;
    body: PersistedBuffer;
  };
}

/**
 * A buffer that can be persisted in JSON.
 */
export type PersistedBuffer =
  | {
      encoding: "base64";
      data: string;
    }
  | {
      encoding: "utf8";
      compression: CompressionAlgorithm;
      data: string;
    };

export type CompressionAlgorithm = "br" | "gzip" | "none";
