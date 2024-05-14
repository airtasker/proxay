import { HttpRequest } from "./http";
import { RewriteRules } from "./rewrite";
import { computeSimilarity } from "./similarity";
import { TapeRecord } from "./tape";

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
export function findNextRecordToReplay(
  records: TapeRecord[],
  replayedTapes: Set<TapeRecord>,
): TapeRecord | null {
  // Look for a record that hasn't been replayed yet.
  for (const record of records) {
    if (!replayedTapes.has(record)) {
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
 * Also added boolean value match for strict request matching.
 */
export function findRecordMatches(
  request: HttpRequest,
  tapeRecords: TapeRecord[],
  rewriteBeforeDiffRules: RewriteRules,
  exactRequestMatching: boolean,
  debugMatcherFails: boolean,
  ignoreHeaders: string[],
): TapeRecord[] {
  let bestSimilarityScore = +Infinity;
  if (exactRequestMatching) {
    bestSimilarityScore = 0;
  }
  let bestMatches: TapeRecord[] = [];
  for (const potentialMatch of tapeRecords) {
    const similarityScore = computeSimilarity(
      request,
      potentialMatch,
      rewriteBeforeDiffRules,
      ignoreHeaders,
      debugMatcherFails,
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
