const CACHE='piper-icon-refresh-20261108-2358';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(Promise.all([
  self.clients.claim(),
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
])));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||!['http:','https:'].includes(url.protocol))return;
  if(/manifest-.*\.webmanifest$/.test(url.pathname)||/\/icons\/.*\.(png|webp|svg)$/.test(url.pathname)){
    event.respondWith(fetch(request,{cache:'reload'}));return;
  }
  if(request.mode==='navigate'){event.respondWith(fetch(request));return;}
  event.respondWith(fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));return response}).catch(()=>caches.match(request)));
});
