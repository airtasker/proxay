/**
 * gRPC-web specification: https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-WEB.md
 * gRPC specification: https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-HTTP2.md
 *
 * Length-Prefixed-Message → Compressed-Flag Message-Length Message
 * Compressed-Flag → 0 / 1 # encoded as 1 byte unsigned integer
 * Message-Length → {length of Message} # encoded as 4 byte unsigned integer (big endian)
 * Message → *{binary octet}
 */

export type GrpcMessageFormat = "proto" | "json" | "other";

/**
 * Heuristically attempts to convert a gRPC request body into an object.
 *
 * @param contentType The content-type of the request.
 * @param body The body of the request.
 * @returns The body heuristically converted into an object, or null if conversion failed.
 */
export function convertGrpcWebRequestToObject(
  contentType: string,
  body: Buffer,
): object | null {
  // A gRPC request must contain an initial byte to indicate compression, followed by a 4 byte length value.
  // Early bail if we do not have at least 5 bytes as this is not a valid gRPC request.
  if (body.length < 5) {
    return null;
  }

  const compressionEnabled = body.readUInt8(0) === 1;
  const messageLength = body.readUint32BE(1);

  // We currently don't know how to handle compressed requests. Bail if it is compressed.
  if (compressionEnabled) {
    return null;
  }

  // If the length of the body buffer does not match the message length, early bail as this is
  // not a valid gRPC request.
  if (body.length < messageLength + 5) {
    return null;
  }

  // Work out what message format is being used for the message itself.
  const message = body.subarray(5);
  switch (getGrpcMessageFormatFromContentType(contentType)) {
    case "json":
      return convertJsonMessageToObject(message);
    case "proto":
      return convertProtoMessageToObject(message);
    case "other":
      return null;
  }
}

export function getGrpcMessageFormatFromContentType(
  contentType: string,
): GrpcMessageFormat {
  // Find the index of the `+` within the Content-Type.
  const plusIndex = contentType.indexOf("+");

  // If there is no `+`, assume that it is proto, as per the spec:
  //
  //   the receiver should assume the default is "+proto" when the message format is missing in Content-Type (as "application/grpc-web")
  if (plusIndex === -1) {
    return "proto";
  }

  // Convert the value in the Content-Type header into a known gRPC message format.
  const messageFormat = contentType.substring(plusIndex + 1);
  switch (messageFormat) {
    case "proto":
      return "proto";
    case "json":
      return "json";
    default:
      return "other";
  }
}

function convertJsonMessageToObject(message: Buffer): object | null {
  const text = message.toString("utf-8");
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function convertProtoMessageToObject(message: Buffer): object | null {
  return null;
}
