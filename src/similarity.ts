import {
  parse as parseContentType,
  ParsedMediaType as ParsedContentType,
} from "content-type";
import { diff } from "deep-diff";
import { parse as parseQueryString, ParsedUrlQuery } from "querystring";
import { compareTwoStrings } from "string-similarity";
import { RewriteRules } from "./rewrite";
import { TapeRecord } from "./tape";
import {
  decodeHttpRequestBodyToString,
  getHttpRequestContentType,
  HttpHeaders,
  HttpRequest,
} from "./http";

/**
 * Returns a "similarity score" between a request and an existing record.
 *
 * The score is a number between 0 and +Infinity:
 * - 0 means "identical" (perfect match)
 * - +Infinity means "very different" (no match)
 */
export function computeSimilarity(
  request: HttpRequest,
  compareTo: TapeRecord,
  rewriteBeforeDiffRules: RewriteRules,
): number {
  // If the HTTP method is different, no match.
  if (request.method !== compareTo.request.method) {
    return +Infinity;
  }

  // If the path is different (apart from query parameters), no match.
  if (
    pathWithoutQueryParameters(request.path) !==
    pathWithoutQueryParameters(compareTo.request.path)
  ) {
    return +Infinity;
  }

  // Compare the query parameters.
  const parsedQueryParameters = parseQueryParameters(request.path);
  const parsedCompareToQueryParameters = parseQueryParameters(
    compareTo.request.path,
  );
  const differencesQueryParameters = countObjectDifferences(
    parsedQueryParameters,
    parsedCompareToQueryParameters,
    rewriteBeforeDiffRules,
  );

  // Compare the cleaned headers.
  const cleanedHeaders = stripExtraneousHeaders(request.headers);
  const cleanedCompareToHeaders = stripExtraneousHeaders(
    compareTo.request.headers,
  );
  const differencesHeaders = countObjectDifferences(
    cleanedHeaders,
    cleanedCompareToHeaders,
    rewriteBeforeDiffRules,
  );

  // Compare the bodies.
  const differencesBody = countBodyDifferences(
    request,
    compareTo.request,
    rewriteBeforeDiffRules,
  );

  return differencesQueryParameters + differencesHeaders + differencesBody;
}

/**
 * Returns the numbers of differences between the bodies of two HTTP requests.
 */
function countBodyDifferences(
  request1: HttpRequest,
  request2: HttpRequest,
  rewriteBeforeDiffRules: RewriteRules,
): number {
  const contentType1 = parseContentType(getHttpRequestContentType(request1));
  const contentType2 = parseContentType(getHttpRequestContentType(request1));

  // If the content types are not the same, we cannot compare.
  if (contentType1.type !== contentType2.type) {
    return +Infinity;
  }

  const contentType = contentType1.type;
  if (contentType === "application/json") {
    return countBodyDifferencesApplicationJson(
      request1,
      contentType1,
      request2,
      contentType2,
      rewriteBeforeDiffRules,
    );
  } else if (contentType.startsWith("text/")) {
    return countBodyDifferencesText(
      request1,
      contentType1,
      request2,
      contentType2,
      rewriteBeforeDiffRules,
    );
  } else {
    // No more special cases to consider. Assume binary data for all other content types.
    return countBodyDifferencesBinary(request1, request2);
  }
}

function countBodyDifferencesApplicationJson(
  request1: HttpRequest,
  contentType1: ParsedContentType,
  request2: HttpRequest,
  contentType2: ParsedContentType,
  rewriteBeforeDiffRules: RewriteRules,
): number {
  // Decode the bodies to strings.
  const body1 = decodeHttpRequestBodyToString(request1, contentType1);
  const body2 = decodeHttpRequestBodyToString(request2, contentType2);

  // Early bail if bodies are empty.
  if (body1.length === 0 && body1.length === body2.length) {
    return 0;
  }

  // Attempt to parse both bodies as JSON.
  let json1: any;
  let json2: any;
  try {
    json1 = JSON.parse(body1);
    json2 = JSON.parse(body2);
  } catch (e) {
    // If we fail, fall back to a binary comparison.
    return countBodyDifferencesBinary(request1, request2);
  }

  // Return the number of fields that differ in JSON.
  return countObjectDifferences(json1, json2, rewriteBeforeDiffRules);
}

