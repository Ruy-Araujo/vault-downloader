import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { randomUUID } from "node:crypto";

const collectorSource = await readFile(new URL("../source-collectors.js", import.meta.url), "utf8");
const exampleFile = {
  id: "5945974",
  name: "QIDI Q2 Foot Step - 1cm elevation with wider base.stl",
  fileSize: 480408,
};
const exampleModel = {
  id: "1411842", name: "QIDI Q2 Foot support with extra clearance",
  description: "", stls: [exampleFile], gcodes: [], slas: [], otherFiles: [],
};
const downloadUrl = "https://files.printables.com/media/prints/example/foot-step.stl";

async function collect({ model = exampleModel, linkResponse, httpStatus = 200 } = {}) {
  const calls = [];
  const window = {};
  runInNewContext(collectorSource, {
    window, URL, URLSearchParams, crypto: { randomUUID },
    location: {
      pathname: "/model/1411842-qidi-q2-foot-support-with-extra-clearance/files",
      href: "https://www.printables.com/model/1411842-qidi-q2-foot-support-with-extra-clearance/files",
    },
    DOMParser: class { parseFromString() { return { images: [] }; } },
    fetch: async (url, options) => {
      assert.equal(url, "https://api.printables.com/graphql/");
      assert.equal(options.method, "POST");
      assert.equal(options.credentials, "include");
      assert.equal(options.headers.origin, undefined);
      assert.equal(options.headers["graphql-client-version"], "v4.12.0");
      assert.match(options.headers["client-uid"], /^[0-9a-f-]{36}$/i);
      const body = JSON.parse(options.body);
      calls.push(body);
      if (!body.query.includes("getDownloadLink")) {
        return { ok: true, json: async () => ({ data: { print: model } }) };
      }
      // Mirrors the actual API: this field does not exist on Query.
      if (!body.query.startsWith("mutation")) {
        return { ok: true, json: async () => ({ errors: [{ message: "Cannot query field 'getDownloadLink' on type 'Query'." }] }) };
      }
      return {
        ok: httpStatus === 200, status: httpStatus,
        json: async () => typeof linkResponse === "function" ? linkResponse(body) : linkResponse ?? {
          data: { getDownloadLink: { ok: true, output: { link: downloadUrl }, errors: null } },
        },
      };
    },
  });
  const plan = await window.__vaultDownloaderCollectors.printables();
  return { plan: JSON.parse(JSON.stringify(plan)), calls };
}

test("the reported QIDI model resolves its STL through a download mutation", async () => {
  const { plan, calls } = await collect();
  assert.deepEqual(plan.files, [{ id: exampleFile.id, name: exampleFile.name, size: 480408, url: downloadUrl }]);
  assert.equal(calls[1].operationName, "GetDownloadLink");
  assert.deepEqual(calls[1].variables, { id: "5945974", modelId: "1411842", fileType: "stl", source: "model_detail" });
  assert.match(calls[1].query, /mutation GetDownloadLink/);
});

test("all Printables file categories use their corresponding download type", async () => {
  const model = { ...exampleModel, gcodes: [{ ...exampleFile, id: "g" }], slas: [{ ...exampleFile, id: "s" }], otherFiles: [{ ...exampleFile, id: "o" }] };
  const { plan, calls } = await collect({ model });
  assert.equal(plan.files.length, 4);
  assert.deepEqual(calls.slice(1).map(call => call.variables.fileType), ["stl", "gcode", "sla", "other"]);
  assert.ok(plan.files.every(file => file.url && !file.error));
});

test("GraphQL failures preserve the real reason and allow the next file to download", async () => {
  const { plan } = await collect({
    model: { ...exampleModel, stls: [exampleFile, { ...exampleFile, id: "second" }] },
    linkResponse: body => body.variables.id === exampleFile.id
      ? { errors: [{ message: "Download limit reached" }] }
      : { data: { getDownloadLink: { ok: true, output: { link: downloadUrl } } } },
  });
  assert.equal(plan.files[0].error, "Download limit reached");
  assert.equal(plan.files[0].url, undefined);
  assert.equal(plan.files[1].url, downloadUrl);
});

test("HTTP errors and refused or missing URLs are reported as file failures", async () => {
  const scenarios = [
    [{ httpStatus: 403 }, "Printables responded with 403."],
    [{ linkResponse: { data: { getDownloadLink: { ok: false, output: { link: downloadUrl }, errors: [{ field: "id", messages: ["Sign in to download"] }] } } } }, "Sign in to download"],
    [{ linkResponse: { data: { getDownloadLink: { ok: true, output: null } } } }, "Printables did not provide a download URL."],
    [{ linkResponse: { data: { getDownloadLink: { ok: true, output: { link: "http://files.printables.com/file.stl" } } } } }, "Printables returned an invalid download URL."],
  ];
  for (const [options, expected] of scenarios) {
    const { plan } = await collect(options);
    assert.equal(plan.files[0].error, expected);
    assert.equal(plan.files[0].url, undefined);
  }
});

test("the extension can fetch the official Printables file host", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.ok(manifest.host_permissions.includes("https://files.printables.com/*"));
});
