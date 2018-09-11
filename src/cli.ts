#!/usr/bin/env node

import chalk from "chalk";
import program from "commander";
import { diff } from "deep-diff";
import fs from "fs-extra";
import path from "path";
import { Persistence, serialiseBuffer } from "./persistence";
import { send } from "./sender";
import { RecordReplayServer } from "./server";

async function main(argv: string[]) {
  program
    .option("-m, --mode <mode>", "Mode (record, replay, passthrough or verify)")
    .option(
      "-t, --tapes <tapes-dir>",
      "Directory in which to record/replay tapes"
    )
    .option("-h, --host <host>", "Host to proxy (not required in replay mode)")
    .option("-p, --port <port>", "Local port to serve on", "3000")
    .parse(argv);

  const initialMode: string = program.mode;
  const tapeDir: string = program.tapes;
  const host: string = program.host;
  const port = parseInt(program.port);

  switch (initialMode) {
    case "record":
    case "replay":
    case "mimic":
    case "passthrough":
    case "verify":
      // Valid modes.
      break;
    default:
      panic(
        "Please specify a valid mode (record, replay, passthrough or verify)."
      );
      throw new Error(); // only used for TypeScript control flow
  }

  if (!tapeDir && initialMode !== "passthrough") {
    panic("Please specify a path to a tapes directory.");
  }

  if (
    (initialMode === "replay" || initialMode === "verify") &&
    !fs.existsSync(tapeDir)
  ) {
    panic(
      `No tapes found at ${tapeDir}. Did you mean to start in record mode?`
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

  if (initialMode === "verify") {
    return await verifyTapes(tapeDir, host);
  }

  const server = new RecordReplayServer({
    initialMode,
    tapeDir,
    host,
    enableLogging: true
  });
  await server.start(port);
  console.log(chalk.green(`Proxying in ${initialMode} mode on port ${port}.`));
}

async function verifyTapes(tapeDir: string, host: string) {
  const tapeNames = findTapeNames(tapeDir);
  for (const tapeName of tapeNames) {
    await verifyTape(tapeDir, tapeName, host);
  }
}

function findTapeNames(tapeDir: string): string[] {
  return findTapeNamesRecursively(tapeDir, "");
}

function findTapeNamesRecursively(
  tapeDir: string,
  relativePath: string
): string[] {
  const tapeNames: string[] = [];
  for (const childName of fs.readdirSync(path.join(tapeDir, relativePath))) {
    const childPath = path.join(tapeDir, relativePath, childName);
    const childStat = fs.lstatSync(childPath);
    if (childStat.isDirectory()) {
      tapeNames.push(
        ...findTapeNamesRecursively(tapeDir, path.join(relativePath, childName))
      );
    } else if (childStat.isFile() && childName.endsWith(".yml")) {
      tapeNames.push(
        path.join(relativePath, childName.substr(0, childName.length - 4))
      );
    } else {
      // Ignore.
    }
  }
  return tapeNames;
}

async function verifyTape(tapeDir: string, tapeName: string, host: string) {
  const persistence = new Persistence(tapeDir);
  const records = persistence.loadTapeFromDisk(tapeName);
  console.log(chalk.yellow(`\nVerifying tape: ${tapeName}`));
  for (const record of records) {
    const updatedRecord = await send(
      host,
      record.request.method,
      record.request.path,
      record.request.headers,
      record.request.body
    );
    if (updatedRecord.response.status.code !== record.response.status.code) {
      console.log(
        `${chalk.red(`x`)} ${record.request.method} ${
          record.request.path
        }  ${chalk.red(
          `Status changed from ${record.response.status.code} to ${
            updatedRecord.response.status.code
          }`
        )}`
      );
    } else {
      const originalBody = serialiseBuffer(
        record.response.body,
        record.response.headers
      );
      const updatedBody = serialiseBuffer(
        updatedRecord.response.body,
        updatedRecord.response.headers
      );
      if (originalBody.encoding === "utf8" && updatedBody.encoding === "utf8") {
        let originalJson;
        let updatedJson;
        try {
          originalJson = JSON.parse(originalBody.data);
          updatedJson = JSON.parse(updatedBody.data);
        } catch (e) {
          // OK, it's not valid JSON.
        }
        if (originalJson === undefined || updatedJson === undefined) {
          // TODO: Decide what to do.
          return;
        }
        const difference = diff(originalJson, updatedJson);
        if (!difference) {
          console.log(
            `${chalk.green(`✓`)} ${record.request.method} ${
              record.request.path
            }`
          );
        } else {
          console.log(
            `${chalk.red(`x`)} ${record.request.method} ${
              record.request.path
            }  ${chalk.red(`Diff: ${JSON.stringify(difference, null, 2)}`)}`
          );
        }
      } else {
        // TODO: Decide what to do.
      }
    }
  }
}

function panic(message: string) {
  console.error(chalk.red(message));
  process.exit(1);
}

if (require.main === module) {
  main(process.argv);
}
