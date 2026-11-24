(function(){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function getYear(y){const r=await fetch(`/content/years/${y}.md`);if(!r.ok)throw Error('not found');return await r.text();}
  function unquote(v){v=String(v??'').trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))return v.slice(1,-1);return v;}
  function parse(raw){
    const m=raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);let meta={};
    if(!m)return {meta,body:raw};
    const lines=m[1].split(/\r?\n/);
    for(let i=0;i<lines.length;i++){
      const line=lines[i];
      const key=line.match(/^([\w-]+):\s*(.*)$/);
      if(!key)continue;
      const k=key[1],v=key[2].trim();
      if(k==='gallery'){
        meta.gallery=[];
        if(v){
          const inline=v.match(/^\[(.*)\]$/);
          if(inline&&inline[1].trim())meta.gallery=inline[1].split(/,(?=(?:[^"']|"[^"]*"|'[^']*')*$)/).map(unquote).filter(Boolean);
          else meta.gallery=[unquote(v)];
        } else {
          while(i+1<lines.length && /^\s+-\s+/.test(lines[i+1])) meta.gallery.push(unquote(lines[++i].replace(/^\s+-\s+/,'')));
        }
        continue;
      }
      if(v==='|'||v==='|-'||v==='|+'||v==='>'||v==='>-'||v==='>+'){
        const block=[];
        while(i+1<lines.length && (/^\s+/.test(lines[i+1])||lines[i+1].trim()==='')){
          const next=lines[++i];
          block.push(next.trim()?next.replace(/^\s{1,}/,''):'' );
        }
        meta[k]=(v[0]==='>'?block.join(' ').replace(/\s+/g,' ').trim():block.join('\n')).trim();
      } else meta[k]=unquote(v);
    }
    return {meta,body:m[2]};
  }
  function md(s){
    let lines=esc(s).split(/\r?\n/),out=[],list=false;
    for(let line of lines){
      if(/^\s*[-*]\s+/.test(line)){if(!list){out.push('<ul>');list=true;}out.push('<li>'+line.replace(/^\s*[-*]\s+/, '')+'</li>');continue;}
      if(list){out.push('</ul>');list=false;}
      if(!line.trim())continue;
      if(line.startsWith('### '))out.push('<h3>'+line.slice(4)+'</h3>');
      else if(line.startsWith('## '))out.push('<h2>'+line.slice(3)+'</h2>');
      else if(line.startsWith('# '))out.push('<h2>'+line.slice(2)+'</h2>');
      else out.push('<p>'+line+'</p>');
    }
    if(list)out.push('</ul>');
    return out.join('\n');
  }
  const archive=document.querySelector('[data-archive-list]');
  if(archive){Promise.all(Array.from({length:10},(_,i)=>2018+i).map(async y=>{try{let p=parse(await getYear(y));return {y,m:p.meta};}catch(e){return {y,m:{year:y,title:'NATTORDREN '+y,subtitle:'Tilbakeblikk',summary:'Arkivinnhold kommer.'}};}})).then(items=>{archive.innerHTML=items.reverse().map(({y,m})=>`<a class="card archive-card" href="/arkiv/${y}/"><div class="number">${y===2018?'FØRSTE ÅR':y===2027?'ÅRETS MYSTERIUM':'TILBAKEBLIKK'}</div><h3>${esc(m.title||y)}</h3><p>${esc(m.summary||m.subtitle||'')}</p><span class="archive-link">Åpne ${y} →</span></a>`).join('');});}
  const yearNode=document.querySelector('[data-archive-year]');
  if(yearNode){
    const y=yearNode.getAttribute('data-archive-year');
    getYear(y).then(raw=>{
      const p=parse(raw),m=p.meta;
      const title=document.querySelector('[data-year-title]'),sub=document.querySelector('[data-year-subtitle]'),body=document.querySelector('[data-year-body]'),hi=document.querySelector('[data-year-highlights]');
      if(title)title.textContent=m.title||y;
      if(sub)sub.textContent=m.subtitle||'';
      if(body)body.innerHTML=md(p.body);
      if(hi){
        const points=String(m.highlights||'').split(/\r?\n/).map(x=>x.trim().replace(/^[-*]\s*/, '')).filter(Boolean);
        hi.innerHTML=points.map(x=>'<li>'+esc(x)+'</li>').join('');
        const heading=hi.previousElementSibling;
        if(heading&&heading.tagName==='H3')heading.hidden=points.length===0;
        hi.hidden=points.length===0;
      }
      const gallery=Array.isArray(m.gallery)?m.gallery:[];
      const gallerySection=document.querySelector('[data-gallery-section]'),galleryNode=document.querySelector('[data-year-gallery]');
      if(gallerySection&&galleryNode&&gallery.length){
        gallerySection.hidden=false;
        galleryNode.innerHTML=gallery.map((src,i)=>{const safe=esc(src);return `<a class="year-gallery-item" href="${safe}" target="_blank" rel="noopener"><img src="${safe}" alt="NATTORDREN ${esc(y)} – bilde ${i+1}" loading="lazy"></a>`;}).join('');
      }
    }).catch(()=>{const b=document.querySelector('[data-year-body]');if(b)b.textContent='Innholdet for dette året er ikke publisert ennå.';});
  }
})();
