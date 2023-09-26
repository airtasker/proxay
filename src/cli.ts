#!/usr/bin/env node

import chalk from "chalk";
import program from "commander";
import fs from "fs-extra";
import { RewriteRule, RewriteRules } from "./rewrite";
import { RecordReplayServer } from "./server";

function commaSeparatedList(value: string) {
  return value ? value.split(",") : [];
}

const RE_REWRITE_RULE = /s\/(.+(?<!\\))\/(.+(?<!\\))\/([gims]*)/;
const RE_REPLACE_RULE = /(\\[1-9][0-9]*)/;

function rewriteRule(value: string, rewriteRules: RewriteRules): RewriteRules {
  // Does the given value match a sed-style regex expression?
  const match = RE_REWRITE_RULE.exec(value);
  if (match === null) {
    throw new Error(
      `Provided rewrite rule ${value} does not look like a sed-like rewrite rule.`
    );
  }
  const [rawFind, rawReplace, rawFlags] = match.slice(1, 4);

  // Parse the find regex with the given regex flags.
  let find: RegExp;
  try {
    find = new RegExp(rawFind, rawFlags);
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Find regex is syntactically invalid: ${e}`);
    } else {
      throw e;
    }
  }

  // Convert sed-style \N capture group replacement values into JavaScript regex $N
  // capture group replacement values.
  const replace = rawReplace.replace(
    RE_REPLACE_RULE,
    (m) => "$" + m.substring(1)
  );

  // Append the new rule to the set of rules.
  const rule = new RewriteRule(find, replace);
  return rewriteRules.appendRule(rule);
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
    .option(
      "--https-key <filename.pem>",
      "Enable HTTPS server with this key. Also requires --https-cert."
    )
    .option(
      "--https-cert <filename.pem>",
      "Enable HTTPS server with this cert. Also requires --https-key."
    )
    .option(
      "--https-ca <filename.pem>",
      "Enable HTTPS server where the certificate was generated by this CA. Useful if you are using a self-signed certificate. Also requires --https-key and --https-cert."
    )
    .option<RewriteRules>(
      "--rewrite-before-diff [s/find/replace/g...]",
      "Provide regex-based rewrite rules over strings before passing them to the diffing algorithm. The regex rules use sed-style syntax. s/find/replace/ with an optional regex modifier suffixes. Capture groups can be used using sed-style \\N syntax. This only is only used during replaying existing tapes.",
      rewriteRule,
      new RewriteRules()
    )
    .parse(argv);

  const initialMode: string = (program.mode || "").toLowerCase();
  const tapeDir: string = program.tapesDir;
  const defaultTapeName: string = program.defaultTape;
  const host: string = program.host;
  const port = parseInt(program.port, 10);
  const redactHeaders: string[] = program.redactHeaders;
  const preventConditionalRequests: boolean = !!program.dropConditionalRequestHeaders;
  const httpsCA: string = program.httpsCa || "";
  const httpsKey: string = program.httpsKey;
  const httpsCert: string = program.httpsCert;
  const rewriteBeforeDiffRules: RewriteRules = program.rewriteBeforeDiff;

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
    httpsCA,
    httpsKey,
    httpsCert,
    rewriteBeforeDiffRules,
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
