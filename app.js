const canvas = document.getElementById('render-canvas');
const ctx = canvas.getContext('2d');

const setupPanel = document.getElementById('setup-panel');
const progressSection = document.getElementById('progress-section');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const progressStages = document.getElementById('progress-stages');
const framesPreview = document.getElementById('frames-preview');
const framesGrid = document.getElementById('frames-grid');
const outputSection = document.getElementById('output-section');
const outputVideo = document.getElementById('output-video');
const downloadBtn = document.getElementById('download-btn');
const generateBtn = document.getElementById('generate-btn');
const newVideoBtn = document.getElementById('new-video-btn');

const stages = [
    { id: 'init', text: 'Initializing...', icon: 'Loading' },
    { id: 'gen', text: 'Generating AI images', icon: 'Generating' },
    { id: 'process', text: 'Processing frames', icon: 'Processing' },
    { id: 'encode', text: 'Creating video', icon: 'Creating' },
    { id: 'done', text: 'Complete!', icon: 'Done' }
];

const stylePrompts = {
    'cinematic': 'cinematic lighting, dramatic, film still, 8k uhd, high quality',
    'anime': 'anime style, manga art, vibrant colors, high quality anime',
    'realistic': 'photorealistic, ultra detailed, 8k uhd, sharp focus',
    'fantasy': 'fantasy art, magical, ethereal, enchanted, detailed illustration',
    '3d': '3d render, octane render, unreal engine, cgi, volumetric lighting',
    'watercolor': 'watercolor painting, soft colors, artistic, gallery quality',
    'cyberpunk': 'cyberpunk, neon lights, futuristic city, rain, dark atmosphere',
    'oil': 'oil painting, classical art, rich colors, canvas texture, masterpiece',
    'pixel': 'pixel art, retro game style, 16-bit, detailed pixel artwork',
    'comic': 'comic book style, bold lines, vibrant colors, graphic novel art'
};

function updateStages(currentId) {
    progressStages.innerHTML = '';
    stages.forEach((stage, idx) => {
        const currentIdx = stages.findIndex(s => s.id === currentId);
        const div = document.createElement('div');
        div.className = 'stage-item ' + (stage.id === currentId ? 'stage-active' : idx < currentIdx ? 'stage-done' : 'stage-waiting');
        div.innerHTML = `[${stage.icon}] ${stage.text}`;
        progressStages.appendChild(div);
    });
}

function setProgress(pct) {
    progressFill.style.width = `${Math.min(pct, 100)}%`;
    progressText.textContent = `${Math.min(pct, 100)}%`;
}

function showProgress() {
    progressSection.classList.remove('hidden');
    outputSection.classList.add('hidden');
    framesPreview.classList.add('hidden');
    framesGrid.innerHTML = '';
    setProgress(0);
}

function hideProgress() {
    progressSection.classList.add('hidden');
}

