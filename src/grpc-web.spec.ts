import { convertGrpcWebRequestToObject, exportsForTesting } from "./grpc-web";
const { getGrpcMessageFormatFromContentType } = exportsForTesting;

describe("getGrpcMessageFormatFromContentType", () => {
  it("returns proto when no type is specified", () => {
    expect(getGrpcMessageFormatFromContentType("application/grpc-web")).toEqual(
      "proto",
    );
  });

  it("returns the type when known type is specified", () => {
    expect(
      getGrpcMessageFormatFromContentType("application/grpc-web+proto"),
    ).toEqual("proto");
    expect(
      getGrpcMessageFormatFromContentType("application/grpc-web+json"),
    ).toEqual("json");
  });

  it("returns other when an unknown type is specified", () => {
    expect(
      getGrpcMessageFormatFromContentType("application/grpc-web+thrift"),
    ).toEqual("other");
  });
});

describe("convertGrpcWebRequestToObject", () => {
  describe("json", () => {
    const contentType = "application/grpc-web+json";

    it("decodes a simple payload correctly", () => {
      const obj = convertGrpcWebRequestToObject(
        contentType,
        Buffer.from([
          0x00, 0x00, 0x00, 0x00, 0x1f, 0x7b, 0x22, 0x6e, 0x61, 0x6d, 0x65,
          0x22, 0x3a, 0x20, 0x22, 0x4a, 0x61, 0x6e, 0x65, 0x20, 0x44, 0x6f,
          0x65, 0x22, 0x2c, 0x20, 0x22, 0x61, 0x67, 0x65, 0x22, 0x3a, 0x20,
          0x34, 0x32, 0x7d,
        ]),
      );
      expect(obj).toEqual({ name: "Jane Doe", age: 42 });
    });
  });

  describe("proto", () => {
    const contentType = "application/grpc-web+proto";

    it("decodes a simple payload correctly", () => {
      const obj = convertGrpcWebRequestToObject(
        contentType,
        Buffer.from([
          0x00, 0x00, 0x00, 0x00, 0x0c, 0x0a, 0x08, 0x4a, 0x61, 0x6e, 0x65,
          0x20, 0x44, 0x6f, 0x65, 0x10, 0x2a,
        ]),
      );
      expect(obj).toEqual({ 1: ["Jane Doe"], 2: [42] });
    });
  });
});
