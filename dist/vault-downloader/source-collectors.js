(() => {
  const registry = window.__vaultDownloaderCollectors ||= {};
  const text = value => String(value ?? "").trim();
  const absolute = (value, base) => { try { return new URL(value, base).href; } catch { return ""; } };
  const idFromPath = (pattern) => { const match = location.pathname.match(pattern); return match?.[1] || ""; };
  const request = async (url, options = {}) => { const response = await fetch(url, { credentials: "include", ...options }); if (!response.ok) throw new Error(`The source responded with ${response.status}.`); return response.json(); };
  const imagesFromHtml = html => [...new DOMParser().parseFromString(html || "", "text/html").images].map(image => image.getAttribute("data-src") || image.src).filter(Boolean).map(url => absolute(url, location.href));
  const makerHeaders = { "X-BBL-Client-Type": "web", "X-BBL-Client-Version": "00.00.00.01", "X-BBL-App-Source": "makerworld", "X-BBL-Client-Name": "MakerWorld" };
  registry.makerworld = async () => {
    const id = idFromPath(/\/models\/(\d+)/i); const base = "https://makerworld.com";
    if (!id) throw new Error("The MakerWorld model ID was not found.");
    const design = await request(`${base}/api/v1/design-service/design/${id}`, { headers: makerHeaders });
    const data = design.data || design;
    const creator = data.designCreator || {};
    const files = [];
    const walk = (items, parent = "") => (Array.isArray(items) ? items : []).forEach(item => {
      if (item.children) return walk(item.children, item.dirName || parent);
      if (item.protected) { files.push({ id: item.unikey, name: item.modelName || "file", error: "This MakerWorld file is protected." }); return; }
      const params = new URLSearchParams({ modelFileName: item.modelName || "", modelType: item.modelType || "", key: item.unikey || "", type: "download", modelName: item.modelName || "", dirName: parent });
      files.push({ id: item.unikey, name: item.modelName || "file", resolver: `${base}/api/v1/design-service/design/${id}/model?${params}` });
    });
    walk(data.designExtension?.model_files);
    let instances = [];
    try { const result = await request(`${base}/api/v1/design-service/design/${id}/instances`, { headers: makerHeaders }); instances = result.hits || result.data?.hits || []; } catch { /* profiles are optional */ }
    for (const instance of instances) if (String(instance.creator?.uid || instance.instanceCreator?.uid) === String(creator.uid)) {
      const params = new URLSearchParams({ type: "download", fileType: "", devModelName: instance.detail?.modelName || instance.title || "" });
      files.push({ id: `instance:${instance.id}`, name: instance.detail?.name || instance.title || `${instance.id}.3mf`, resolver: `${base}/api/v1/design-service/instance/${instance.id}/f3mf?${params}` });
    }
    for (const file of files.filter(item => item.resolver)) { try { const resolved = await request(file.resolver, { headers: makerHeaders }); file.url = resolved.url; file.name = resolved.name || file.name; } catch (error) { file.error = error.message; } delete file.resolver; }
    const descriptionHtml = data.summary || "";
    return { ok: true, source: { id: "makerworld", name: "MakerWorld" }, item: { id, title: data.title || "MakerWorld model", sourceUrl: location.href, author: { id: creator.uid, name: creator.name }, descriptionHtml, license: data.license, tags: data.tags || [], categories: (data.categories || []).map(item => item.name || item), gallery: [data.coverUrl, ...(data.designExtension?.design_pictures || []).map(item => item.url || item)].filter(Boolean).map(url => absolute(url, base)), descriptionImages: imagesFromHtml(descriptionHtml) }, files };
  };
  registry.printables = async () => {
    const id = idFromPath(/\/model\/(\d+)/i);
    if (!id) throw new Error("The Printables model ID was not found.");
    // Printables uses this identifier to associate GraphQL download requests
    // with a browser client. Keep it for the page lifetime; it is not an auth
    // credential and the authenticated browser session remains in cookies.
    const clientUid = window.__vaultPrintablesClientUid ||= crypto.randomUUID();
    const graphql = async (query, variables) => {
      const response = await fetch("https://api.printables.com/graphql/", {
        method: "POST", credentials: "include",
        headers: {
          accept: "application/graphql-response+json, application/graphql+json, application/json",
          "content-type": "application/json",
          "client-uid": clientUid,
          "graphql-client-version": "v4.12.0",
        },
        body: JSON.stringify({
          operationName: query.includes("mutation GetDownloadLink") ? "GetDownloadLink" : "GetPrint",
          query,
          variables,
        }),
      });
      if (!response.ok) throw new Error(`Printables responded with ${response.status}.`);
      const payload = await response.json();
      if (payload.errors?.length) throw new Error(payload.errors.map(error => error.message).join("; "));
      return payload.data;
    };
    const query = `query GetPrint($id:ID!){print(id:$id){id name slug summary description datePublished license{id name} user{id publicUsername handle} category{id name} tags{id name} images{id filePath} stls{id name fileSize} gcodes{id name fileSize} slas{id name fileSize} otherFiles{id name fileSize}}}`;
    const data = (await graphql(query, { id }))?.print;
    if (!data) throw new Error("Printables did not return this model.");
    const files = [];
    const fileTypes = { stls: "stl", gcodes: "gcode", slas: "sla", otherFiles: "other" };
    for (const [category, fileType] of Object.entries(fileTypes)) {
      for (const file of data[category] || []) {
        const item = { id: file.id, name: file.name, size: file.fileSize };
        try {
          // Link generation is a GraphQL mutation, even for public files.
          const mutation = `mutation GetDownloadLink($id:ID!,$modelId:ID!,$fileType:DownloadFileTypeEnum!,$source:DownloadSourceEnum!){getDownloadLink(id:$id,printId:$modelId,fileType:$fileType,source:$source){ok output{link count ttl} errors{field messages}}}`;
          const result = (await graphql(mutation, {
            id: file.id,
            modelId: id,
            fileType,
            source: "model_detail",
          }))?.getDownloadLink;
          if (!result?.ok || !result.output?.link) {
            throw new Error(result?.errors?.flatMap(error => error.messages || []).join("; ") || "Printables did not provide a download URL.");
          }
          const url = new URL(result.output.link);
          if (url.protocol !== "https:") throw new Error("Printables returned an invalid download URL.");
          item.url = url.href;
        } catch (error) {
          item.error = error.message;
        }
        files.push(item);
      }
    }
    const descriptionHtml = data.description || data.summary || ""; return { ok: true, source: { id: "printables", name: "Printables" }, item: { id, title: data.name, sourceUrl: location.href, author: { id: data.user?.id, name: data.user?.publicUsername || data.user?.handle }, descriptionHtml, license: data.license?.name, tags: (data.tags || []).map(item => item.name), categories: data.category?.name ? [data.category.name] : [], gallery: (data.images || []).map(image => absolute(image.filePath, "https://media.printables.com/")), descriptionImages: imagesFromHtml(descriptionHtml) }, files };
  };
})();
