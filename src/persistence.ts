import brotli from "brotli";
import fs from "fs-extra";
import yaml from "js-yaml";
import path from "path";
import {
  CompressionAlgorithm,
  Headers,
  PersistedBuffer,
  PersistedTapeRecord,
  TapeRecord
} from "./tape";

/**
 * Persistence layer to save tapes to disk and read them from disk.
 */
export class Persistence {
  constructor(private tapeDir: string) {}

  /**
   * Saves the tape to disk.
   */
  saveTapeToDisk(tapeName: string, tapeRecords: TapeRecord[]) {
    const persistedTapeRecords = tapeRecords.map(persistTape);
    const tapePath = this.getTapePath(tapeName);
    fs.ensureDirSync(path.dirname(tapePath));
    fs.writeFileSync(
      tapePath,
      yaml.safeDump({
        http_interactions: persistedTapeRecords
      }),
      "utf8"
    );
  }

  /**
   * Loads the tape from disk.
   */
  loadTapeFromDisk(tapeName: string): TapeRecord[] {
    const tapePath = this.getTapePath(tapeName);
    if (!fs.existsSync(tapePath)) {
      throw new Error(`No tape found with name ${tapeName}`);
    }
    const persistedTapeRecords = yaml.safeLoad(
      fs.readFileSync(tapePath, "utf8")
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

export function persistTape(record: TapeRecord): PersistedTapeRecord {
  return {
    request: {
      method: record.request.method,
      path: record.request.path,
      headers: record.request.headers,
      body: serialiseBuffer(
        record.request.body,
        contentEncodingHeader(record.request.headers)
      )
    },
    response: {
      status: record.response.status,
      headers: record.response.headers,
      body: serialiseBuffer(
        record.response.body,
        contentEncodingHeader(record.response.headers)
      )
    }
  };
}

export function reviveTape(persistedRecord: PersistedTapeRecord): TapeRecord {
  return {
    request: {
      method: persistedRecord.request.method,
      path: persistedRecord.request.path,
      headers: persistedRecord.request.headers,
      body: unserialiseBuffer(persistedRecord.request.body)
    },
    response: {
      status: persistedRecord.response.status,
      headers: persistedRecord.response.headers,
      body: unserialiseBuffer(persistedRecord.response.body)
    }
  };
}

function contentEncodingHeader(headers: Headers) {
  const header = headers["content-encoding"];
  return typeof header === "string" ? header : undefined;
}

function serialiseBuffer(
  buffer: Buffer,
  contentEncoding: string | undefined
): PersistedBuffer {
  let originalBuffer = buffer;
  let compression: CompressionAlgorithm = "none";
  if (contentEncoding === "br") {
    buffer = Buffer.from(brotli.decompress(buffer));
    compression = "br";
  }
  const utf8Representation = buffer.toString("utf8");
  try {
    // Can it be safely stored and recreated in YAML?
    const recreatedBuffer = Buffer.from(
      yaml.safeLoad(yaml.safeDump(utf8Representation)),
      "utf8"
    );
    if (Buffer.compare(buffer, recreatedBuffer) === 0) {
      // Yes, we can store it in YAML.
      return {
        encoding: "utf8",
        data: utf8Representation,
        compression
      };
    }
  } catch {
    // Fall through.
  }
  // No luck. Fall back to Base64, persisting the original buffer
  // since we might as well store it in its compressed state.
  return {
    encoding: "base64",
    data: originalBuffer.toString("base64")
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
      if (persisted.compression === "br") {
        // TODO: Find a workaround for the new compressed message not necessarily
        // being identical to what was originally sent (update Content-Length?).
        const compressed = brotli.compress(buffer);
        if (compressed) {
          buffer = Buffer.from(compressed);
        } else {
          throw new Error(`Brotli compression failed!`);
        }
      }
      break;
    default:
      throw new Error(`Unsupported encoding!`);
  }
  return buffer;
}
