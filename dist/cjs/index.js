"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHubHandler = exports.rowActionPath = exports.optionsPath = exports.dataPath = exports.catalogPath = exports.buildCatalog = exports.actionPath = exports.examples = exports.isRelativePath = exports.validateData = exports.validateCatalog = void 0;
// Package entry: the contract v1 validator and types, the producer, and the reference examples. The test kit is its own entry, `lookout-widgets/testkit`.
__exportStar(require("./contract/types.js"), exports);
var validate_js_1 = require("./contract/validate.js");
Object.defineProperty(exports, "validateCatalog", { enumerable: true, get: function () { return validate_js_1.validateCatalog; } });
Object.defineProperty(exports, "validateData", { enumerable: true, get: function () { return validate_js_1.validateData; } });
var paths_js_1 = require("./contract/paths.js");
Object.defineProperty(exports, "isRelativePath", { enumerable: true, get: function () { return paths_js_1.isRelativePath; } });
var index_js_1 = require("./examples/index.js");
Object.defineProperty(exports, "examples", { enumerable: true, get: function () { return index_js_1.examples; } });
var build_js_1 = require("./producer/build.js");
Object.defineProperty(exports, "actionPath", { enumerable: true, get: function () { return build_js_1.actionPath; } });
Object.defineProperty(exports, "buildCatalog", { enumerable: true, get: function () { return build_js_1.buildCatalog; } });
Object.defineProperty(exports, "catalogPath", { enumerable: true, get: function () { return build_js_1.catalogPath; } });
Object.defineProperty(exports, "dataPath", { enumerable: true, get: function () { return build_js_1.dataPath; } });
Object.defineProperty(exports, "optionsPath", { enumerable: true, get: function () { return build_js_1.optionsPath; } });
Object.defineProperty(exports, "rowActionPath", { enumerable: true, get: function () { return build_js_1.rowActionPath; } });
var handler_js_1 = require("./producer/handler.js");
Object.defineProperty(exports, "createHubHandler", { enumerable: true, get: function () { return handler_js_1.createHubHandler; } });
