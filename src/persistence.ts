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
  private writeQueues = new Map<string, Promise<void>>();

  constructor(
    private readonly tapeDir: string,
    private readonly redactHeaders: string[],
    private readonly redactBodyFields: string[],
  ) {}

  /**
   * Enqueues an async write operation for a given tape path,
   * ensuring writes to the same tape are serialized.
   */
  private enqueueWrite(
    tapePath: string,
    fn: () => Promise<void>,
  ): Promise<void> {
    const prev = this.writeQueues.get(tapePath) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    this.writeQueues.set(tapePath, next);
    return next;
  }

  /**
   * Initializes an empty tape on disk with just the YAML header.
   */
  async initTapeOnDisk(tapeName: string): Promise<void> {
    const tapePath = this.getTapePath(tapeName);
    await fs.ensureDir(path.dirname(tapePath));
    await this.enqueueWrite(tapePath, () =>
      fs.writeFile(tapePath, "http_interactions:\n", "utf8"),
    );
  }

  /**
   * Appends a single record to the tape on disk (O(1) per call).
   */
  async appendRecordToDisk(
    tapeName: string,
    record: TapeRecord,
  ): Promise<void> {
    const redacted = this.redact(record);
    const persisted = persistTape(redacted);
    const tapePath = this.getTapePath(tapeName);

    // Serialize just this one record as a YAML array item
    const fragment = yaml.dump([persisted]);
    // Indent by 2 spaces to nest under "http_interactions:"
    const indented = fragment.replace(/^(.)/gm, "  $1");

    await this.enqueueWrite(tapePath, async () => {
      await fs.ensureDir(path.dirname(tapePath));
      // If the tape file doesn't exist (e.g. directory was cleaned),
      // recreate the header before appending.
      const exists = await fs.pathExists(tapePath);
      if (!exists) {
        await fs.writeFile(tapePath, "http_interactions:\n", "utf8");
      }
      await fs.appendFile(tapePath, indented, "utf8");
    });
  }

  /**
   * Saves the entire tape to disk. Only used for full rewrites (not on the hot path).
   */
  async saveTapeToDisk(
    tapeName: string,
    tapeRecords: TapeRecord[],
  ): Promise<void> {
    const persistedTapeRecords = tapeRecords
      .map(this.redact, this)
      .map(persistTape);
    const tapePath = this.getTapePath(tapeName);
    await fs.ensureDir(path.dirname(tapePath));
    await this.enqueueWrite(tapePath, () =>
      fs.writeFile(
        tapePath,
        yaml.dump({
          http_interactions: persistedTapeRecords,
        }),
        "utf8",
      ),
    );
  }

  /**
   * Redacts the request headers and body fields of the given record
   */
  private redact(record: TapeRecord): TapeRecord {
    redactRequestHeaders(record, this.redactHeaders);
    redactRecordBodyFields(record, this.redactBodyFields);
    return record;
  }

  /**
   * Loads the tape from disk.
   */
  async loadTapeFromDisk(tapeName: string): Promise<TapeRecord[]> {
    const tapePath = this.getTapePath(tapeName);
    const exists = await fs.pathExists(tapePath);
    if (!exists) {
      throw new Error(`No tape found with name ${tapeName}`);
    }
    const content = await fs.readFile(tapePath, "utf8");
    const parsed = yaml.load(content) as Record<string, any>;
    const persistedTapeRecords = parsed.http_interactions as
      | PersistedTapeRecord[]
      | undefined;
    return persistedTapeRecords ? persistedTapeRecords.map(reviveTape) : [];
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

/**
 * Redacts JSON body fields in request and response bodies
 */
export function redactRecordBodyFields(
  record: TapeRecord,
  redactFields: string[],
) {
  if (redactFields.length === 0) {
    return;
  }

  // Redact request body
  record.request.body = redactBufferFields(record.request.body, redactFields);

  // Redact response body
  record.response.body = redactBufferFields(record.response.body, redactFields);
}

/**
 * Redacts fields in a Buffer by parsing as JSON if possible
 */
function redactBufferFields(buffer: Buffer, redactFields: string[]): Buffer {
  if (!buffer || buffer.length === 0) {
    return buffer;
  }

  try {
    const bodyString = buffer.toString("utf8");
    const parsed = JSON.parse(bodyString);

    // Recursively redact fields
    redactObjectFields(parsed, redactFields);

    // Convert back to buffer
    return Buffer.from(JSON.stringify(parsed), "utf8");
  } catch (e) {
    // If not JSON or can't parse, return original buffer
    return buffer;
  }
}

/**
 * Recursively redacts fields in an object or array
 */
function redactObjectFields(obj: any, redactFields: string[]): void {
  if (typeof obj !== "object" || obj === null) {
    return;
  }

  if (Array.isArray(obj)) {
    // Handle arrays
    obj.forEach((item) => redactObjectFields(item, redactFields));
  } else {
    // Handle objects
    Object.keys(obj).forEach((key) => {
      // Check if this key should be redacted (case-insensitive)
      const shouldRedact = redactFields.some(
        (field) => field.toLowerCase() === key.toLowerCase(),
      );

      if (shouldRedact) {
        obj[key] = "XXXX";
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        // Recursively redact nested objects/arrays
        redactObjectFields(obj[key], redactFields);
      }
    });
  }
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
      buffer = compressBuffer(persisted.compression || "none", buffer);
      break;
    default:
      throw new Error(`Unsupported encoding!`);
  }
  return buffer;
}
