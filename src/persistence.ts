import fs from "fs-extra";
import yaml from "js-yaml";
import path from "path";
import {
  compressBuffer,
  convertHttpContentEncodingToCompressionAlgorithm,
} from "./compression";
import {
  getHttpBodyDecoded,
  getHttpContentEncoding,
  HttpRequest,
  HttpResponse,
} from "./http";
import { PersistedBuffer, PersistedTapeRecord, TapeRecord } from "./tape";

/**
 * Persistence layer to save tapes to disk and read them from disk.
 */
export class Persistence {
  constructor(
    private readonly tapeDir: string,
    private readonly redactHeaders: string[],
  ) {}

  /**
   * Saves the tape to disk.
   */
  saveTapeToDisk(tapeName: string, tapeRecords: TapeRecord[]) {
    const persistedTapeRecords = tapeRecords
      .map(this.redact, this)
      .map(persistTape);
    const tapePath = this.getTapePath(tapeName);
    fs.ensureDirSync(path.dirname(tapePath));
    fs.writeFileSync(
      tapePath,
      yaml.dump({
        http_interactions: persistedTapeRecords,
      }),
      "utf8",
    );
  }

  /**
   * Redacts the request headers of the given record, depending on the redactHeaders array
   */
  private redact(record: TapeRecord): TapeRecord {
    redactRequestHeaders(record, this.redactHeaders);
    return record;
  }

  /**
   * Loads the tape from disk.
   */
  loadTapeFromDisk(tapeName: string): TapeRecord[] {
    const tapePath = this.getTapePath(tapeName);
    if (!fs.existsSync(tapePath)) {
      throw new Error(`No tape found with name ${tapeName}`);
    }
    const persistedTapeRecords = (
      yaml.load(fs.readFileSync(tapePath, "utf8")) as Record<string, any>
    ).http_interactions as PersistedTapeRecord[];
    return persistedTapeRecords.map(reviveTape);
  }

  isTapeNameValid(tapeName: string): boolean {
    return !path
      .relative(this.tapeDir, path.join(this.tapeDir, tapeName))
      .startsWith("../");
  }

  /**
   * Returns the tape's path on disk.
   */
  private getTapePath(tapeName: string) {
    return path.join(this.tapeDir, `${tapeName}.yml`);
  }
}

/**
 * Redacts the headers of the given record based on the provided array of headers to redact
 */
export function redactRequestHeaders(
  record: TapeRecord,
  redactHeaders: string[],
) {
  redactHeaders.forEach((header) => {
    if (record.request.headers[header]) {
      record.request.headers[header] = "XXXX";
    }
  });
}

export function persistTape(record: TapeRecord): PersistedTapeRecord {
  return {
    request: {
      method: record.request.method,
      path: record.request.path,
      headers: record.request.headers,
      body: serialiseForTape(record.request),
    },
    response: {
      status: record.response.status,
      headers: record.response.headers,
      body: serialiseForTape(record.response),
    },
  };
}

export function reviveTape(persistedRecord: PersistedTapeRecord): TapeRecord {
  return {
    request: {
      method: persistedRecord.request.method,
      path: persistedRecord.request.path,
      headers: persistedRecord.request.headers,
      body: unserialiseBuffer(persistedRecord.request.body),
    },
    response: {
      status: persistedRecord.response.status,
      headers: persistedRecord.response.headers,
      body: unserialiseBuffer(persistedRecord.response.body),
    },
  };
}

function serialiseForTape(r: HttpRequest | HttpResponse): PersistedBuffer {
  const buffer = getHttpBodyDecoded(r);
  const contentEncoding = getHttpContentEncoding(r);
  const compressionAlgorithm =
    convertHttpContentEncodingToCompressionAlgorithm(contentEncoding);

  const utf8Representation = buffer.toString("utf8");
  try {
    // Can it be safely stored and recreated in YAML?
    const recreatedBuffer = Buffer.from(
      yaml.load(yaml.dump(utf8Representation)) as string,
      "utf8",
    );
    if (Buffer.compare(buffer, recreatedBuffer) === 0) {
      // Yes, we can store it in YAML.
      return {
        encoding: "utf8",
        data: utf8Representation,
        compression: compressionAlgorithm,
      };
    }
  } catch {
    // Fall through.
  }

  // No luck. Fall back to Base64, persisting the original buffer
  // since we might as well store it in its compressed state.
  return {
    encoding: "base64",
    data: r.body.toString("base64"),
  };
}

function unserialiseBuffer(persisted: PersistedBuffer): Buffer {
  let buffer;
  switch (persisted.encoding) {
    case "base64":
      buffer = Buffer.from(persisted.data, "base64");
      break;
    case "utf8":
      buffer = Buffer.from(persisted.data, "utf8");
      buffer = compressBuffer(persisted.compression, buffer);
      break;
    default:
      throw new Error(`Unsupported encoding!`);
  }
  return buffer;
}
