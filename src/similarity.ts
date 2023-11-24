import { diff } from "deep-diff";
import { parse as parseQueryString, ParsedUrlQuery } from "querystring";
import { compareTwoStrings } from "string-similarity";
import { RewriteRules } from "./rewrite";
import { serialiseBuffer } from "./persistence";
import { PersistedBuffer, TapeRecord } from "./tape";
import { HttpHeaders, HttpRequest } from "./core";

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
  const serialisedRequestBody = serialiseBuffer(request.body, request.headers);
  const serialisedCompareToRequestBody = serialiseBuffer(
    compareTo.request.body,
    compareTo.request.headers,
  );
  const differencesBody = countBodyDifferences(
    serialisedRequestBody,
    serialisedCompareToRequestBody,
    rewriteBeforeDiffRules,
  );

  return differencesQueryParameters + differencesHeaders + differencesBody;
}

/**
 * Returns the numbers of differences between two persisted body buffers.
 */
function countBodyDifferences(
  a: PersistedBuffer,
  b: PersistedBuffer,
  rewriteBeforeDiffRules: RewriteRules,
): number {
  if (a.encoding === "utf8" && b.encoding === "utf8") {
    try {
      const requestBodyJson = JSON.parse(a.data || "{}");
      const recordBodyJson = JSON.parse(b.data || "{}");
      // Return the number of fields that differ in JSON.
      return countObjectDifferences(
        requestBodyJson,
        recordBodyJson,
        rewriteBeforeDiffRules,
      );
    } catch (e) {
      return countStringDifferences(a.data, b.data, rewriteBeforeDiffRules);
    }
  } else if (a.encoding === "base64" && b.encoding === "base64") {
    return countStringDifferences(a.data, b.data, rewriteBeforeDiffRules);
  } else {
    // If we couldn't compare, then we'll assume they don't match.
    return +Infinity;
  }
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
