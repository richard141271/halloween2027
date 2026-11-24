/* NATTORDREN – viser innhold fra Pages CMS på årssidene. */
(() => {
  "use strict";
  const clean = v => String(v ?? "").trim();
  const unquote = v => {
    v = clean(v);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
    return v;
  };
  const escapeHTML = v => String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);

  // Leser YAML-frontmatter-formatet Pages CMS lagrer.
  function parseFrontmatter(source) {
    const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)([\s\S]*)$/);
    if (!match) return { data: {}, body: source };
    const lines = match[1].replace(/\r/g, "").split("\n");
    const data = {};
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const field = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
      if (!field) continue;
      const key = field[1], value = field[2] ?? "";
      if (["|", "|-", "|+", ">", ">-", ">+"].includes(value.trim())) {
        const folded = value.trim().startsWith(">");
        const block = [];
        while (i + 1 < lines.length && (/^\s+/.test(lines[i + 1]) || lines[i + 1].trim() === "")) {
          const next = lines[++i];
          block.push(next.trim() ? next.replace(/^\s{1,}/, "") : "");
        }
        data[key] = (folded ? block.join(" ") : block.join("\n")).trim();
      } else if (!value.trim()) {
        const items = [];
        let j = i + 1;
        while (j < lines.length && /^\s+-\s*/.test(lines[j])) items.push(unquote(lines[j++].replace(/^\s+-\s*/, "")));
        if (items.length) { data[key] = items; i = j - 1; }
        else data[key] = "";
      } else {
        data[key] = unquote(value);
      }
    }
    return { data, body: match[2] || "" };
  }

  function markdownToHTML(source) {
    const lines = clean(source).split(/\r?\n/);
    const out = [];
    let list = [];
    const flush = () => { if (list.length) { out.push("<ul>" + list.map(x => `<li>${escapeHTML(x)}</li>`).join("") + "</ul>"); list = []; } };
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { flush(); continue; }
      if (/^[-*]\s+/.test(line)) { list.push(line.replace(/^[-*]\s+/, "")); continue; }
      flush();
      if (line.startsWith("### ")) out.push(`<h3>${escapeHTML(line.slice(4))}</h3>`);
      else if (line.startsWith("## ")) out.push(`<h2>${escapeHTML(line.slice(3))}</h2>`);
      else if (line.startsWith("# ")) out.push(`<h2>${escapeHTML(line.slice(2))}</h2>`);
      else out.push(`<p>${escapeHTML(line)}</p>`);
    }
    flush();
    return out.join("\n");
  }

  function listValues(value) {
    if (Array.isArray(value)) return value.map(clean).filter(Boolean);
    const v = clean(value);
    if (!v) return [];
    if (v.startsWith("[") && v.endsWith("]")) return v.slice(1, -1).split(",").map(unquote).filter(Boolean);
    return v.split(/\r?\n/).map(x => x.replace(/^\s*[-*]\s*/, "").trim()).filter(Boolean);
  }

  function safeImagePath(value) {
    const path = clean(value);
    if (!path || /^(javascript|data):/i.test(path)) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return path.startsWith("/") ? path : "/" + path.replace(/^\.?\//, "");
  }

  async function init() {
    const root = document.querySelector("[data-archive-year]");
    if (!root) return;
    const year = root.getAttribute("data-archive-year");
    try {
      const response = await fetch(`/content/years/${year}.md?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`CMS-innhold for ${year} ble ikke funnet (${response.status})`);
      const { data, body } = parseFrontmatter(await response.text());

      const set = (id, value) => { const el = document.getElementById(id); if (el && clean(value)) el.textContent = clean(value); };
      set("archive-year", data.year || year);
      set("archive-title", data.title);
      set("archive-subtitle", data.subtitle);
      document.title = `${clean(data.title) || year} | NATTORDREN`;

      const summary = document.getElementById("archive-summary");
      if (summary && clean(data.summary)) { summary.textContent = clean(data.summary); summary.hidden = false; }

      const story = document.getElementById("archive-story");
      const storyText = clean(data.body) || clean(body);
      if (story && storyText) story.innerHTML = markdownToHTML(storyText);

      const highlights = listValues(data.highlights);
      const highlightSection = document.getElementById("archive-highlights-section");
      const highlightList = document.getElementById("archive-highlights");
      if (highlights.length && highlightList && highlightSection) {
        highlightList.innerHTML = highlights.map(item => `<li>${escapeHTML(item)}</li>`).join("");
        highlightSection.hidden = false;
      }

      const gallery = listValues(data.gallery);
      const gallerySection = document.getElementById("archive-gallery-section");
      const galleryNode = document.getElementById("archive-gallery");
      if (gallery.length && galleryNode && gallerySection) {
        galleryNode.innerHTML = gallery.map((item, i) => {
          const path = safeImagePath(item);
          if (!path) return "";
          return `<figure class="archive-photo"><a href="${escapeHTML(path)}" target="_blank" rel="noopener"><img src="${escapeHTML(path)}" alt="NATTORDREN ${escapeHTML(year)} – bilde ${i + 1}" loading="lazy"></a></figure>`;
        }).join("");
        if (galleryNode.innerHTML) gallerySection.hidden = false;
      }
    } catch (error) {
      console.error("[NATTORDREN CMS]", error);
      const errorNode = document.getElementById("archive-error");
      if (errorNode) {
        errorNode.textContent = "Arkivinnholdet kunne ikke lastes. Prøv å oppdatere siden om litt.";
        errorNode.hidden = false;
      }
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
