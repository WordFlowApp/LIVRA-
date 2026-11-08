(function(){
  const $=id=>document.getElementById(id);
  const screen=$("amazonEditorial");
  if(!screen)return;
  let selectedBook=null;
  const db=()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open("livra-local",4);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
  const readAll=async store=>{const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction(store,"readonly").objectStore(store).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});};
  const readOne=async(store,id)=>{const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction(store,"readonly").objectStore(store).get(id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});};
  const write=async(store,item)=>{const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction(store,"readwrite");tx.objectStore(store).put(item);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});};
  const toastMessage=message=>{if(typeof toast==="function")toast(message);else $("kdpProjectStatus").textContent=message;};
  const currentRoute=()=>screen.querySelector('input[name="kdpRoute"]:checked')?.value||"independent";
  const formats=()=>Array.from(screen.querySelectorAll('input[name="kdpFormat"]:checked')).map(el=>el.value);
  const collect=()=>({
    title:$("kdpBookTitle").value.trim(),
    author:$("kdpAuthor").value.trim(),
    description:$("kdpDescription").value.trim(),
    route:currentRoute(),
    formats:formats(),
    rightsConfirmed:$("kdpRightsConfirmed").checked,
    aiText:$("kdpAiText").value,
    aiImages:$("kdpAiImages").value,
    aiTranslations:$("kdpAiTranslations").value
  });
  function readiness(data){
    const checks=[
      ["Libro seleccionado",Boolean(selectedBook)],
      ["Título y autor",Boolean(data.title&&data.author)],
      ["Descripción comercial",Boolean(data.description)],
      ["Formato elegido",data.formats.length>0],
      ["Derechos confirmados",data.rightsConfirmed],
      ["Origen del texto",data.aiText!=="unknown"],
      ["Origen de imágenes",data.aiImages!=="unknown"],
      ["Origen de traducciones",data.aiTranslations!=="unknown"]
    ];
    $("kdpReadiness").replaceChildren();
    checks.forEach(([label,ok])=>{const row=document.createElement("div");row.className="kdp-readiness-row";const mark=document.createElement("span");mark.textContent=ok?"✓":"○";mark.className=ok?"is-done":"is-pending";const text=document.createElement("span");text.textContent=label;row.append(mark,text);$("kdpReadiness").append(row);});
    const ready=checks.every(item=>item[1]);
    const status=document.createElement("p");status.className="kdp-readiness-note";status.textContent=ready?"Ficha y declaraciones completas. Aún faltan generar y validar los archivos; no se envió nada a Amazon.":"Proyecto en preparación. Completá los puntos pendientes.";
    $("kdpReadiness").append(status);
    return ready;
  }
  function applyProject(project){
    $("kdpBookTitle").value=project.title||selectedBook?.title||"";
    $("kdpAuthor").value=project.author||selectedBook?.authorName||selectedBook?.author||"";
    $("kdpDescription").value=project.description||selectedBook?.summary||"";
    screen.querySelectorAll('input[name="kdpRoute"]').forEach(el=>el.checked=el.value===(project.route||"independent"));
    screen.querySelectorAll('input[name="kdpFormat"]').forEach(el=>el.checked=(project.formats||["ebook","paperback"]).includes(el.value));
    $("kdpRightsConfirmed").checked=Boolean(project.rightsConfirmed);
    $("kdpAiText").value=project.aiText||"unknown";
    $("kdpAiImages").value=project.aiImages||"unknown";
    $("kdpAiTranslations").value=project.aiTranslations||"unknown";
    readiness(collect());
  }
  async function loadBook(id){
    selectedBook=(await readAll("books")).find(book=>String(book.id)===String(id))||null;
    if(!selectedBook){$("kdpProjectStatus").textContent="Elegí un libro de tu biblioteca.";readiness(collect());return;}
    const project=await readOne("publicationProjects","book-"+selectedBook.id);
    applyProject(project||{});
    $("kdpProjectStatus").textContent="Libro seleccionado: "+(selectedBook.title||"Mi historia")+(project?" · Proyecto editorial recuperado":" · Nuevo proyecto editorial");
  }
  async function refreshBooks(){
    const books=(await readAll("books")).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    const select=$("kdpBookSelect");select.replaceChildren();
    const first=document.createElement("option");first.value="";first.textContent=books.length?"Elegí un libro de tu biblioteca":"Todavía no hay libros en tu biblioteca";select.append(first);
    books.forEach(book=>{const option=document.createElement("option");option.value=String(book.id);option.textContent=(book.title||"Mi historia")+" · "+(book.authorName||book.author||"Autor");select.append(option);});
    if(books.length===1){select.value=String(books[0].id);await loadBook(select.value);}
    else{selectedBook=null;readiness(collect());}
  }
  $("openEditorial")?.addEventListener("click",()=>{if(typeof show==="function")show("amazonEditorial");refreshBooks().catch(()=>toastMessage("No se pudo cargar tu biblioteca."));});
  $("publishAmazon")?.addEventListener("click",()=>{if(typeof show==="function")show("amazonEditorial");refreshBooks().catch(()=>toastMessage("No se pudo cargar tu biblioteca."));});
  $("kdpBackLibrary")?.addEventListener("click",()=>{if(typeof show==="function")show("library");});
  $("kdpBookSelect").addEventListener("change",event=>loadBook(event.target.value).catch(()=>toastMessage("No se pudo abrir el proyecto editorial.")));
  screen.querySelectorAll("input,textarea,select").forEach(el=>el.addEventListener("change",()=>readiness(collect())));
  ["kdpBookTitle","kdpAuthor","kdpDescription"].forEach(id=>$(id).addEventListener("input",()=>readiness(collect())));
  $("kdpSaveProject").addEventListener("click",async()=>{
    if(!selectedBook){toastMessage("Primero elegí un libro de tu biblioteca.");return;}
    const data=collect();
    const existing=await readOne("publicationProjects","book-"+selectedBook.id);
    const now=new Date().toISOString();
    const snapshot={...data,savedAt:now,version:(existing?.version||0)+1};
    const project={id:"book-"+selectedBook.id,bookId:selectedBook.id,createdAt:existing?.createdAt||now,updatedAt:now,version:snapshot.version,route:data.route,versions:[...(existing?.versions||[]),snapshot].slice(-30),...data,status:"draft",submissionStatus:"not-submitted"};
    await write("publicationProjects",project);
    $("kdpProjectStatus").textContent="Proyecto guardado en este dispositivo · versión "+project.version+". Todavía no fue enviado a Amazon.";
    readiness(data);toastMessage("Proyecto editorial guardado. Tu libro original no fue modificado.");
  });
  $("kdpCopyMetadata").addEventListener("click",async()=>{
    const data=collect();
    if(!selectedBook){toastMessage("Primero elegí un libro.");return;}
    const value=["Título: "+data.title,"Autor: "+data.author,"Descripción: "+data.description,"Formatos: "+data.formats.join(", "),"Modalidad: "+(data.route==="managed"?"Editorial LIBRA":"Autor independiente")].join("\n");
    try{await navigator.clipboard.writeText(value);toastMessage("Ficha de publicación copiada.");}
    catch(error){const area=document.createElement("textarea");area.value=value;screen.append(area);area.select();const ok=document.execCommand("copy");area.remove();toastMessage(ok?"Ficha copiada.":"No se pudo copiar la ficha.");}
  });

  function esc(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[ch]));}
  function bookSections(book){
    const pages=Array.isArray(book.pages)?book.pages:[];
    const sections=[];
    if(book.summary)sections.push({title:"Resumen",body:book.summary});
    if(book.prologue)sections.push({title:"Prólogo",body:book.prologue});
    pages.forEach((page,index)=>{if(page&&page.body)sections.push({title:page.heading||("Sección "+(index+1)),body:page.body});});
    if(!sections.length&&book.transcript)sections.push({title:"Mi historia",body:book.transcript});
    return sections;
  }
  function crc32(bytes){
    let crc=-1;
    for(let i=0;i<bytes.length;i++){crc^=bytes[i];for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    return (crc^-1)>>>0;
  }
  function makeZip(entries){
    const encoder=new TextEncoder(),local=[],central=[];let offset=0;
    const u16=(v)=>[v&255,(v>>>8)&255],u32=(v)=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
    entries.forEach(entry=>{
      const name=encoder.encode(entry.name),data=typeof entry.data==="string"?encoder.encode(entry.data):entry.data;
      const crc=crc32(data),method=0;
      const header=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(method),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...name]);
      local.push(header,data);
      const cdir=new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(method),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...name]);
      central.push(cdir);offset+=header.length+data.length;
    });
    const centralSize=central.reduce((n,x)=>n+x.length,0);
    const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(entries.length),...u16(entries.length),...u32(centralSize),...u32(offset),...u16(0)]);
    return new Blob([...local,...central,end],{type:"application/epub+zip"});
  }
  function downloadBlob(blob,name){
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;screen.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  $("kdpExportEpub").addEventListener("click",()=>{
    if(!selectedBook){toastMessage("Primero elegí un libro.");return;}
    const data=collect(),sections=bookSections(selectedBook);
    if(!sections.length){toastMessage("Este libro todavía no tiene texto para exportar.");return;}
    const title=data.title||selectedBook.title||"Mi historia",author=data.author||selectedBook.authorName||"Autor";
    const files=[{name:"mimetype",data:"application/epub+zip"},{name:"META-INF/container.xml",data:'<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'}];
    const manifest=[],spine=[];
    sections.forEach((section,index)=>{
      const id="chapter"+(index+1),file=id+".xhtml";
      const paragraphs=String(section.body).split(/\n{2,}/).map(p=>"<p>"+esc(p).replace(/\n/g,"<br/>")+"</p>").join("");
      files.push({name:"OEBPS/"+file,data:'<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="es"><head><title>'+esc(section.title)+'</title><meta charset="UTF-8"/><link rel="stylesheet" type="text/css" href="style.css"/></head><body><h1>'+esc(section.title)+'</h1>'+paragraphs+'</body></html>'});
      manifest.push('<item id="'+id+'" href="'+file+'" media-type="application/xhtml+xml"/>');spine.push('<itemref idref="'+id+'"/>');
    });
    files.push({name:"OEBPS/style.css",data:"body{font-family:serif;line-height:1.6;margin:5%;}h1{text-align:center;margin:2em 0;}p{text-indent:1.2em;margin:.6em 0;}"});
    files.push({name:"OEBPS/nav.xhtml",data:'<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="es"><head><title>Índice</title></head><body><nav epub:type="toc" id="toc"><h1>Contenido</h1><ol>'+sections.map((x,i)=>'<li><a href="chapter'+(i+1)+'.xhtml">'+esc(x.title)+'</a></li>').join("")+'</ol></nav></body></html>'});
    manifest.push('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>');
    files.push({name:"OEBPS/content.opf",data:'<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="es"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">urn:uuid:livra-'+String(selectedBook.id).replace(/[^a-zA-Z0-9-]/g,"")+'-'+Date.now()+'</dc:identifier><dc:title>'+esc(title)+'</dc:title><dc:creator>'+esc(author)+'</dc:creator><dc:language>es</dc:language></metadata><manifest>'+manifest.join("")+'</manifest><spine>'+spine.join("")+'</spine></package>'});
    downloadBlob(makeZip(files),(title.replace(/[^a-z0-9áéíóúñ_-]+/gi,"-").replace(/^-|-$/g,"")||"libra-libro")+".epub");
    toastMessage("EPUB generado. Revisalo en un lector antes de enviarlo a KDP.");
  });
  $("kdpPrintPdf").addEventListener("click",()=>{
    if(!selectedBook){toastMessage("Primero elegí un libro.");return;}
    const data=collect(),sections=bookSections(selectedBook);
    if(!sections.length){toastMessage("Este libro todavía no tiene texto para exportar.");return;}
    const title=data.title||selectedBook.title||"Mi historia",author=data.author||selectedBook.authorName||"Autor";
    const pages=sections.map(section=>'<section class="chapter"><h2>'+esc(section.title)+'</h2>'+String(section.body).split(/\n{2,}/).map(p=>"<p>"+esc(p).replace(/\n/g,"<br/>")+"</p>").join("")+'</section>').join("");
    const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><style>@page{size:6in 9in;margin:.75in}*{box-sizing:border-box}body{font-family:Georgia,serif;color:#171717;font-size:11pt;line-height:1.55}.cover{height:7.5in;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;page-break-after:always}.cover h1{font-size:28pt}.cover p{font-size:14pt}.chapter{page-break-before:always}.chapter h2{text-align:center;margin:1.2in 0 .7in;font-size:17pt}p{text-indent:1.2em;text-align:justify;margin:0 0 .7em}@media screen{body{max-width:720px;margin:24px auto;padding:24px;background:#fff}.cover{border:1px solid #ddd;margin-bottom:24px}.chapter{padding:24px;border:1px solid #ddd;margin-bottom:24px}}</style></head><body><section class="cover"><h1>'+esc(title)+'</h1><p>'+esc(author)+'</p></section>'+pages+'</body></html>';
    const blob=new Blob([html],{type:"text/html;charset=utf-8"});
    const url=URL.createObjectURL(blob),win=window.open(url,"_blank");
    if(!win){downloadBlob(blob,(title.replace(/[^a-z0-9áéíóúñ_-]+/gi,"-")||"libra-libro")+"-interior-imprimible.html");toastMessage("Se descargó la versión imprimible HTML. Abrila y elegí Imprimir / Guardar como PDF.");return;}
    toastMessage("Se abrió el interior maquetado. Desde Imprimir elegí Guardar como PDF; todavía requiere definir el tamaño final de impresión de KDP.");
  });
  const observer=new MutationObserver(()=>{if(screen.classList.contains("active"))refreshBooks().catch(()=>{});});
  observer.observe(screen,{attributes:true,attributeFilter:["class"]});
  refreshBooks().catch(()=>{});
})();