declare module "brotli" {
  function compress(data: Uint8Array): Uint8Array;
  function decompress(
    compressedData: Uint8Array,
    uncompressedLength?: number
  ): Uint8Array;
}
