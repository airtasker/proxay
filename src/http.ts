import brotli from "brotli";
import zlib from "zlib";
import { ParsedMediaType as ParsedContentType } from "content-type";

/**
 * Headers of a request or response.
 */
export interface HttpHeaders {
  [headerName: string]: string | string[] | undefined;
}

/**
 * The common fields of a HTTP request.
 */
export interface HttpRequest {
  host?: string;
  method: string;
  path: string;
  headers: HttpHeaders;
  body: Buffer;
}

export interface HttpRequestWithHost extends HttpRequest {
  host: string;
}

/**
 * The common fields of a HTTP response.
 */
export interface HttpResponse {
  status: {
    code: number;
  };
  headers: HttpHeaders;
  body: Buffer;
}

export function getHeaderAsString(
  headers: HttpHeaders,
  headerName: string,
): string {
  const rawValue = headers[headerName];
  if (rawValue === undefined) {
    return "";
  } else if (typeof rawValue === "string") {
    return rawValue;
  } else {
    return rawValue[0];
  }
}

export function getHttpRequestContentType(request: HttpRequest): string {
  return (
    getHeaderAsString(request.headers, "content-type") ||
    "application/octet-stream"
  );
}

export function getHttpRequestBodyDecoded(request: HttpRequest): Buffer {
  // Process the content-encoding before looking at the content-type.
  const contentEncoding = getHeaderAsString(
    request.headers,
    "content-encoding",
  );
  switch (contentEncoding) {
    case "":
      return request.body;
    case "br":
      return Buffer.from(brotli.decompress(request.body));
    case "gzip":
      return zlib.gunzipSync(request.body);
    default:
      throw Error(`Unhandled content-encoding value "${contentEncoding}"`);
  }
}

export function decodeHttpRequestBodyToString(
  request: HttpRequest,
  contentType: ParsedContentType,
): string {
  const encoding = contentType.parameters.charset as BufferEncoding | undefined;
  return getHttpRequestBodyDecoded(request).toString(encoding || "utf-8");
}
