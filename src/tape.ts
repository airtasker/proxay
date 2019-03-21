/**
 * A record of a specific HTTP interaction (request + response).
 */
export interface TapeRecord {
  request: {
    method: string;
    path: string;
    headers: Headers;
    body: Buffer;
  };
  response: {
    status: {
      code: number;
    };
    headers: Headers;
    body: Buffer;
  };
}

/**
 * A persisted version of {@link TapeRecord}.
 */
export interface PersistedTapeRecord {
  request: {
    method: string;
    path: string;
    headers: Headers;
    body: PersistedBuffer;
  };
  response: {
    status: {
      code: number;
    };
    headers: Headers;
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
    }
  | {
      // Deprecated. Instead, we store JSON as utf8 so exact formatting is kept.
      encoding: "json";
      data: {};
    };

export type CompressionAlgorithm = "br" | "gzip" | "none";

/**
 * Headers of a request or response.
 */
export interface Headers {
  [headerName: string]: string | string[] | undefined;
}
