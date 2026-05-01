self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // For FFmpeg core files, serve with proper headers
    if (url.pathname.includes('ffmpeg-core')) {
        const response = fetch(event.request).then((response) => {
            return response.blob().then((blob) => {
                const newHeaders = new Headers(response.headers);
                newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
                newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
                newHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');
                return new Response(blob, {
                    headers: newHeaders,
                    status: response.status,
                    statusText: response.statusText
                });
            });
        });
        event.respondWith(response);
        return;
    }

    event.respondWith(fetch(event.request));
});
