import brotli from "brotli";
import zlib from "zlib";

export type CompressionAlgorithm = "br" | "gzip" | "none";

export function compressBuffer(
  algorithm: CompressionAlgorithm,
  buffer: Buffer,
): Buffer {
  switch (algorithm) {
    case "none":
      return buffer;
    case "br":
      const compressed = brotli.compress(buffer);
      if (compressed !== null) {
        return Buffer.from(compressed);
      } else {
        throw new Error(`Brotli compression failed!`);
      }
    case "gzip":
      return zlib.gzipSync(buffer);
  }
}

export function decompressBuffer(
  algorithm: CompressionAlgorithm,
  buffer: Buffer,
): Buffer {
  switch (algorithm) {
    case "none":
      return buffer;
    case "br":
      return Buffer.from(brotli.decompress(buffer));
    case "gzip":
      return zlib.gunzipSync(buffer);
  }
}

export function convertHttpContentEncodingToCompressionAlgorithm(
  contentEncoding: string,
): CompressionAlgorithm {
  switch (contentEncoding) {
    case "":
      return "none";
    case "br":
      return "br";
    case "gzip":
      return "gzip";
    default:
      throw new Error(`Unhandled content-encoding value "${contentEncoding}"`);
  }
}
