# Proxay — Agent Context

Read the **[README](README.md)** for what Proxay is, its modes, CLI options, and the tape control API. This file covers only what the README doesn't.

---

## Project Layout

```
src/
  cli.ts         # Entry point; parses CLI args, instantiates RecordReplayServer
  server.ts      # Core proxy — request handling, mode dispatch, tape management (537 lines)
  similarity.ts  # computeSimilarity() — numeric distance between a request and a record (373 lines)
  matcher.ts     # findRecordMatches() and findNextRecordToReplay()
  persistence.ts # YAML tape I/O, redaction, buffer encoding/decoding
  sender.ts      # send() — makes the actual HTTP/HTTPS request to the backend
  rewrite.ts     # Regex rewrite rules applied before matching
  http.ts        # HttpRequest, HttpResponse, HttpHeaders types + body helpers
  tape.ts        # TapeRecord and PersistedTapeRecord type definitions
  compression.ts # gzip / brotli compress/decompress
  grpc-web.ts    # gRPC-web framing parser (used during similarity comparison)
  protobuf.ts    # Schema-free heuristic protobuf decoder (used for gRPC-web)
  tests/
    setup.ts     # setupServers() helper used by all integration tests
    testserver.ts# Fake backend (endpoints: /simpletext, /utf8, /binary, /json/identity)
    config.ts    # Port constants: PROXAY_PORT=4000, TEST_SERVER_PORT=4001
    tapes/       # Checked-in YAML fixtures for replay-mode tests
```

---

## Non-obvious Architecture

**Dual HTTP/HTTPS on one port** — `server.ts` peeks at the first byte of each TCP connection. Byte `0x16` = TLS ClientHello → HTTPS handler; ASCII range → plain HTTP. The byte is re-injected via `socket.unshift()`.

**Similarity scoring** — `computeSimilarity()` returns a numeric distance (`0` = perfect, `Infinity` = no match). All tape records are scored and the lowest wins (fuzzy by default; `--exact-request-matching` restricts to score `0`). Comparison short-circuits to Infinity on method or path mismatch before touching headers or body.

**Tape replay ordering** — when the same request is recorded multiple times, replays are served in order. `server.ts` tracks consumed records in a `replayedTapes: Set<TapeRecord>`, falling back to the last record once all are exhausted.

**Rewrite rules apply at match time, not record time** — rewrites normalise requests before comparison only; the tape on disk is never modified.

**Buffer encoding** — `persistence.ts` stores bodies as UTF-8 when safe (validated via YAML round-trip), falling back to base64. Compression algorithm is stored as a separate field for faithful reconstruction.

**Redaction is in-memory before persist** — redaction runs inside `saveTapeToDisk()`, so the live `TapeRecord` retains real values; only the written YAML is sanitised.

---

## Commands

```bash
pnpm test        # Run all tests (single-threaded — tests share fixed ports)
pnpm build       # Compile TypeScript → dist/
pnpm lint:fix    # Auto-fix formatting
pnpm start:hot   # Run with hot reload (development)
```

---

## Testing

All integration tests use `setupServers({ mode, tapeDirName })` from `tests/setup.ts`, which starts both the fake backend and `RecordReplayServer` and wires up Jest lifecycle hooks.

**Gotchas:**
- Tests **must** run single-threaded (`--runInBand`) — all tests share ports 4000 and 4001.
- Replay-mode tests read checked-in fixtures from `src/tests/tapes/`. If serialisation format changes, regenerate them by running those tests in record mode first.
- `protobuf.ts` is a best-effort heuristic decoder with no schema; it may misclassify ambiguous payloads.
