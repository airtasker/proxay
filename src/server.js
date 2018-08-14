"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var assert_never_1 = require("assert-never");
var brotli_1 = require("brotli");
var chalk_1 = require("chalk");
var fs_extra_1 = require("fs-extra");
var http_1 = require("http");
var https_1 = require("https");
var js_yaml_1 = require("js-yaml");
var path_1 = require("path");
/**
 * A server that proxies or replays requests depending on the mode.
 */
var RecordReplayServer = /** @class */ (function () {
    function RecordReplayServer(options) {
        var _this = this;
        this.currentTapeRecords = [];
        this.currentTapeRecords = [];
        this.mode = options.mode;
        this.tapeDir = options.tapeDir;
        this.proxiedHost = options.host;
        this.loggingEnabled = options.enableLogging || false;
        this.loadTape(DEFAULT_TAPE);
        this.server = http_1["default"].createServer(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
            var requestBody, requestPath, record, _a, e_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!req.url) {
                            this.loggingEnabled &&
                                console.error(chalk_1["default"].red("Received a request without URL."));
                            return [2 /*return*/];
                        }
                        if (!req.method) {
                            this.loggingEnabled &&
                                console.error(chalk_1["default"].red("Received a request without HTTP method."));
                            return [2 /*return*/];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 10, , 11]);
                        return [4 /*yield*/, receiveRequestBody(req)];
                    case 2:
                        requestBody = _b.sent();
                        requestPath = extractPath(req.url);
                        if (requestPath.startsWith("/__proxay/")) {
                            this.handleProxayApi(requestPath, requestBody, res);
                            return [2 /*return*/];
                        }
                        record = void 0;
                        _a = this.mode;
                        switch (_a) {
                            case "replay": return [3 /*break*/, 3];
                            case "record": return [3 /*break*/, 4];
                            case "passthrough": return [3 /*break*/, 6];
                        }
                        return [3 /*break*/, 8];
                    case 3:
                        record = this.findRecord(req.method, requestPath, req.headers, requestBody);
                        if (record) {
                            this.removeRecordFromTape(record);
                            this.loggingEnabled &&
                                console.log("Replayed: " + req.method + " " + requestPath);
                        }
                        else {
                            this.loggingEnabled &&
                                console.warn(chalk_1["default"].yellow("Unexpected request " + req.method + " " + requestPath + " has no matching record in tapes."));
                        }
                        return [3 /*break*/, 9];
                    case 4: return [4 /*yield*/, this.proxy(req.method, requestPath, req.headers, requestBody)];
                    case 5:
                        record = _b.sent();
                        this.addRecordToTape(record);
                        this.loggingEnabled &&
                            console.log("Recorded: " + req.method + " " + requestPath);
                        return [3 /*break*/, 9];
                    case 6: return [4 /*yield*/, this.proxy(req.method, requestPath, req.headers, requestBody)];
                    case 7:
                        record = _b.sent();
                        this.loggingEnabled &&
                            console.log("Proxied: " + req.method + " " + requestPath);
                        return [3 /*break*/, 9];
                    case 8: throw assert_never_1["default"](this.mode);
                    case 9:
                        if (record) {
                            this.sendResponse(record, res);
                        }
                        else {
                            res.statusCode = 500;
                            res.end();
                        }
                        return [3 /*break*/, 11];
                    case 10:
                        e_1 = _b.sent();
                        this.loggingEnabled && console.error(chalk_1["default"].red("Unexpected error:"), e_1);
                        return [3 /*break*/, 11];
                    case 11: return [2 /*return*/];
                }
            });
        }); });
    }
    /**
     * Starts the server.
     */
    RecordReplayServer.prototype.start = function (port) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, new Promise(function (resolve) { return _this.server.listen(port, resolve); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Stops the server.
     */
    RecordReplayServer.prototype.stop = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, new Promise(function (resolve) { return _this.server.close(resolve); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handles requests that are intended for Proxay itself.
     */
    RecordReplayServer.prototype.handleProxayApi = function (requestPath, requestBody, res) {
        // Sending a request to /__proxay/tape will pick a specific tape.
        if (requestPath === "/__proxay/tape") {
            var json = Buffer.concat(requestBody).toString("utf8");
            var tape = void 0;
            try {
                tape = JSON.parse(json).tape;
            }
            catch (_a) {
                tape = null;
            }
            if (tape) {
                if (path_1["default"]
                    .relative(this.tapeDir, path_1["default"].join(this.tapeDir, tape))
                    .startsWith("../")) {
                    var errorMessage = "Invalid tape name: " + tape;
                    this.loggingEnabled && console.error(chalk_1["default"].red(errorMessage));
                    res.statusCode = 403;
                    res.end(errorMessage);
                    return;
                }
                this.loadTape(tape);
                res.end("Updated tape: " + tape);
            }
            else {
                this.unloadTape();
                res.end("Unloaded tape");
            }
        }
    };
    /**
     * Loads a specific tape into memory (erasing it in record mode).
     */
    RecordReplayServer.prototype.loadTape = function (tapeName) {
        this.currentTape = tapeName;
        this.loggingEnabled &&
            console.log(chalk_1["default"].blueBright("Loaded tape: " + tapeName));
        switch (this.mode) {
            case "record":
                this.currentTapeRecords = [];
                this.saveTapeToDisk();
                break;
            case "replay":
                this.currentTapeRecords = this.loadTapeFromDisk();
                break;
            case "passthrough":
                // Do nothing.
                break;
            default:
                throw assert_never_1["default"](this.mode);
        }
    };
    /**
     * Unloads the current tape, falling back to the default.
     */
    RecordReplayServer.prototype.unloadTape = function () {
        this.loadTape(DEFAULT_TAPE);
    };
    /**
     * Removes a specific record from the current tape, to make sure that
     * subsequent requests don't replay the same record.
     */
    RecordReplayServer.prototype.removeRecordFromTape = function (record) {
        var index = this.currentTapeRecords.findIndex(function (r) { return r === record; });
        this.currentTapeRecords.splice(index, 1);
    };
    /**
     * Adds a new record to the current tape and saves to disk.
     */
    RecordReplayServer.prototype.addRecordToTape = function (record) {
        this.currentTapeRecords.push(record);
        this.saveTapeToDisk();
    };
    /**
     * Saves the tape to disk.
     */
    RecordReplayServer.prototype.saveTapeToDisk = function () {
        var tapePath = this.getTapePath(this.currentTape);
        fs_extra_1["default"].ensureDirSync(path_1["default"].dirname(tapePath));
        fs_extra_1["default"].writeFileSync(tapePath, js_yaml_1["default"].safeDump({
            http_interactions: this.currentTapeRecords
        }), "utf8");
    };
    /**
     * Loads the tape from disk.
     */
    RecordReplayServer.prototype.loadTapeFromDisk = function () {
        var tapePath = this.getTapePath(this.currentTape);
        if (!fs_extra_1["default"].existsSync(tapePath)) {
            this.loggingEnabled &&
                console.warn(chalk_1["default"].yellow("No tape found with name " + this.currentTape));
            return [];
        }
        return js_yaml_1["default"].safeLoad(fs_extra_1["default"].readFileSync(tapePath, "utf8")).http_interactions;
    };
    /**
     * Returns the tape's path on disk.
     */
    RecordReplayServer.prototype.getTapePath = function (tapeName) {
        return path_1["default"].join(this.tapeDir, tapeName + ".yml");
    };
    /**
     * Finds a matching record for a particular request.
     */
    RecordReplayServer.prototype.findRecord = function (requestMethod, requestPath, _requestHeaders, _requestBody) {
        for (var i = 0; i < this.currentTapeRecords.length; i += 1) {
            var record = this.currentTapeRecords[i];
            if (record.request.method === requestMethod &&
                record.request.path === requestPath) {
                return record;
            }
        }
        return null;
    };
    /**
     * Proxies a specific request and returns the resulting record.
     */
    RecordReplayServer.prototype.proxy = function (requestMethod, requestPath, requestHeaders, requestBody) {
        return __awaiter(this, void 0, void 0, function () {
            var requestContentEncodingHeader, requestContentEncoding, _a, scheme, hostnameWithPort, _b, hostname, port, response_1, statusCode_1, responseBody_1, e_2;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!this.proxiedHost) {
                            throw new Error("Missing proxied host");
                        }
                        requestContentEncodingHeader = requestHeaders["content-encoding"];
                        requestContentEncoding = typeof requestContentEncodingHeader === "string"
                            ? requestContentEncodingHeader
                            : undefined;
                        _a = this.proxiedHost.split("://"), scheme = _a[0], hostnameWithPort = _a[1];
                        _b = hostnameWithPort.split(":"), hostname = _b[0], port = _b[1];
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, new Promise(function (resolve) {
                                var requestOptions = {
                                    hostname: hostname,
                                    method: requestMethod,
                                    path: requestPath,
                                    port: port,
                                    headers: __assign({}, requestHeaders, { host: hostname })
                                };
                                var proxyRequest = scheme === "http"
                                    ? http_1["default"].request(requestOptions, resolve)
                                    : https_1["default"].request(requestOptions, resolve);
                                requestBody.forEach(function (chunk) { return proxyRequest.write(chunk); });
                                proxyRequest.end();
                            })];
                    case 2:
                        response_1 = _c.sent();
                        statusCode_1 = response_1.statusCode || 200;
                        responseBody_1 = [];
                        response_1.on("data", function (chunk) {
                            responseBody_1.push(ensureBuffer(chunk));
                        });
                        return [2 /*return*/, new Promise(function (resolve) {
                                response_1.on("end", function () {
                                    resolve({
                                        request: {
                                            method: requestMethod,
                                            path: requestPath,
                                            headers: requestHeaders,
                                            body: serialiseBuffer(Buffer.concat(requestBody), requestContentEncoding)
                                        },
                                        response: {
                                            status: {
                                                code: statusCode_1
                                            },
                                            headers: response_1.headers,
                                            body: serialiseBuffer(Buffer.concat(responseBody_1), response_1.headers["content-encoding"])
                                        }
                                    });
                                });
                            })];
                    case 3:
                        e_2 = _c.sent();
                        if (e_2.code) {
                            this.loggingEnabled &&
                                console.error(chalk_1["default"].red("Could not proxy request " + requestMethod + " " + requestPath + " (" + e_2.code + ")"));
                        }
                        else {
                            this.loggingEnabled &&
                                console.error(chalk_1["default"].red("Could not proxy request " + requestMethod + " " + requestPath, e_2));
                        }
                        throw e_2;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Sends a particular response to the client.
     */
    RecordReplayServer.prototype.sendResponse = function (record, res) {
        res.statusCode = record.response.status.code;
        Object.keys(record.response.headers).forEach(function (headerName) {
            var headerValue = record.response.headers[headerName];
            if (headerValue) {
                res.setHeader(headerName, headerValue);
            }
        });
        var responseContentEncodingHeader = record.response.headers["content-encoding"];
        var responseContentEncoding = typeof responseContentEncodingHeader === "string"
            ? responseContentEncodingHeader
            : undefined;
        res.end(unserialiseBuffer(record.response.body, responseContentEncoding));
    };
    return RecordReplayServer;
}());
exports.RecordReplayServer = RecordReplayServer;
function receiveRequestBody(req) {
    var requestChunks = [];
    req.on("data", function (chunk) {
        requestChunks.push(ensureBuffer(chunk));
    });
    return new Promise(function (resolve) {
        req.on("end", function () { return resolve(requestChunks); });
    });
}
function ensureBuffer(stringOrBuffer) {
    return typeof stringOrBuffer === "string"
        ? Buffer.from(stringOrBuffer, "utf8")
        : stringOrBuffer;
}
function serialiseBuffer(buffer, encoding) {
    if (encoding === "br") {
        buffer = Buffer.from(brotli_1["default"].decompress(buffer));
    }
    var utf8Representation = buffer.toString("utf8");
    try {
        // Can it be safely stored and recreated in YAML?
        var recreatedBuffer = Buffer.from(js_yaml_1["default"].safeLoad(js_yaml_1["default"].safeDump(utf8Representation)), "utf8");
        if (Buffer.compare(buffer, recreatedBuffer) === 0) {
            // Yes, we can store it in YAML.
            return {
                encoding: "utf8",
                data: utf8Representation
            };
        }
    }
    catch (_a) {
        // Fall through.
    }
    // No luck. Fall back to Base64.
    return {
        encoding: "base64",
        data: buffer.toString("base64")
    };
}
function unserialiseBuffer(persisted, encoding) {
    var buffer;
    switch (persisted.encoding) {
        case "base64":
            buffer = Buffer.from(persisted.data, "base64");
            break;
        case "utf8":
            buffer = Buffer.from(persisted.data, "utf8");
            break;
        case "json":
            // Deprecated. Instead, we store JSON as utf8 so exact formatting is kept.
            buffer = Buffer.from(JSON.stringify(persisted.data, null, 2), "utf8");
            break;
        default:
            throw new Error("Unsupported encoding!");
    }
    if (encoding === "br") {
        buffer = Buffer.from(brotli_1["default"].compress(buffer));
    }
    return buffer;
}
function extractPath(url) {
    var schemePosition = url.indexOf("://");
    if (schemePosition !== -1) {
        var pathPosition = url.indexOf("/", schemePosition + 3);
        return url.substr(pathPosition);
    }
    else {
        return url;
    }
}
var DEFAULT_TAPE = "default";
