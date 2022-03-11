#!/usr/bin/env node

import chalk from "chalk";
import program from "commander";
import fs from "fs-extra";
import { RecordReplayServer } from "./server";

function commaSeparatedList(value: string) {
  return value ? value.split(",") : [];
}

async function main(argv: string[]) {
  program
    .option("-m, --mode <mode>", "Mode (record, replay or passthrough)")
    .option(
      "-t, --tapes-dir <tapes-dir>",
      "Directory in which to record/replay tapes"
    )
    .option("--default-tape <tape-name>", "Name of the default tape", "default")
    .option("-h, --host <host>", "Host to proxy (not required in replay mode)")
    .option("-p, --port <port>", "Local port to serve on", "3000")
    .option(
      "-r, --redact-headers <headers>",
      "Request headers to redact",
      commaSeparatedList
    )
    .option(
      "--no-drop-conditional-request-headers",
      "When running in record mode, by default, `If-*` headers from outgoing requests are dropped in an attempt to prevent the suite of conditional responses being returned (e.g. 304). Supplying this flag disables this default behaviour"
    )
    .parse(argv);

  const initialMode: string = (program.mode || "").toLowerCase();
  const tapeDir: string = program.tapesDir;
  const defaultTapeName: string = program.defaultTape;
  const host: string = program.host;
  const port = parseInt(program.port, 10);
  const redactHeaders: string[] = program.redactHeaders;
  const preventConditionalRequests: boolean = !!program.dropConditionalRequestHeaders;

  switch (initialMode) {
    case "record":
    case "replay":
    case "mimic":
    case "passthrough":
      // Valid modes.
      break;
    default:
      panic("Please specify a valid mode (record or replay).");
      throw new Error(); // only used for TypeScript control flow
  }

  if (!tapeDir && initialMode !== "passthrough") {
    panic("Please specify a path to a tapes directory.");
  }

  if (initialMode === "replay" && !fs.existsSync(tapeDir)) {
    panic(
      `No tapes found at ${tapeDir}. Did you mean to start in record mode?`
    );
  }

  if (preventConditionalRequests && initialMode === "record") {
    console.info(
      "The prevent conditional requests flag is enabled in record mode. All received `If-*` headers will not be forwarded on upstream and will not be recorded in tapes."
    );
  }

  // Expect a host unless we're in replay mode.
  if (initialMode !== "replay") {
    if (!host) {
      panic("Please specify a host.");
    }
    if (host.indexOf("://") === -1) {
      panic("Please include the scheme (http:// or https://) in the host.");
    }
  }

  const server = new RecordReplayServer({
    initialMode,
    tapeDir,
    host,
    defaultTapeName,
    enableLogging: true,
    redactHeaders,
    preventConditionalRequests,
  });
  await server.start(port);
  console.log(chalk.green(`Proxying in ${initialMode} mode on port ${port}.`));
}

function panic(message: string) {
  console.error(chalk.red(message));
  process.exit(1);
}

if (require.main === module) {
  main(process.argv);
}
