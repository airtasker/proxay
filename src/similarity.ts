import { diff } from "deep-diff";
import { parse as parseQueryString, ParsedUrlQuery } from "querystring";
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
  // If the HTTP method is different, no match.
  if (requestMethod !== compareTo.request.method) {
    return +Infinity;
  }

  // If the path is different (apart from query parameters), no match.
  if (
    pathWithoutQueryParameters(requestPath) !==
    pathWithoutQueryParameters(compareTo.request.path)
  ) {
    return +Infinity;
  }

  // Compare the query parameters.
  const parsedQueryParameters = parseQueryParameters(requestPath);
  const parsedCompareToQueryParameters = parseQueryParameters(
    compareTo.request.path,
  );
  const differencesQueryParameters = countObjectDifferences(
    parsedQueryParameters,
    parsedCompareToQueryParameters,
    rewriteBeforeDiffRules,
  );

  // Compare the cleaned headers.
  const cleanedHeaders = stripExtraneousHeaders(requestHeaders);
  const cleanedCompareToHeaders = stripExtraneousHeaders(
    compareTo.request.headers,
  );
  const differencesHeaders = countObjectDifferences(
    cleanedHeaders,
    cleanedCompareToHeaders,
    rewriteBeforeDiffRules,
  );

  // Compare the bodies.
  const serialisedRequestBody = serialiseBuffer(requestBody, requestHeaders);
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
        // Ignore.
        continue;
      default:
        safeHeaders[key] = headers[key];
    }
  }
  return safeHeaders;
}
