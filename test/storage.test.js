import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../offscreen.js", import.meta.url), "utf8");
const start = source.indexOf("async function fetchToOpfs");
const end = source.indexOf("function cacheKeyFor", start);
const fetchToOpfsSource = source.slice(start, end);

test("a quota error removes the partial temporary entry and remains a file error", async () => {
  const removed = [];
  const current = {
    cache: { files: new Map() },
    tempNames: [],
    root: {
      async getFileHandle() { return { async createWritable() { return {}; }, async getFile() { return new File([], "unused"); } }; },
      async removeEntry(name) { removed.push(name); },
    },
  };
  const fetchToOpfs = new Function("current", "fetchImpl", "uuid", `
    const fetch = fetchImpl;
    const crypto = { randomUUID: uuid };
    ${fetchToOpfsSource}
    return fetchToOpfs;
  `)(current, async () => ({
    ok: true,
    headers: { get: () => "application/octet-stream" },
    body: { async pipeTo() { throw new DOMException("quota", "QuotaExceededError"); } },
  }), () => "temporary-file");

  await assert.rejects(() => fetchToOpfs("https://example.test/model.stl", "model", "model:1"), /not enough temporary browser storage for this file/i);
  assert.deepEqual(removed, ["cc-export-temporary-file"]);
  assert.deepEqual(current.tempNames, []);
  assert.equal(current.cache.files.size, 0);
});
