(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LIVRACommandParser=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  function normalize(input){
    return String(input||"")
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .toLocaleLowerCase("es-AR")
      .replace(/[¿?¡!.,;:]/g," ")
      .replace(/\s+/g," ").trim()
      .replace(/^(?:hola\s+)?libra(?:\s+|$)/,"")
      .replace(/\bpor favor\b/g,"").replace(/\s+/g," ").trim();
  }
  const rules=[
    {intent:"openLibrary",pattern:/^(?:abrir|mostrar|mostrame|ir a|ver) (?:mi )?biblioteca$|^mis libros$/},
    {intent:"openRecordings",pattern:/^(?:abrir|mostrar|ver|ir a) (?:mis )?grabaciones$/},
    {intent:"openEditorial",pattern:/^(?:abrir|mostrar|ir a) (?:mi )?editorial$|^preparar mi libro para amazon(?: kdp)?$/},
    {intent:"goHome",pattern:/^(?:ir|volver) al inicio$|^inicio$/},
    {intent:"startRecording",pattern:/^(?:comenzar|empezar|iniciar) a grabar$|^grabar$|^contar mi historia$/},
    {intent:"stopListening",pattern:/^(?:cancelar|detener|parar) (?:la )?(?:escucha|comando|comandos)$/}
  ];
  function parse(input){
    const normalized=normalize(input);
    if(!normalized)return null;
    for(const rule of rules)if(rule.pattern.test(normalized))return {intent:rule.intent,transcript:String(input||"").trim()};
    return null;
  }
  return {normalize,parse};
});
