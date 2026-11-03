export const SOURCES = [
  { id: "creality", name: "Creality Cloud", matches: url => /^https:\/\/(?:www\.)?crealitycloud\.com\/(?:[a-z-]+\/)?model-detail\//i.test(url), collector: "creality" },
  { id: "makerworld", name: "MakerWorld", matches: url => /^https:\/\/makerworld\.com\/(?:[a-z-]+\/)?models\/\d+(?:-|\/|$)/i.test(url), collector: "makerworld" },
  { id: "printables", name: "Printables", matches: url => /^https:\/\/www\.printables\.com\/(?:[a-z-]+\/)?model\/\d+(?:-|\/|$)/i.test(url), collector: "printables" },
];

export function sourceForUrl(url) { return SOURCES.find(source => source.matches(String(url || ""))) || null; }
