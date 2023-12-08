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
