/* NATTORDREN – leser Pages CMS-årsarkiv og viser tekst, bilder og video. */
(() => {
  "use strict";
  const clean = v => String(v ?? "").trim();
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
  function unquote(v) {
    v=clean(v);
    if ((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) return v.slice(1,-1);
    return v;
  }
  function parseFrontmatter(source) {
    source=String(source||"").replace(/^\uFEFF/,"").replace(/\r\n/g,"\n").replace(/\r/g,"\n").trimStart();
    const lines=source.split("\n");
    if(lines[0]?.trim()!=="---") return {data:{},body:source};
    const close=lines.findIndex((line,i)=>i>0&&line.trim()==="---");
    if(close<0) return {data:{},body:source};
    const data={};
    for(let i=1;i<close;i++){
      const m=lines[i].match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
      if(!m)continue;
      const key=m[1],value=m[2]??"";
      if(["|","|-","|+",">",">-",">+"].includes(value.trim())){
        const block=[];while(i+1<close&&(/^\s+/.test(lines[i+1])||!lines[i+1].trim())){const x=lines[++i];block.push(x.trim()?x.replace(/^\s+/,""):"")}
        data[key]=value.trim().startsWith(">")?block.join(" ").trim():block.join("\n").trim();
      } else if(!value.trim()){
        const items=[];let j=i+1;
        while(j<close&&/^\s+-\s*/.test(lines[j]))items.push(unquote(lines[j++].replace(/^\s+-\s*/,"")));
        if(items.length){data[key]=items;i=j-1}else data[key]="";
      } else {
        const inline=value.trim().match(/^\[(.*)\]$/);
        data[key]=inline?inline[1].split(",").map(unquote):unquote(value);
      }
    }
    return {data,body:lines.slice(close+1).join("\n")};
  }
  function values(v){
    if(Array.isArray(v))return v.map(clean).filter(Boolean);
    const s=clean(v);if(!s)return [];
    return s.split(/\r?\n/).map(x=>x.replace(/^\s*[-*]\s*/,"").trim()).filter(Boolean);
  }
  function markdown(source){
    const lines=clean(source).split(/\r?\n/),out=[];let list=[];
    const flush=()=>{if(list.length){out.push("<ul>"+list.map(x=>`<li>${esc(x)}</li>`).join("")+"</ul>");list=[]}};
    for(const raw of lines){const line=raw.trim();if(!line){flush();continue}
      if(/^[-*]\s+/.test(line)){list.push(line.replace(/^[-*]\s+/,""));continue}
      flush();
      if(line.startsWith("### "))out.push(`<h3>${esc(line.slice(4))}</h3>`);
      else if(line.startsWith("## "))out.push(`<h2>${esc(line.slice(3))}</h2>`);
      else if(line.startsWith("# "))out.push(`<h2>${esc(line.slice(2))}</h2>`);
      else out.push(`<p>${esc(line)}</p>`);
    }flush();return out.join("\n");
  }
  function safePath(v){
    const p=clean(v);if(!p||/^(javascript|data):/i.test(p))return "";
    if(/^https?:\/\//i.test(p))return p;
    return p.startsWith("/")?p:"/"+p.replace(/^\.?\//,"");
  }
  async function init(){
    const root=document.querySelector("[data-archive-year]");if(!root)return;
    const year=root.getAttribute("data-archive-year");
    try{
      const r=await fetch(`/content/years/${encodeURIComponent(year)}.md?v=${Date.now()}`,{cache:"no-store"});
      if(!r.ok)throw Error(`CMS-innhold for ${year} ble ikke funnet (${r.status})`);
      const {data,body}=parseFrontmatter(await r.text());
      const putText=(selector,value)=>{const el=root.querySelector(selector)||document.querySelector(selector);if(el&&clean(value))el.textContent=clean(value)};
      putText("[data-year-title]",data.title||year);
      putText("[data-year-subtitle]",data.subtitle||"Årsarkiv");
      const lead=root.querySelector(".page-hero .lead")||document.querySelector(".page-hero .lead");
      if(lead&&clean(data.summary))lead.textContent=clean(data.summary);
      const story=root.querySelector("[data-year-body]");
      const storyText=clean(data.body)||clean(body);
      if(story&&storyText)story.innerHTML=markdown(storyText);
      const highlights=values(data.highlights),highlightList=root.querySelector("[data-year-highlights]");
      if(highlightList){highlightList.innerHTML=highlights.map(x=>`<li>${esc(x)}</li>`).join("");const heading=highlightList.previousElementSibling;if(heading&&heading.tagName==="H3")heading.hidden=!highlights.length;highlightList.hidden=!highlights.length}
      const gallery=values(data.gallery),gallerySection=root.querySelector("[data-gallery-section]"),galleryNode=root.querySelector("[data-year-gallery]");
      if(galleryNode&&gallerySection){
        galleryNode.innerHTML=gallery.map((item,i)=>{
          const path=safePath(item);if(!path)return "";
          if(/\.(mp4|webm|mov)(?:[?#].*)?$/i.test(path)){
            const type=/\.webm(?:[?#].*)?$/i.test(path)?"video/webm":(/\.mov(?:[?#].*)?$/i.test(path)?"video/quicktime":"video/mp4");
            return `<figure class="archive-photo archive-video"><video controls preload="metadata" playsinline aria-label="NATTORDREN ${esc(year)} – filmklipp ${i+1}"><source src="${esc(path)}" type="${type}"></video></figure>`;
          }
          return `<figure class="archive-photo"><a href="${esc(path)}" target="_blank" rel="noopener"><img src="${esc(path)}" alt="NATTORDREN ${esc(year)} – bilde ${i+1}" loading="lazy"></a></figure>`;
        }).join("");
        gallerySection.hidden=!galleryNode.innerHTML;
      }
      document.title=`${clean(data.title)||year} | NATTORDREN`;
    }catch(e){console.error("[NATTORDREN CMS]",e);const msg=root.querySelector("[data-archive-error]");if(msg){msg.textContent="Arkivinnholdet kunne ikke lastes. Prøv å oppdatere siden.";msg.hidden=false}}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
