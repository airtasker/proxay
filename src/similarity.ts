import { diff } from "deep-diff";
import queryString from "query-string";
import { compareTwoStrings } from "string-similarity";
import { serialiseBuffer } from "./persistence";
import { Headers, PersistedBuffer, TapeRecord } from "./tape";

/**
 * Returns a "similarity score" between a request and an existing record.
 *
 * The score is a number between 0 and +Infinity:
 * - 0 means "identical" (perfect match)
 * - +Infinity means "very different" (no match)
 */
export function computeSimilarity(
  requestMethod: string,
  requestPath: string,
  requestHeaders: Headers,
  requestBody: Buffer,
  compareTo: TapeRecord
): number {
  if (requestMethod !== compareTo.request.method) {
    // If the HTTP method is different, no match.
    return +Infinity;
  }
  if (
    pathWithoutQueryParameters(requestPath) !==
    pathWithoutQueryParameters(compareTo.request.path)
  ) {
    // If the path is different (apart from query parameters), no match.
    return +Infinity;
  }
  const parsedQuery = queryString.parse(requestPath);
  const parsedCompareToQuery = queryString.parse(compareTo.request.path);
  const headers = stripExtraneousHeaders(requestHeaders);
  const compareToHeaders = stripExtraneousHeaders(compareTo.request.headers);
  const serialisedRequestBody = serialiseBuffer(requestBody, requestHeaders);
  const serialisedCompareToRequestBody = serialiseBuffer(
    compareTo.request.body,
    compareTo.request.headers
  );
  return (
    countObjectDifferences(parsedQuery, parsedCompareToQuery) +
    countObjectDifferences(headers, compareToHeaders) +
    countBodyDifferences(serialisedRequestBody, serialisedCompareToRequestBody)
  );
}

/**
 * Returns the numbers of differences between two persisted body buffers.
 */
function countBodyDifferences(a: PersistedBuffer, b: PersistedBuffer): number {
  if (a.encoding === "utf8" && b.encoding === "utf8") {
    try {
      const requestBodyJson = JSON.parse(a.data || "{}");
      const recordBodyJson = JSON.parse(b.data || "{}");
      // Return the number of fields that differ in JSON.
      return countObjectDifferences(requestBodyJson, recordBodyJson);
    } catch (e) {
      return countStringDifferences(a.data, b.data);
    }
  }
  if (a.encoding === "base64" && b.encoding === "base64") {
    return countStringDifferences(a.data, b.data);
  }
  // If we couldn't compare, then we'll assume they don't match.
  return +Infinity;
}

/**
 * Returns the number of fields that differ between two objects.
 */
function countObjectDifferences(a: object, b: object) {
  return (diff(a, b) || []).length;
}

/**
 * Returns the number of characters that differ between two strings.
 */
function countStringDifferences(a: string, b: string) {
  // It looks like it's not JSON, so compare as strings.
  const stringSimilarityScore = compareTwoStrings(a, b);
  // compareTwoStrings() returns 0 for completely different strings,
  // and 1 for identical strings.
  const numberOfDifferentCharacters = Math.round(
    ((1 - stringSimilarityScore) * (a.length + b.length)) / 2
  );
  return numberOfDifferentCharacters;
}

function pathWithoutQueryParameters(path: string) {
  const questionMarkPosition = path.indexOf("?");
  if (questionMarkPosition !== -1) {
    return path.substr(0, questionMarkPosition);
  } else {
    return path;
  }
}

/**
 * Strips out headers that are likely to result in false negatives.
 */
function stripExtraneousHeaders(headers: Headers): Headers {
  const safeHeaders: Headers = {};
  for (const key of Object.keys(headers)) {
    switch (key) {
      case "accept":
      case "user-agent":
      case "host":
      case "connection":
        // Ignore.
        continue;
      default:
        safeHeaders[key] = headers[key];
    }
  }
  return safeHeaders;
}
