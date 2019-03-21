import { diff } from "deep-diff";
import queryString from "query-string";
import { serialiseBuffer } from "./persistence";
import { Headers, TapeRecord } from "./tape";

/**
 * Returns a "similarity score" a request and an existing record.
 *
 * The score is a number between 0 and +Infinity:
 * - 0 means "identical" (perfect match)
 * - +Infinity means "very different" (no match)
 */
export function computeSimilarity(
  requestPath: string,
  requestHeaders: Headers,
  requestBody: Buffer,
  compareTo: TapeRecord
): number {
  const parsedQuery = queryString.parse(requestPath);
  const parsedCompareToQuery = queryString.parse(compareTo.request.path);
  const serialisedRequestBody = serialiseBuffer(requestBody, requestHeaders);
  const serialisedCompareToRequestBody = serialiseBuffer(
    compareTo.request.body,
    compareTo.request.headers
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
      const differencesCount =
        (diff(requestBodyJson, recordBodyJson) || []).length +
        (diff(parsedQuery, parsedCompareToQuery) || []).length;
      if (differencesCount === 0) {
        return 0;
      } else {
        return differencesCount;
      }
    } catch (e) {
      // Ignore.
    }
  }
  // If we couldn't compare JSON, then we'll assume they don't match.
  return +Infinity;
}