function countBodyDifferencesText(
  request1: HttpRequest,
  contentType1: ParsedContentType,
  request2: HttpRequest,
  contentType2: ParsedContentType,
  rewriteBeforeDiffRules: RewriteRules,
): number {
  // Decode the bodies to strings.
  const body1 = decodeHttpRequestBodyToString(request1, contentType1);
  const body2 = decodeHttpRequestBodyToString(request2, contentType2);

  // Early bail if bodies are empty.
  if (body1.length === 0 && body1.length === body2.length) {
    return 0;
  }

  // Return the number of differences.
  return countStringDifferences(body1, body2, rewriteBeforeDiffRules);
}

function countBodyDifferencesBinary(
  request1: HttpRequest,
  request2: HttpRequest,
): number {
  // Compare the bytes of each of the bodies using a textual edit distance comparison.
  const body1 = Array.from(request1.body)
    .map((v) => v.toString(16).padStart(2, "0"))
    .join(" ");
  const body2 = Array.from(request2.body)
    .map((v) => v.toString(16).padStart(2, "0"))
    .join(" ");
  return countStringDifferences(body1, body2, new RewriteRules());
}

/**
 * Returns the number of fields that differ between two objects.
 */
function countObjectDifferences(
  a: object,
  b: object,
  rewriteRules: RewriteRules,
): number {
  a = rewriteRules.apply(a);
  b = rewriteRules.apply(b);

  return (diff(a, b) || []).length;
}

/**
 * Returns the number of characters that differ between two strings.
 */
function countStringDifferences(
  a: string,
  b: string,
  rewriteRules: RewriteRules,
): number {
  // Apply the rewrite rules before computing any differences.
  a = rewriteRules.apply(a);
  b = rewriteRules.apply(b);

  // It looks like it's not JSON, so compare as strings.
  const stringSimilarityScore = compareTwoStrings(a, b);
  // compareTwoStrings() returns 0 for completely different strings,
  // and 1 for identical strings, and a number in between otherwise.
  const numberOfDifferentCharacters = Math.round(
    ((1 - stringSimilarityScore) * (a.length + b.length)) / 2,
  );
  return numberOfDifferentCharacters;
}

function pathWithoutQueryParameters(path: string): string {
  const questionMarkPosition = path.indexOf("?");
  if (questionMarkPosition !== -1) {
    return path.substring(0, questionMarkPosition);
  } else {
    return path;
  }
}

function parseQueryParameters(path: string): ParsedUrlQuery {
  const questionMarkPosition = path.indexOf("?");
  if (questionMarkPosition !== -1) {
    return parseQueryString(path.substring(questionMarkPosition + 1));
  } else {
    return {};
  }
}

/**
 * Strips out headers that are likely to result in false negatives.
 */
function stripExtraneousHeaders(headers: HttpHeaders): HttpHeaders {
  const safeHeaders: HttpHeaders = {};
  for (const key of Object.keys(headers)) {
    switch (key) {
      case "accept":
      case "accept-encoding":
      case "age":
      case "cache-control":
      case "clear-site-data":
      case "connection":
      case "expires":
      case "from":
      case "host":
      case "postman-token":
      case "pragma":
      case "referer":
      case "referer-policy":
      case "te":
      case "trailer":
      case "transfer-encoding":
      case "user-agent":
      case "warning":
        // Ignore.
        continue;
      default:
        safeHeaders[key] = headers[key];
    }
  }
  return safeHeaders;
}
