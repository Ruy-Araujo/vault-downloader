import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { withExtension } from "../shared.js";

test("uses the model title for the ZIP download and keeps archive entries at its root", async () => {
  const [background, offscreen] = await Promise.all([
    readFile(new URL("../background.js", import.meta.url), "utf8"),
    readFile(new URL("../offscreen.js", import.meta.url), "utf8"),
  ]);
  assert.equal(withExtension("QIDI Q2 Foot support", ".zip"), "QIDI Q2 Foot support.zip");
  assert.match(background, /archive-name-\$\{tab\.id\}/);
  assert.match(background, /archive-name-\$\{tabId\}/);
  assert.match(background, /filename, conflictAction: "uniquify"/);
  assert.match(background, /chrome\.downloads\.onDeterminingFilename\.addListener/);
  assert.match(background, /suggest\(filename \? \{ filename, conflictAction: "uniquify" \} : undefined\)/);
  assert.match(background, /requestedFilenameByUrl\.set\(url, filename\)/);
  assert.match(offscreen, /archiveName: job\.archiveName \|\| `\$\{title\}\.zip`/);
  assert.match(offscreen, /uniquePath\(name, usedPaths\)/);
  assert.match(offscreen, /uniquePath\(name, current\.usedPaths\)/);
  assert.doesNotMatch(offscreen, /\$\{title\}\/\$\{name\}/);
});
