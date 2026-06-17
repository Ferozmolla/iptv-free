// IPTV PRO V51 - Ultra Pro Player with YouTube, M3U8, TS & MPD Support
// Optimized for Smart TV, Mobile & PC with Advanced Proxy & Buffering

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const streamUrl = params.get('url') || localStorage.getItem('currentStreamUrl');
    const streamName = params.get('name') || localStorage.getItem('currentStreamName');
    const isSlowNetwork = params.get('slownet') === '1' || localStorage.getItem('isSlowNetwork') === 'true';
    
    const playerWrapper = document.getElementById('player-wrapper');
    const loading = document.getElementById('loading');
    const errorMsg = document.getElementById('error-msg');
    const errDetail = document.getElementById('err-detail');
    const playerTitle = document.getElementById('player-title');

    if (streamName && playerTitle) {
        playerTitle.innerText = streamName;
        document.title = `Playing: ${streamName} - IPTV PRO`;
    }

    if (!streamUrl) {
        showError("No valid stream URL provided.");
        return;
    }

    console.log("Pro Player V51: Loading stream:", streamUrl.substring(0, 50) + "...");

    // Enhanced Proxy List for CORS & Mixed Content
    const proxies = [
        "", // Direct (no proxy)
        "https://api.allorigins.win/raw?url=",
        "https://corsproxy.io/?url=",
        "https://api.codetabs.com/v1/proxy?quest=",
        "https://thingproxy.freeboard.io/fetch/",
        "https://proxy.cors.sh/",
        "https://cors-anywhere.herokuapp.com/"
    ];

    let currentProxyIndex = 0;
    let engineIndex = 0;
    let failureCount = 0;
    const engines = ['hls', 'dash', 'native', 'clappr', 'fallback'];
    const maxFailures = proxies.length * engines.length;

    // Pro-level configuration
    const proConfig = {
        hlsConfig: {
            enableWorker: true,
            lowLatencyMode: !isSlowNetwork,
            backBufferLength: 90,
            maxBufferLength: isSlowNetwork ? 180 : 120,
            maxMaxBufferLength: isSlowNetwork ? 300 : 240,
            manifestLoadingTimeOut: 20000,
            manifestLoadingMaxRetry: 5,
            levelLoadingTimeOut: 20000,
            levelLoadingMaxRetry: 5,
            fragLoadingTimeOut: 30000,
            fragLoadingMaxRetry: 6,
            startLevel: isSlowNetwork ? 0 : -1,
            xhrSetup: function(xhr, url) {
                xhr.withCredentials = false;
            }
        },
        shakaConfig: {
            streaming: {
                bufferingGoal: isSlowNetwork ? 60 : 30,
                rebufferingGoal: isSlowNetwork ? 15 : 10,
                bufferBehind: 30
            }
        }
    };

    function extractYouTubeVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([^&\n?#]+)/
        ];
        for (let pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) return match[1];
        }
        return null;
    }

    function isYouTubeUrl(url) {
        return /(?:youtube\.com|youtu\.be)/.test(url);
    }

    function playYouTubeVideo(videoId) {
        playerWrapper.innerHTML = `
            <iframe 
                id="youtube-player"
                width="100%" 
                height="100%" 
                src="https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&modestbranding=1&rel=0&fs=1" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                allowfullscreen
                style="border: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
            </iframe>
        `;
        hideLoading();
    }

    function tryNextEngine(url) {
        playerWrapper.innerHTML = "";
        
        if (isYouTubeUrl(url)) {
            const videoId = extractYouTubeVideoId(url);
            if (videoId) {
                playYouTubeVideo(videoId);
                return;
            }
        }
        
        const isPageHttps = window.location.protocol === 'https:';
        const isStreamHttp = url.startsWith('http:');
        
        let finalUrl = url;
        
        if (isPageHttps && isStreamHttp && currentProxyIndex === 0) {
            currentProxyIndex = 1; // Force proxy for mixed content
        }
        
        if (currentProxyIndex > 0) {
            finalUrl = proxies[currentProxyIndex] + encodeURIComponent(url);
        }

        const currentEngine = engines[engineIndex];
        const isM3U8 = url.toLowerCase().includes('.m3u8');
        const isTS = url.toLowerCase().includes('.ts');
        const isMPD = url.toLowerCase().includes('.mpd');

        console.log(`Engine: ${currentEngine}, Proxy: ${currentProxyIndex}, Format: ${isM3U8 ? 'HLS' : isTS ? 'TS' : isMPD ? 'DASH' : 'Other'}`);

        if (isMPD || currentEngine === 'dash') {
            tryShaka(finalUrl);
        } else if (isM3U8 || isTS || currentEngine === 'hls') {
            if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                tryHlsJs(finalUrl, isTS);
            } else {
                tryNativeVideo(finalUrl, isTS);
            }
        } else {
            tryNativeVideo(finalUrl);
        }
    }

    function tryHlsJs(url, isTS = false) {
        playerWrapper.innerHTML = '<video id="video-player" class="pro-video" controls autoplay playsinline crossorigin="anonymous"></video>';
        const video = document.getElementById('video-player');
        
        const hls = new Hls(proConfig.hlsConfig);
        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
            hideLoading();
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                hls.destroy();
                handleFailure();
            }
        });
    }

    function tryNativeVideo(url, isTS = false) {
        const typeStr = isTS ? 'type="video/mp2t"' : (url.includes('.m3u8') ? 'type="application/x-mpegURL"' : 'type="video/mp4"');
        playerWrapper.innerHTML = `<video id="video-player" class="pro-video" controls autoplay playsinline crossorigin="anonymous"><source src="${url}" ${typeStr}></video>`;
        const video = document.getElementById('video-player');

        video.oncanplay = () => {
            video.play().catch(() => {});
            hideLoading();
        };

        video.onerror = () => handleFailure();
    }

    function tryShaka(url) {
        playerWrapper.innerHTML = '<video id="video-player" class="pro-video" controls autoplay playsinline crossorigin="anonymous"></video>';
        const video = document.getElementById('video-player');
        
        if (typeof shaka !== 'undefined') {
            const player = new shaka.Player(video);
            player.configure(proConfig.shakaConfig);
            player.load(url).then(() => {
                hideLoading();
            }).catch(() => handleFailure());
        } else {
            handleFailure();
        }
    }

    function handleFailure() {
        failureCount++;
        if (failureCount >= maxFailures) {
            showError("All playback methods failed. Please check the link.");
            return;
        }
        
        if (currentProxyIndex < proxies.length - 1) {
            currentProxyIndex++;
        } else {
            currentProxyIndex = 0;
            engineIndex++;
        }
        setTimeout(() => tryNextEngine(streamUrl), 100);
    }

    function hideLoading() {
        if (loading) loading.style.display = 'none';
        if (errorMsg) errorMsg.style.display = 'none';
    }

    function showError(msg) {
        if (loading) loading.style.display = 'none';
        if (errorMsg) {
            errorMsg.style.display = 'block';
            if (errDetail) errDetail.innerText = msg;
        }
    }

    tryNextEngine(streamUrl);
});
