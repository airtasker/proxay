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
      return zlib.brotliCompressSync(buffer);
    case "gzip":
      return zlib.gzipSync(buffer);
    default:
      throw new Error(`Unhandled compression algorithm value "${algorithm}"`);
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
      return zlib.brotliDecompressSync(buffer);
    case "gzip":
      return zlib.gunzipSync(buffer);
    default:
      throw new Error(`Unhandled compression algorithm value "${algorithm}"`);
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
