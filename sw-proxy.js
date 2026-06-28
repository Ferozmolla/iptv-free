const PROXY_URL = "https://api.allorigins.win/raw?url=";

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // .m3u8, .ts, এবং .mpd (DASH) ফাইলের জন্য প্রক্সি সাপোর্ট
    const isStreamFile = url.pathname.endsWith('.m3u8') || 
                         url.pathname.endsWith('.ts') || 
                         url.pathname.endsWith('.mpd') || 
                         url.href.includes('m3u8') || 
                         url.href.includes('.mpd');

    if (url.protocol === 'http:' && isStreamFile) {
        console.log('SW Proxy Intercepting:', url.href);
        
        const proxiedUrl = PROXY_URL + encodeURIComponent(url.href);
        
        event.respondWith(
            fetch(proxiedUrl, {
                mode: 'cors',
                credentials: 'omit'
            }).catch(err => {
                console.error('SW Proxy Fetch Error:', err);
                return fetch(event.request); 
            })
        );
    }
});
