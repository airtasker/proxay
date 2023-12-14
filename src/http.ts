import { ParsedMediaType as ParsedContentType } from "content-type";
import {
  convertHttpContentEncodingToCompressionAlgorithm,
  decompressBuffer,
} from "./compression";

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

export function getHttpHeaderAsString(
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

export function getHttpContentEncoding(r: HttpRequest | HttpResponse): string {
  return getHttpHeaderAsString(r.headers, "content-encoding");
}

export function getHttpContentType(r: HttpRequest | HttpResponse): string {
  return (
    getHttpHeaderAsString(r.headers, "content-type") ||
    "application/octet-stream"
  );
}

export function getHttpBodyDecoded(r: HttpRequest | HttpResponse): Buffer {
  const contentEncoding = getHttpHeaderAsString(r.headers, "content-encoding");
  const compressionAlgorithm =
    convertHttpContentEncodingToCompressionAlgorithm(contentEncoding);
  return decompressBuffer(compressionAlgorithm, r.body);
}

export function decodeHttpBodyToString(
  r: HttpRequest | HttpResponse,
  contentType: ParsedContentType,
): string {
  const encoding = contentType.parameters.charset as BufferEncoding | undefined;
  return getHttpBodyDecoded(r).toString(encoding || "utf-8");
}
