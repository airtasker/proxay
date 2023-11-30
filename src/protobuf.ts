/**
 * Protobuf wire encoding: https://protobuf.dev/programming-guides/encoding/
 */
// From: https://protobuf.dev/programming-guides/encoding/#structure
enum WireType {
  VARINT = 0 & 0x07,
  I64 = 1 & 0x07,
  LEN = 2 & 0x07,
  SGROUP = 3 & 0x07,
  EGROUP = 4 & 0x07,
  I32 = 5 & 0x07,
}

const NO_VALUE = {};

type Tag = {
  fieldNumber: number;
  wireType: WireType;
};

type WireValue =
  | string
  | number
  | bigint
  | Buffer
  | (number | bigint)[]
  | { [key: number]: WireValue[] };

class ParseError extends Error {}

export class ScannerError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class Scanner {
  private buffer: Buffer;
  private index: number;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
    this.index = 0;
  }

  ensureHasNMoreBytes(n: number) {
    if (!this.hasNMoreBytes(n)) {
      throw new ScannerError(
        `Attempted to read ${n} byte(s) but there aren't that many bytes left to read.`,
      );
    }
  }

  hasNMoreBytes(n: number): boolean {
    return this.index + n < this.buffer.length;
  }

  isAtEnd(): boolean {
    return this.index >= this.buffer.length;
  }

  readByte(): number {
    this.ensureHasNMoreBytes(1);

    const value = this.buffer.readUInt8();
    this.index += 1;
    return value;
  }

  readBytes(n: number): Buffer {
    this.ensureHasNMoreBytes(n);

    const value = this.buffer.subarray(this.index, this.index + n);
    this.index += n;
    return value;
  }

  read4BytesLE(): number {
    this.ensureHasNMoreBytes(4);

    const value = this.buffer.readUint32LE();
    this.index += 4;
    return value;
  }

  read8BytesLE(): bigint {
    this.ensureHasNMoreBytes(8);

    const value = this.buffer.readBigUInt64LE();
    this.index += 8;
    return value;
  }
}

/**
 * Heuristically attempt to convert a protobuf payload into an object. The protobuf wire encoding
 * is not self-descriptive not unambiguous. It is not possible to be able to decode a payload
 * without the original proto files. The heuristic part of this mapping comes in when attempting
 * to resolve the ambiguous parts of the wire format when you do not have the original proto files
 * informing you which option to take in the decoding process.
 *
 * @param payload The full protobuf payload.
 * @returns The object if conversion was able to take place. If any error occurred, null is returned.
 */
export function heuristicallyConvertProtoPayloadIntoObject(
  payload: Buffer,
): Record<number, WireValue[]> | null {
  const scanner = new Scanner(payload);
  let object: Record<number, WireValue[]> | null;
  try {
    object = readMessage(scanner);
  } catch (e) {
    if (e instanceof ScannerError) {
      return null;
    } else if (e instanceof ParseError) {
      return null;
    } else {
      throw e;
    }
  }
  if (scanner.isAtEnd()) {
    return object;
  } else {
    return null;
  }
}

/**
 * https://protobuf.dev/programming-guides/encoding/#varints
 */
function readVarint(scanner: Scanner): number {
  // Variable-width integers, or varints, are at the core of the wire format.
  // They allow encoding unsigned 64-bit integers using anywhere between one and ten bytes,
  // with small values using fewer bytes.
  //
  // Each byte in the varint has a continuation bit that indicates if the byte that follows
  // it is part of the varint. This is the most significant bit (MSB) of the byte (sometimes
  // also called the sign bit). The lower 7 bits are a payload; the resulting integer is
  // built by appending together the 7-bit payloads of its constituent bytes.
  let value: number = 0x00;
  let readMore: boolean = true;
  while (readMore) {
    const b = scanner.readByte();
    readMore = ((b >> 7) & 0x01) === 1;
    value = (value << 7) | (b & 0x7f);
  }
  return value;
}

// i32        := sfixed32 | fixed32 | float;
//               encoded as 4-byte little-endian;
//               memcpy of the equivalent C types (u?int32_t, float)
function readI32(scanner: Scanner): number {
  return scanner.read4BytesLE();
}

