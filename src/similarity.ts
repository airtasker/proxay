import { diff } from "deep-diff";
import queryString from "query-string";
import { compareTwoStrings } from "string-similarity";
import { RewriteRules } from "./rewrite";
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
  compareTo: TapeRecord,
  rewriteBeforeDiffRules: RewriteRules,
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
  const parsedQuery = queryParameters(requestPath);
  const parsedCompareToQuery = queryParameters(compareTo.request.path);
  const headers = stripExtraneousHeaders(requestHeaders);
  const compareToHeaders = stripExtraneousHeaders(compareTo.request.headers);
  const serialisedRequestBody = serialiseBuffer(requestBody, requestHeaders);
  const serialisedCompareToRequestBody = serialiseBuffer(
    compareTo.request.body,
    compareTo.request.headers,
  );
  return (
    countObjectDifferences(
      parsedQuery,
      parsedCompareToQuery,
      rewriteBeforeDiffRules,
    ) +
    countObjectDifferences(headers, compareToHeaders, rewriteBeforeDiffRules) +
    countBodyDifferences(
      serialisedRequestBody,
      serialisedCompareToRequestBody,
      rewriteBeforeDiffRules,
    )
  );
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
  }
  if (a.encoding === "base64" && b.encoding === "base64") {
    return countStringDifferences(a.data, b.data, rewriteBeforeDiffRules);
  }
  // If we couldn't compare, then we'll assume they don't match.
  return +Infinity;
}

/**
 * Returns the number of fields that differ between two objects.
 */
function countObjectDifferences(
  a: object,
  b: object,
  rewriteRules: RewriteRules,
) {
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
) {
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

function pathWithoutQueryParameters(path: string) {
  const questionMarkPosition = path.indexOf("?");
  if (questionMarkPosition !== -1) {
    return path.substr(0, questionMarkPosition);
  } else {
    return path;
  }
}

function queryParameters(path: string) {
  const questionMarkPosition = path.indexOf("?");
  if (questionMarkPosition !== -1) {
    return queryString.parse(path.substr(questionMarkPosition));
  } else {
    return {};
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
      case "x-datadog-trace-id":
      case "x-datadog-parent-id":
      case "traceparent":
        // Ignore.
        continue;
      default:
        safeHeaders[key] = headers[key];
    }
  }
  return safeHeaders;
}
