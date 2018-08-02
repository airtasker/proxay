#!/usr/bin/env node

import chalk from "chalk";
import program from "commander";
import fs from "fs-extra";
import { RecordReplayServer } from "./server";

async function main(argv: string[]) {
  program
    .option("-m, --mode <mode>", "Mode (record or replay)")
    .option(
      "-t, --tapes <tapes-dir>",
      "Directory in which to record/replay tapes"
    )
    .option("-h, --host <host>", "Host to proxy (not required in replay mode)")
    .option("-p, --port <port>", "Local port to serve on", "3000")
    .parse(argv);

  const mode: string = program.mode;
  const tapeDir: string = program.tapes;
  const host: string = program.host;
  const port = parseInt(program.port);

  switch (mode) {
    case "record":
    case "replay":
      // Valid modes.
      break;
    default:
      panic("Please specify a valid mode (record or replay).");
      throw new Error(); // only used for TypeScript control flow
  }

  if (!tapeDir) {
    panic("Please specify a path to a tapes directory.");
  }

  if (mode === "replay" && !fs.existsSync(tapeDir)) {
    panic(
      `No tapes found at ${tapeDir}. Did you mean to start in record mode?`
    );
  }

  // Expect a host unless we're in replay mode.
  if (mode !== "replay") {
    if (!host) {
      panic("Please specify a host.");
    }
    if (host.indexOf("://") === -1) {
      panic("Please include the scheme (http:// or https://) in the host.");
    }
  }

  const server = new RecordReplayServer({
    mode,
    tapeDir,
    host
  });
  await server.start(port);
  console.log(chalk.green(`Proxying in ${mode} mode on port ${port}.`));
}

function panic(message: string) {
  console.error(chalk.red(message));
  process.exit(1);
}

if (require.main === module) {
  main(process.argv);
}
