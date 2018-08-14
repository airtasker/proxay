#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var chalk_1 = require("chalk");
var commander_1 = require("commander");
var fs_extra_1 = require("fs-extra");
var server_1 = require("./server");
function main(argv) {
    return __awaiter(this, void 0, void 0, function () {
        var mode, tapeDir, host, port, server;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    commander_1["default"]
                        .option("-m, --mode <mode>", "Mode (record, replay or passthrough)")
                        .option("-t, --tapes <tapes-dir>", "Directory in which to record/replay tapes")
                        .option("-h, --host <host>", "Host to proxy (not required in replay mode)")
                        .option("-p, --port <port>", "Local port to serve on", "3000")
                        .parse(argv);
                    mode = commander_1["default"].mode;
                    tapeDir = commander_1["default"].tapes;
                    host = commander_1["default"].host;
                    port = parseInt(commander_1["default"].port);
                    switch (mode) {
                        case "record":
                        case "replay":
                        case "passthrough":
                            // Valid modes.
                            break;
                        default:
                            panic("Please specify a valid mode (record or replay).");
                            throw new Error(); // only used for TypeScript control flow
                    }
                    if (!tapeDir && mode !== "passthrough") {
                        panic("Please specify a path to a tapes directory.");
                    }
                    if (mode === "replay" && !fs_extra_1["default"].existsSync(tapeDir)) {
                        panic("No tapes found at " + tapeDir + ". Did you mean to start in record mode?");
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
                    server = new server_1.RecordReplayServer({
                        mode: mode,
                        tapeDir: tapeDir,
                        host: host,
                        enableLogging: true
                    });
                    return [4 /*yield*/, server.start(port)];
                case 1:
                    _a.sent();
                    console.log(chalk_1["default"].green("Proxying in " + mode + " mode on port " + port + "."));
                    return [2 /*return*/];
            }
        });
    });
}
function panic(message) {
    console.error(chalk_1["default"].red(message));
    process.exit(1);
}
if (require.main === module) {
    main(process.argv);
}
