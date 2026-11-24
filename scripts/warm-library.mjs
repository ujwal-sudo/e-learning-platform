// Pre-generates (and caches) the AI study material for a few chapters so a live demo opens instantly.
// Usage: node scripts/warm-library.mjs [baseUrl] [chapterId ...]
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const ids = process.argv.slice(3).length
  ? process.argv.slice(3)
  : [
      "cb-c7-en-gecu1-ch10", //      CBSE Class 7 Science: Life Processes in Plants
      "mh-c7-ma-701020012-ch02", //  Maharashtra Class 7 Marathi: वनस्पती : रचना व कार्य
      "mh-c8-en-803020012-ch03", //  Maharashtra Class 8 Science: Force and Pressure
      "mh-c9-en-903020456-ch01", //  Maharashtra Class 9 Science: Laws of Motion
      "mh-c10-en-1003000265-ch06", // Maharashtra Class 10 Science: Refraction of light
      "mh-c10-ma-1001000265-ch06", // Maharashtra Class 10 Marathi: प्रकाशाचे अपवर्तन
    ];

const post = async (path, body) => {
  const r = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
  return j;
};

for (const id of ids) {
  try {
    const { document } = await post("/api/library", { chapterId: id });
    const out = [];
    for (const kind of ["summary", "terms", "cards"]) {
      let res;
      for (let i = 0; i < 3; i++) {
        res = await post(`/api/documents/${document.id}/study`, { kind, lang: "book" });
        if (res.source === "ai") break; // basic = the model was busy; try again
        await new Promise((r) => setTimeout(r, 4000));
      }
      out.push(`${kind}:${res.source}`);
    }
    console.log(`ok   ${id}  ${document.title}  [${out.join(" ")}]`);
  } catch (e) {
    console.log(`FAIL ${id}  ${e.message}`);
  }
}
