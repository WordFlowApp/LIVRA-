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
  const observer=new MutationObserver(()=>{if(screen.classList.contains("active"))refreshBooks().catch(()=>{});});
  observer.observe(screen,{attributes:true,attributeFilter:["class"]});
  refreshBooks().catch(()=>{});
})();