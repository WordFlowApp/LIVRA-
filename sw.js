const CACHE="livra-shell-v3";
const FILES=["./","./index.html","./styles.css","./app.js","./manifest.webmanifest","./icons/livra.svg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("livra-shell-")&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET")return;
 const u=new URL(e.request.url);
 if(e.request.mode==="navigate"||u.pathname.endsWith(".html")||u.pathname.endsWith(".js")||u.pathname.endsWith(".css")){
  e.respondWith(fetch(e.request,{cache:"no-store"}).then(res=>{if(res.ok)caches.open(CACHE).then(c=>c.put(e.request,res.clone()));return res}).catch(()=>caches.match(e.request).then(hit=>hit||caches.match("./index.html"))));
  return;
 }
 e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(res=>{if(res.ok)caches.open(CACHE).then(c=>c.put(e.request,res.clone()));return res})));
});