#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");

function replaceOnce(filePath, oldSnippet, newSnippet, description) {
  const contents = fs.readFileSync(filePath, "utf8");
  if (contents.includes(newSnippet)) {
    return;
  }
  if (!contents.includes(oldSnippet)) {
    throw new Error(`Could not find ${description} in ${filePath}`);
  }
  fs.writeFileSync(filePath, contents.replace(oldSnippet, newSnippet));
}

const betterSqlite3Root = path.join(packageRoot, "node_modules", "better-sqlite3", "src");

replaceOnce(
  path.join(betterSqlite3Root, "better_sqlite3.cpp"),
  "v8::Local<v8::External> data = v8::External::New(isolate, addon);",
  "v8::Local<v8::External> data = v8::External::New(isolate, addon, v8::kExternalPointerTypeTagDefault);",
  "better-sqlite3 External::New call",
);

replaceOnce(
  path.join(betterSqlite3Root, "util", "macros.cpp"),
  "#define OnlyAddon static_cast<Addon*>(info.Data().As<v8::External>()->Value())",
  "#define OnlyAddon static_cast<Addon*>(info.Data().As<v8::External>()->Value(v8::kExternalPointerTypeTagDefault))",
  "better-sqlite3 External::Value call",
);

replaceOnce(
  path.join(betterSqlite3Root, "util", "helpers.cpp"),
  "\t\tfunc,\n\t\t0,\n\t\tdata",
  "\t\tfunc,\n\t\tnullptr,\n\t\tdata",
  "better-sqlite3 SetNativeDataProperty setter",
);