// i64        := sfixed64 | fixed64 | double;
//               encoded as 8-byte little-endian;
//               memcpy of the equivalent C types (u?int64_t, double)
function readI64(scanner: Scanner): bigint {
  return scanner.read8BytesLE();
}

// len-prefix := size (message | string | bytes | packed);
//               size encoded as int32 varint
function readLenPrefixed(scanner: Scanner): WireValue | null {
  const length = readVarint(scanner);
  const bytes = scanner.readBytes(length);

  if (isValidMessage(bytes)) {
    return heuristicallyConvertProtoPayloadIntoObject(bytes);
  } else if (isLikelyString(bytes)) {
    return readString(bytes);
  } else {
    // Assume it's just bytes.
    return bytes;
  }
}

function isLikelyString(buffer: Buffer): boolean {
  const decoder = new TextDecoder("utf8", { fatal: true });
  let text: string;
  try {
    text = decoder.decode(buffer);
  } catch (e) {
    return false;
  }

  // Some super rough heuristics. Count the number of characters that are control characters,
  // as well as how many are alnum. These heuristics won't work well if the text isn't primarily
  // English data. These heuristics could be improved or changed in the future.
  let length: number = 0;
  let nControlCharacters: number = 0;
  let nAlnumCharacters: number = 0;
  for (const char of text) {
    length += 1;
    const codePoint = char.codePointAt(0) || 0;

    // Is it a control character?
    if (codePoint < 0x20 || codePoint === 0x7f) {
      nControlCharacters += 1;
    }

    // Is it an alnum character?
    if (codePoint >= 0x20 && codePoint < 0x7f) {
      nAlnumCharacters += 1;
    }
  }

  if (nControlCharacters / length >= 0.1) {
    return false;
  } else if (nAlnumCharacters / length < 0.4) {
    return false;
  } else {
    return true;
  }
}

function readString(buffer: Buffer): string {
  return new TextDecoder("utf8", { fatal: true }).decode(buffer);
}

function isValidMessage(buffer: Buffer): boolean {
  return heuristicallyConvertProtoPayloadIntoObject(buffer) !== null;
}

// message    := (tag value)*
function readMessage(
  scanner: Scanner,
): Record<number, WireValue[]> | null {
  const object: Record<number, WireValue[]> = {};

  // Read as many values as we can.
  while (true) {
    // If we hit EOF, we're done.
    if (scanner.isAtEnd()) {
      break;
    }

    // Read the tag.
    const tag = readTag(scanner);

    // Read the value, using the tag information.
    const value = readValue(scanner, tag);
    if (value === null) {
      return null;
    }

    // Skip no-value values.
    if (Object.is(value, NO_VALUE)) {
      continue;
    }

    // Store the value against the field number in the returned payload.
    // We need to store one to many values against field numbers as `repeated` fields are
    // represented as multiple values on the wire.
    if (object[tag.fieldNumber] === undefined) {
      object[tag.fieldNumber] = [];
    }
    object[tag.fieldNumber].push(value);
  }

  return object;
}

// tag        := (field << 3) bit-or wire_type;
// encoded as uint32 varint
function readTag(scanner: Scanner): Tag {
  const value = readVarint(scanner);
  const wireType = (value & 0x07) as WireType;
  const fieldNumber = (value >> 3) & 0x1fffffff;
  return { fieldNumber, wireType };
}

// value      := varint      for wire_type == VARINT,
//               i32         for wire_type == I32,
//               i64         for wire_type == I64,
//               len-prefix  for wire_type == LEN,
//               <empty>     for wire_type == SGROUP or EGROUP
function readValue(scanner: Scanner, tag: Tag): WireValue | null {
  switch (tag.wireType) {
    case WireType.VARINT:
      return readVarint(scanner);
    case WireType.I32:
      return readI32(scanner);
    case WireType.I64:
      return readI64(scanner);
    case WireType.LEN:
      return readLenPrefixed(scanner);
    case WireType.SGROUP:
      return NO_VALUE;
    case WireType.EGROUP:
      return NO_VALUE;
  }
  return null;
}
