import { HttpRequest } from "./http";
import { RewriteRules } from "./rewrite";
import { computeSimilarity } from "./similarity";
import { TapeRecord } from "./tape";

export type TapeIndex = Map<string, TapeRecord[]>;

function indexKey(method: string, path: string): string {
  const qPos = path.indexOf("?");
  return qPos !== -1 ? `${method} ${path.substring(0, qPos)}` : `${method} ${path}`;
}

export function buildTapeIndex(records: TapeRecord[]): TapeIndex {
  const index: TapeIndex = new Map();
  for (const record of records) {
    const key = indexKey(record.request.method, record.request.path);
    let bucket = index.get(key);
    if (!bucket) {
      bucket = [];
      index.set(key, bucket);
    }
    bucket.push(record);
  }
  return index;
}

export function addToTapeIndex(index: TapeIndex, record: TapeRecord): void {
  const key = indexKey(record.request.method, record.request.path);
  let bucket = index.get(key);
  if (!bucket) {
    bucket = [];
    index.set(key, bucket);
  }
  bucket.push(record);
}

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
  index?: TapeIndex,
): TapeRecord[] {
  // Use index to narrow candidates by method+path if available
  const candidates = index
    ? (index.get(indexKey(request.method, request.path)) ?? [])
    : tapeRecords;

  let bestSimilarityScore = +Infinity;
  if (exactRequestMatching) {
    bestSimilarityScore = 0;
  }
  let bestMatches: TapeRecord[] = [];
  for (const potentialMatch of candidates) {
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
