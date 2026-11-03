import test from "node:test";
import assert from "node:assert/strict";
import { sourceForUrl } from "../sources.js";

test("recognizes supported source pages and rejects lookalike domains", () => {
  assert.equal(sourceForUrl("https://www.crealitycloud.com/model-detail/a")?.id, "creality");
  assert.equal(sourceForUrl("https://makerworld.com/en/models/412809-test#profileId-1")?.id, "makerworld");
  assert.equal(sourceForUrl("https://www.printables.com/cs/model/3161-example/files")?.id, "printables");
  assert.equal(sourceForUrl("https://evil-makerworld.com/en/models/1"), null);
  assert.equal(sourceForUrl("http://makerworld.com/en/models/1"), null);
});

test("recognition ignores query and hash while requiring model routes", () => {
  assert.equal(sourceForUrl("https://www.printables.com/model/123-name?tab=files#x")?.id, "printables");
  assert.equal(sourceForUrl("https://makerworld.com/en/3d-models"), null);
});
