/* NATTORDREN – robust CMS-renderer for årssidene 2018–2027. */
(() => {
  "use strict";
  const clean = v => String(v ?? "").trim();
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
  const unquote = v => {
    v = clean(v);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
    return v;
  };
  function parseFrontmatter(source) {
    source = String(source || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimStart();
    const lines = source.split("\n"), data = {};
    if (lines[0]?.trim() !== "---") return {data, body: source};
    const end = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
    if (end < 0) return {data, body: source};
    for (let i = 1; i < end; i++) {
      const m = lines[i].match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
      if (!m) continue;
      const key = m[1], value = m[2] ?? "";
      if (["|","|-","|+",">",">-",">+"].includes(value.trim())) {
        const folded = value.trim().startsWith(">");
        const block = [];
        while (i + 1 < end && (/^\s+/.test(lines[i + 1]) || !lines[i + 1].trim())) {
          const line = lines[++i];
          block.push(line.trim() ? line.replace(/^\s+/, "") : "");
        }
        data[key] = (folded ? block.join(" ") : block.join("\n")).trim();
      } else if (!value.trim()) {
        const items = [];
        let j = i + 1;
        while (j < end && /^\s+-\s*/.test(lines[j])) items.push(unquote(lines[j++].replace(/^\s+-\s*/, "")));
        data[key] = items.length ? items : "";
        if (items.length) i = j - 1;
      } else {
        const inline = value.trim().match(/^\[(.*)\]$/);
        data[key] = inline ? inline[1].split(",").map(unquote).filter(Boolean) : unquote(value);
      }
    }
    return {data, body: lines.slice(end + 1).join("\n")};
  }
  function listValues(value) {
    if (Array.isArray(value)) return value.map(clean).filter(Boolean);
    const s = clean(value);
    if (!s) return [];
    return s.split(/\r?\n/).map(x => x.replace(/^\s*[-*]\s*/, "").trim()).filter(Boolean);
  }
  function markdown(source) {
    const lines = clean(source).split(/\r?\n/), out = [];
    let list = [];
    const flush = () => { if (list.length) { out.push("<ul>" + list.map(x => `<li>${esc(x)}</li>`).join("") + "</ul>"); list = []; } };
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { flush(); continue; }
      if (/^[-*]\s+/.test(line)) { list.push(line.replace(/^[-*]\s+/, "")); continue; }
      flush();
      if (line.startsWith("### ")) out.push(`<h3>${esc(line.slice(4))}</h3>`);
      else if (line.startsWith("## ")) out.push(`<h2>${esc(line.slice(3))}</h2>`);
      else if (line.startsWith("# ")) out.push(`<h2>${esc(line.slice(2))}</h2>`);
      else out.push(`<p>${esc(line)}</p>`);
    }
    flush();
    return out.join("\n");
  }
  function safePath(value) {
    const p = clean(value);
    if (!p || /^(javascript|data):/i.test(p)) return "";
    if (/^https?:\/\//i.test(p)) return p;
    return p.startsWith("/") ? p : "/" + p.replace(/^\.?\//, "");
  }
  const find = (root, selector, fallback) => root.querySelector(selector) || (fallback ? document.querySelector(fallback) : null);

  async function init() {
    const root = document.querySelector("[data-archive-year]");
    if (!root) return;
    const year = root.getAttribute("data-archive-year");
    const errorNode = root.querySelector("[data-archive-error]") || document.getElementById("archive-error");
    try {
      const response = await fetch(`/content/years/${encodeURIComponent(year)}.md?v=${Date.now()}`, {cache:"no-store"});
      if (!response.ok) throw new Error(`CMS-filen ${year}.md svarte HTTP ${response.status}`);
      const parsed = parseFrontmatter(await response.text());
      const data = parsed.data, body = parsed.body;

      const title = find(root, "[data-year-title]", "#archive-year");
      const subtitle = find(root, "[data-year-subtitle]", "#archive-subtitle");
      const lead = find(root, "[data-year-summary]", "#archive-summary") ||
                   document.querySelector(".page-hero .lead");
      if (title && clean(data.title)) title.textContent = clean(data.title);
      if (subtitle && clean(data.subtitle)) subtitle.textContent = clean(data.subtitle);
      if (lead && clean(data.summary)) lead.textContent = clean(data.summary);
      document.title = `${clean(data.title) || year} | NATTORDREN`;

      const story = find(root, "[data-year-body]", "#archive-story");
      const storyText = clean(data.body) || clean(body);
      if (story && storyText) story.innerHTML = markdown(storyText);

      const highlights = listValues(data.highlights);
      const highlightList = find(root, "[data-year-highlights]", "#archive-highlights");
      if (highlightList) {
        highlightList.innerHTML = highlights.map(x => `<li>${esc(x)}</li>`).join("");
        highlightList.hidden = highlights.length === 0;
      }
      const gallery = listValues(data.gallery);
      const gallerySection = find(root, "[data-gallery-section]", "#archive-gallery-section");
      const galleryNode = find(root, "[data-year-gallery]", "#archive-gallery");
      if (galleryNode && gallerySection) {
        galleryNode.innerHTML = gallery.map((item, i) => {
          const path = safePath(item);
          if (!path) return "";
          if (/\.(mp4|webm|mov)(?:[?#].*)?$/i.test(path)) {
            const type = /\.webm(?:[?#].*)?$/i.test(path) ? "video/webm" :
                         (/\.mov(?:[?#].*)?$/i.test(path) ? "video/quicktime" : "video/mp4");
            return `<figure class="archive-photo archive-video"><video controls preload="metadata" playsinline aria-label="NATTORDREN ${esc(year)} – filmklipp ${i+1}"><source src="${esc(path)}" type="${type}"></video></figure>`;
          }
          return `<figure class="archive-photo"><a href="${esc(path)}" target="_blank" rel="noopener"><img src="${esc(path)}" alt="NATTORDREN ${esc(year)} – bilde ${i+1}" loading="lazy"></a></figure>`;
        }).join("");
        gallerySection.hidden = !galleryNode.innerHTML;
      }
      if (errorNode) errorNode.hidden = true;
      console.info(`[NATTORDREN CMS] ${year} lastet`, {gallery:gallery.length, highlights:highlights.length});
    } catch (error) {
      console.error("[NATTORDREN CMS]", error);
      if (errorNode) {
        errorNode.textContent = `Kunne ikke laste årsinformasjonen (${error.message}).`;
        errorNode.hidden = false;
      }
      const story = find(root, "[data-year-body]", "#archive-story");
      if (story) story.innerHTML = `<p>Kunne ikke hente innholdet akkurat nå. Oppdater siden.</p>`;
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
