import { diff } from "deep-diff";
import queryString from "query-string";
import { compareTwoStrings } from "string-similarity";
import { serialiseBuffer } from "./persistence";
import { Headers, TapeRecord } from "./tape";

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
  const serialisedRequestBody = serialiseBuffer(
    requestBody,
    stripExtraneousHeaders(requestHeaders)
  );
  const serialisedCompareToRequestBody = serialiseBuffer(
    compareTo.request.body,
    stripExtraneousHeaders(compareTo.request.headers)
  );
  if (
    serialisedRequestBody.encoding === "utf8" &&
    serialisedCompareToRequestBody.encoding === "utf8"
  ) {
    try {
      const requestBodyJson = JSON.parse(serialisedRequestBody.data || "{}");
      const recordBodyJson = JSON.parse(
        serialisedCompareToRequestBody.data || "{}"
      );
      // Return the number of fields that differ in JSON.
      const differencesCount =
        (diff(requestBodyJson, recordBodyJson) || []).length +
        (diff(parsedQuery, parsedCompareToQuery) || []).length;
      return differencesCount;
    } catch (e) {
      // Return the number of characters that differ between both strings.
      return (
        (compareTwoStrings(
          serialisedRequestBody.data,
          serialisedCompareToRequestBody.data
        ) *
          (serialisedRequestBody.data.length +
            serialisedCompareToRequestBody.data.length)) /
        2
      );
    }
  }
  // If we couldn't compare JSON, then we'll assume they don't match.
  return +Infinity;
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