function showFrames(urls) {
    framesPreview.classList.remove('hidden');
    framesGrid.innerHTML = '';
    urls.forEach((url, i) => {
        const div = document.createElement('div');
        div.className = 'frame-item';
        div.innerHTML = `<img src="${url}" alt="Frame ${i+1}"><span class="frame-num">${i+1}</span>`;
        framesGrid.appendChild(div);
    });
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

async function generateAIVideo() {
    const prompt = document.getElementById('video-prompt').value.trim();
    if (!prompt) {
        alert('Please describe your video');
        return;
    }

    const style = document.getElementById('video-style').value;
    const numFrames = parseInt(document.getElementById('num-frames').value);
    const [width, height] = document.getElementById('resolution').value.split('x').map(Number);
    const fps = parseInt(document.getElementById('fps').value);
    const transition = document.getElementById('transition').value;
    const model = document.getElementById('model').value;

    const fullPrompt = `${prompt}, ${stylePrompts[style]}`;

    showProgress();
    setupPanel.classList.add('hidden');
    updateStages('init');
    generateBtn.disabled = true;

    try {
        updateStages('gen');
        const frameUrls = [];
        const seeds = [];
        for (let i = 0; i < numFrames; i++) {
            seeds.push(Math.floor(Math.random() * 999999));
        }

        for (let i = 0; i < numFrames; i++) {
            setProgress(5 + Math.round((i / numFrames) * 40));
            updateStages('gen');

            const seed = seeds[i];
            const modelName = model === 'turbo' ? 'turbo' : 'flux';
            const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${width}&height=${height}&seed=${seed}&model=${modelName}&nologo=true`;

            await new Promise(resolve => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    frameUrls.push(url);
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = url;
            });
        }

        if (frameUrls.length === 0) {
            throw new Error('Failed to generate any images');
        }

        showFrames(frameUrls);
        updateStages('process');
        setProgress(50);

        const transitionFrames = 5;
        const allCanvases = [];

        for (let i = 0; i < frameUrls.length; i++) {
            const img = await loadImage(frameUrls[i]);

            if (transition === 'zoom') {
                for (let f = 0; f <= transitionFrames; f++) {
                    canvas.width = width;
                    canvas.height = height;
                    const scale = 1 + (f * 0.08);
                    const drawW = width * scale;
                    const drawH = height * scale;
                    const x = (width - drawW) / 2;
                    const y = (height - drawH) / 2;
                    ctx.drawImage(img, x, y, drawW, drawH);
                    allCanvases.push(canvas.toDataURL('image/jpeg', 0.92));
                }
            } else if (transition === 'pan') {
                for (let f = 0; f <= transitionFrames; f++) {
                    canvas.width = width;
                    canvas.height = height;
                    const scale = 1.4;
                    const drawW = width * scale;
                    const drawH = height * scale;
                    const x = -((drawW - width) * (f / transitionFrames));
                    const y = (height - drawH) / 2;
                    ctx.drawImage(img, x, y, drawW, drawH);
                    allCanvases.push(canvas.toDataURL('image/jpeg', 0.92));
                }
            } else if (transition === 'fade' && i > 0) {
                const prevImg = await loadImage(frameUrls[i - 1]);
                for (let f = 0; f <= transitionFrames; f++) {
                    canvas.width = width;
                    canvas.height = height;
                    const alpha = f / transitionFrames;
                    ctx.globalAlpha = 1 - alpha;
                    ctx.drawImage(prevImg, 0, 0, width, height);
                    ctx.globalAlpha = alpha;
                    ctx.drawImage(img, 0, 0, width, height);
                    ctx.globalAlpha = 1;
                    allCanvases.push(canvas.toDataURL('image/jpeg', 0.92));
                }
            } else {
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                for (let f = 0; f < 3; f++) {
                    allCanvases.push(canvas.toDataURL('image/jpeg', 0.92));
                }
            }

            setProgress(50 + Math.round((i / frameUrls.length) * 25));
        }

        updateStages('encode');
        setProgress(80);

        const videoBlob = await recordVideo(allCanvases, fps);
        const videoUrl = URL.createObjectURL(videoBlob);

        showOutput(videoUrl, 'ai-video.webm');
        updateStages('done');
        setProgress(100);

    } catch (error) {
        alert('Error: ' + error.message);
    }

    hideProgress();
    setupPanel.classList.remove('hidden');
    generateBtn.disabled = false;
}

function recordVideo(dataUrls, fps) {
    return new Promise((resolve, reject) => {
        canvas.width = 768;
        canvas.height = 512;

        const stream = canvas.captureStream(fps);
        const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 2500000
        });

        const chunks = [];
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            resolve(blob);
        };

        mediaRecorder.onerror = () => reject(new Error('Recording failed'));

        mediaRecorder.start();

        let frameIndex = 0;
        const img = new Image();

        function drawNextFrame() {
            if (frameIndex >= dataUrls.length) {
                setTimeout(() => mediaRecorder.stop(), 100);
                return;
            }

            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                frameIndex++;
                setTimeout(drawNextFrame, 1000 / fps);
            };
            img.onerror = () => {
                frameIndex++;
                drawNextFrame();
            };
            img.src = dataUrls[frameIndex];
        }

        drawNextFrame();
    });
}

function showOutput(url, filename) {
    outputSection.classList.remove('hidden');
    outputVideo.src = url;
    downloadBtn.href = url;
    downloadBtn.download = filename;
}

newVideoBtn.addEventListener('click', () => {
    outputSection.classList.add('hidden');
    setupPanel.classList.remove('hidden');
});

generateBtn.addEventListener('click', generateAIVideo);

document.getElementById('video-prompt').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) generateAIVideo();
});
