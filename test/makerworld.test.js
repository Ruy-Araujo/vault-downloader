import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const collectorSource = await readFile(new URL("../source-collectors.js", import.meta.url), "utf8");

test("MakerWorld resolves an author profile as both 3MF and generated STL", async () => {
  const calls = [];
  const window = {};
  runInNewContext(collectorSource, {
    window, URL, URLSearchParams,
    location: { pathname: "/en/models/802819-the-grinch", href: "https://makerworld.com/en/models/802819-the-grinch#profileId-742987" },
    DOMParser: class { parseFromString() { return { images: [] }; } },
    fetch: async (url, options) => {
      calls.push(url);
      assert.equal(options.credentials, "include");
      if (url.endsWith("/design/802819")) return { ok: true, json: async () => ({
        title: "The Grinch with Ornament", designCreator: { uid: "author", name: "Author" }, designExtension: { model_files: [] },
        instances: [{ id: 742987, title: "PLA profile", instanceCreator: { uid: "author" }, extention: { modelInfo: { compatibility: { devModelName: "BL-P001" } } } }],
      }) };
      if (url.endsWith("/design/802819/instances")) return { ok: true, json: async () => ({ hits: [
        { id: 742987, title: "PLA profile", creator: { uid: "author" } },
        { id: 999, title: "Community profile", creator: { uid: "other" } },
      ] }) };
      const parsed = new URL(url);
      const fileType = parsed.searchParams.get("fileType");
      assert.equal(parsed.searchParams.get("devModelName"), "BL-P001");
      return { ok: true, json: async () => ({ url: `https://makerworld.bblmw.com/download/${fileType || "3mf"}`, name: fileType ? "PLA profile.stl" : "PLA profile.3mf" }) };
    },
  });

  const plan = JSON.parse(JSON.stringify(await window.__vaultDownloaderCollectors.makerworld()));
  assert.deepEqual(plan.files, [
    { id: "instance:742987:3mf", name: "PLA profile.3mf", url: "https://makerworld.bblmw.com/download/3mf" },
    { id: "instance:742987:stl", name: "PLA profile.stl", url: "https://makerworld.bblmw.com/download/3mfstl" },
  ]);
  assert.ok(calls.some(url => url.includes("fileType=3mfstl") && url.includes("devModelName=BL-P001")));
  assert.ok(!calls.some(url => url.includes("/instance/999/")));
});
