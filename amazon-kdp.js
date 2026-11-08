(function(){
  const $=id=>document.getElementById(id);
  const screen=$("amazonEditorial");
  if(!screen)return;
  $("publishAmazon")?.addEventListener("click",function(){if(typeof show==="function")show("amazonEditorial");});
  $("kdpBackLibrary")?.addEventListener("click",function(){if(typeof show==="function")show("library");});
  $("kdpCopyMetadata")?.addEventListener("click",async function(){
    const formats=Array.from(screen.querySelectorAll('input[name="kdpFormat"]:checked')).map(el=>el.value);
    const payload={title:$("kdpBookTitle").value.trim(),author:$("kdpAuthor").value.trim(),description:$("kdpDescription").value.trim(),formats};
    if(!payload.title&&!payload.author&&!payload.description){if(typeof toast==="function")toast("Completá al menos un dato del libro.");return;}
    const text=["Título: "+payload.title,"Autor: "+payload.author,"Descripción: "+payload.description,"Formatos: "+(formats.join(", ")||"Sin seleccionar")].join("\n");
    try{await navigator.clipboard.writeText(text);if(typeof toast==="function")toast("Ficha de publicación copiada.");}
    catch(error){const area=document.createElement("textarea");area.value=text;screen.append(area);area.select();const ok=document.execCommand("copy");area.remove();if(typeof toast==="function")toast(ok?"Ficha de publicación copiada.":"No se pudo copiar la ficha.");}
  });
})();
