declare module "brotli" {
  /**
   * Compresses the data.
   *
   * If the compressed size isn't better, returns null.
   */
  function compress(data: Uint8Array): Uint8Array | null;

  /**
   * Uncompresses the data.
   */
  function decompress(
    compressedData: Uint8Array,
    decompressedLength?: number,
  ): Uint8Array;
}
