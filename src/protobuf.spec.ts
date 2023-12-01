import {
  heuristicallyConvertProtoPayloadIntoObject,
  readVarint,
  Scanner,
} from "./protobuf";

describe("heuristicallyConvertProtoPayloadIntoObject", () => {
  it("correctly converts a very simple case", () => {
    const buffer = Buffer.from([0x08, 0x96, 0x01]);
    const object = heuristicallyConvertProtoPayloadIntoObject(buffer);
    expect(object).toEqual({ 1: [150] });
  });
});

describe("readVarint", () => {
  it("works for a 1-byte varint", () => {
    const scanner = new Scanner(Buffer.from([0x08]));
    const value = readVarint(scanner);
    expect(value).toEqual(8);
    expect(scanner.isAtEnd()).toBeTruthy();
  });

  it("works for a 2-byte varint", () => {
    const scanner = new Scanner(Buffer.from([0x96, 0x01]));
    const value = readVarint(scanner);
    expect(value).toEqual(150);
    expect(scanner.isAtEnd()).toBeTruthy();
  });

  it("works for a 3-byte varint", () => {
    const scanner = new Scanner(Buffer.from([0xc0, 0xc4, 0x07]));
    const value = readVarint(scanner);
    expect(value).toEqual(123456);
    expect(scanner.isAtEnd()).toBeTruthy();
  });
});
