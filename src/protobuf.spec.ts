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

  it("correctly converts a more complex case", () => {
    const buffer = Buffer.from([
      0xa, 0x24, 0x61, 0x32, 0x37, 0x64, 0x66, 0x61, 0x64, 0x37, 0x2d, 0x65,
      0x33, 0x63, 0x33, 0x2d, 0x34, 0x39, 0x31, 0x62, 0x2d, 0x39, 0x61, 0x31,
      0x34, 0x2d, 0x39, 0x63, 0x39, 0x36, 0x63, 0x62, 0x61, 0x32, 0x32, 0x38,
      0x63, 0x61,
    ]);
    const object = heuristicallyConvertProtoPayloadIntoObject(buffer);
    expect(object).toEqual({ 1: ["a27dfad7-e3c3-491b-9a14-9c96cba228ca"] });
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
