import { computeSimilarity } from "./similarity";
import { Headers, TapeRecord } from "./tape";

/**
 * Returns the first of a list of records that hasn't been replayed before.
 *
 * This is useful to ensure that when multiple requests to the same endpoint
 * have been recorded, each of them is replayed in the same order.
 *
 * If there are more requests to be replayed than we have recorded, this will
 * automatically "circle back around".
 *
 * @param records A list of records (e.g. returned by findRecordMatches)
 * @param tapeReplayCount A map for each tape record of the number of times it's
 * been replayed before.
 */
export function findFirstLeastUsedRecord(
  records: TapeRecord[],
  tapeReplayCount: Map<TapeRecord, number>
): TapeRecord | null {
  let minimalCount = +Infinity;
  let minimalIndex = -1;
  for (let i = 0; i < records.length; i++) {
    const count = tapeReplayCount.get(records[i]) || 0;
    if (count < minimalCount) {
      minimalCount = count;
      minimalIndex = i;
    }
  }
  if (minimalIndex === -1) {
    return null;
  }
  const bestMatch = records[minimalIndex];
  tapeReplayCount.set(bestMatch, minimalCount + 1);
  return bestMatch;
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
