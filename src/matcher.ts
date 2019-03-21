import { computeSimilarity } from "./similarity";
import { Headers, TapeRecord } from "./tape";

/**
 * Returns the first of a list of records that hasn't been replayed before.
 *
 * This is useful to ensure that when multiple requests to the same endpoint
 * have been recorded, each of them is replayed in the same order.
 *
 * If there are more requests to be replayed than we have recorded, this will
 * always pick the last one.
 *
 * @param records A list of records (e.g. returned by findRecordMatches).
 * @param tapeReplayCount A set of tape records that have been replayed before.
 */
export function findFirstLeastUsedRecord(
  records: TapeRecord[],
  replayedTapes: Set<TapeRecord>
): TapeRecord | null {
  // Look for a record that hasn't been replayed yet.
  for (const record of records) {
    if (!replayedTapes.has(record)) {
      replayedTapes.add(record);
      return record;
    }
  }

  // OK, we didn't find one. Return the last one, if there's any.
  if (records.length === 0) {
    return null;
  } else {
    return records[records.length - 1];
  }
}

/**
 * Finds a list of "best matching records" for a particular request, in order
 * of execution.
 *
 * For example if three requests had been recorded to /pets, there will be three
 * records returned when a request for /pets is matched (but no other records
 * against different paths).
 */
export function findRecordMatches(
  tapeRecords: TapeRecord[],
  requestMethod: string,
  requestPath: string,
  requestHeaders: Headers,
  requestBody: Buffer
): TapeRecord[] {
  const potentialMatches = tapeRecords.filter(
    record =>
      record.request.method === requestMethod &&
      pathWithoutQueryParameters(record.request.path) ===
        pathWithoutQueryParameters(requestPath)
  );
  let bestSimilarityScore = +Infinity;
  let bestMatches: TapeRecord[] = [];
  for (const potentialMatch of potentialMatches) {
    const similarityScore = computeSimilarity(
      requestPath,
      requestHeaders,
      requestBody,
      potentialMatch
    );

    if (similarityScore < bestSimilarityScore) {
      bestSimilarityScore = similarityScore;
      bestMatches = [potentialMatch];
    } else if (similarityScore === bestSimilarityScore) {
      bestMatches.push(potentialMatch);
    }
  }
  if (isFinite(bestSimilarityScore)) {
    return bestMatches;
  } else {
    return [];
  }
}

function pathWithoutQueryParameters(path: string) {
  const questionMarkPosition = path.indexOf("?");
  if (questionMarkPosition !== -1) {
    return path.substr(0, questionMarkPosition);
  } else {
    return path;
  }
}
