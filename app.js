const { createFFmpeg, fetchFile } = FFmpeg;

let ffmpeg = null;
let slideshowImages = [];
let mergeVideos = [];

const loadingScreen = document.getElementById('loading-screen');
const appContent = document.getElementById('app-content');
const setupPanel = document.getElementById('setup-panel');
const progressSection = document.getElementById('progress-section');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const progressLog = document.getElementById('progress-log');
const progressStages = document.getElementById('progress-stages');
const framesPreview = document.getElementById('frames-preview');
const framesGrid = document.getElementById('frames-grid');
const outputSection = document.getElementById('output-section');
const outputVideo = document.getElementById('output-video');
const downloadBtn = document.getElementById('download-btn');
const newVideoBtn = document.getElementById('new-video-btn');

const stages = [
    { id: 'init', text: 'Initializing AI', icon: '⏳' },
    { id: 'gen', text: 'Generating AI images', icon: '🎨' },
    { id: 'process', text: 'Processing frames', icon: '🖼️' },
    { id: 'encode', text: 'Encoding video', icon: '🎬' },
    { id: 'done', text: 'Complete!', icon: '✅' }
];

async function initApp() {
    ffmpeg = createFFmpeg({ log: false });
    await ffmpeg.load();

    const savedToken = localStorage.getItem('hf_token');
    if (savedToken) {
        document.getElementById('hf-token').value = savedToken;
    }

    loadingScreen.classList.add('hidden');
    appContent.classList.remove('hidden');
}

function updateStages(currentStageId) {
    progressStages.innerHTML = '';
    stages.forEach(stage => {
        const div = document.createElement('div');
        div.className = 'stage-item';
        if (stage.id === currentStageId) {
            div.classList.add('stage-active');
        } else {
            const idx = stages.findIndex(s => s.id === stage.id);
            const currentIdx = stages.findIndex(s => s.id === currentStageId);
            if (idx < currentIdx) {
                div.classList.add('stage-done');
            } else {
                div.classList.add('stage-waiting');
            }
        }
        div.innerHTML = `<span class="stage-icon">${stage.icon}</span> ${stage.text}`;
        progressStages.appendChild(div);
    });
}

function setProgress(percent) {
    progressFill.style.width = `${Math.min(percent, 100)}%`;
    progressText.textContent = `${Math.min(percent, 100)}%`;
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

function showOutput(url, filename) {
    outputSection.classList.remove('hidden');
    outputVideo.src = url;
    downloadBtn.href = url;
    downloadBtn.download = filename;
}

function showFrames(images) {
    framesPreview.classList.remove('hidden');
    framesGrid.innerHTML = '';
    images.forEach((img, i) => {
        const div = document.createElement('div');
        div.className = 'frame-item';
        div.innerHTML = `<img src="${img}" alt="Frame ${i + 1}"><span class="frame-num">${i + 1}</span>`;
        framesGrid.appendChild(div);
    });
}

const stylePrompts = {
    'cinematic': 'cinematic lighting, dramatic, film still, 8k uhd, high quality, photorealistic',
    'anime': 'anime style, manga art, studio ghibli, vibrant colors, high quality anime art',
    'realistic': 'photorealistic, ultra detailed, 8k uhd, dslr, high quality, sharp focus',
    'fantasy': 'fantasy art, magical, ethereal, enchanted, detailed fantasy illustration',
    '3d-render': '3d render, octane render, unreal engine, cgi, volumetric lighting, 8k',
    'watercolor': 'watercolor painting, soft colors, artistic, delicate brush strokes, gallery quality',
    'cyberpunk': 'cyberpunk, neon lights, futuristic city, rain, dark atmosphere, blade runner style',
    'oil-painting': 'oil painting, classical art, renaissance style, rich colors, canvas texture, masterpiece'
};

const negativePrompt = 'blurry, low quality, distorted, ugly, deformed, text, watermark, signature, extra limbs';

async function generateAIImage(prompt, width, height, model, token) {
    const apiUrl = `https://api-inference.huggingface.co/models/${model}`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;
    
    const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'x-wait-for-model': 'true'
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                negative_prompt: negativePrompt,
                width: width,
                height: height,
                num_inference_steps: 20,
                guidance_scale: 7.5
            }
        })
    });

    if (response.status === 503) {
        const data = await response.json();
        const waitTime = data.estimated_time || 20;
        log(`Model loading, waiting ${Math.ceil(waitTime)}s...`);
        await new Promise(r => setTimeout(r, waitTime * 1000));
        return generateAIImage(prompt, width, height, model, token);
    }

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API Error ${response.status}: ${error}`);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
}

function log(msg) {
    progressLog.textContent = msg;
    console.log(msg);
}

async function generateAIVideo() {
    const token = document.getElementById('hf-token').value.trim();
    const prompt = document.getElementById('video-prompt').value.trim();

    if (!token) {
        alert('Please enter a Hugging Face token');
        return;
    }
    if (!prompt) {
        alert('Please describe your video');
        return;
    }

    localStorage.setItem('hf_token', token);

    const style = document.getElementById('video-style').value;
    const numFrames = parseInt(document.getElementById('num-frames').value);
    const [width, height] = document.getElementById('resolution').value.split('x').map(Number);
    const fps = parseInt(document.getElementById('fps').value);
    const model = document.getElementById('ai-model').value;
    const transition = document.getElementById('transition').value;

    const fullPrompt = `${prompt}, ${stylePrompts[style]}`;

    showProgress();
    setupPanel.classList.add('hidden');
    updateStages('init');
    setProgress(5);

    try {
        const frameUrls = [];
        const seeds = [];
        for (let i = 0; i < numFrames; i++) {
            seeds.push(Math.floor(Math.random() * 999999));
        }

        updateStages('gen');
        log(`Generating ${numFrames} AI images with ${model}...`);

        for (let i = 0; i < numFrames; i++) {
            setProgress(10 + Math.round((i / numFrames) * 50));
            log(`Generating frame ${i + 1}/${numFrames}...`);

            const framePrompt = `${fullPrompt}, seed:${seeds[i]}, variation`;
            const imgUrl = await generateAIImage(framePrompt, width, height, model, token);
            frameUrls.push(imgUrl);

            log(`Frame ${i + 1} generated`);
        }

        showFrames(frameUrls);
        updateStages('process');
        setProgress(65);
        log('Converting AI images to video frames...');

        for (let i = 0; i < frameUrls.length; i++) {
            const response = await fetch(frameUrls[i]);
            const blob = await response.blob();

            if (transition === 'crossfade') {
                const img = await loadImage(blob);
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                for (let f = 0; f < 3; f++) {
                    ctx.fillStyle = '#000';
                    ctx.fillRect(0, 0, width, height);

                    if (i === 0) {
                        ctx.globalAlpha = 1;
                        ctx.drawImage(img, 0, 0, width, height);
                    } else {
                        ctx.globalAlpha = (f + 1) / 3;
                        ctx.drawImage(img, 0, 0, width, height);
                        if (i > 0) {
                            ctx.globalAlpha = 1 - (f + 1) / 3;
                            ctx.drawImage(frameUrls[i - 1], 0, 0, width, height);
                        }
                    }

                    const outBlob = await canvasToBlob(canvas);
                    await ffmpeg.FS('writeFile', `frame_${String(i * 3 + f).padStart(4, '0')}.png`, await fetchFile(outBlob));
                }
            } else if (transition === 'zoom') {
                const img = await loadImage(blob);
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                for (let f = 0; f < 3; f++) {
                    ctx.fillStyle = '#000';
                    ctx.fillRect(0, 0, width, height);

                    const zoom = 1 + (f * 0.05);
                    const drawW = width * zoom;
                    const drawH = height * zoom;
                    const x = (width - drawW) / 2;
                    const y = (height - drawH) / 2;

                    ctx.drawImage(img, x, y, drawW, drawH);

                    const outBlob = await canvasToBlob(canvas);
                    await ffmpeg.FS('writeFile', `frame_${String(i * 3 + f).padStart(4, '0')}.png`, await fetchFile(outBlob));
                }
            } else {
                await ffmpeg.FS('writeFile', `frame_${String(i * 3).padStart(4, '0')}.png`, await fetchFile(blob));
                for (let f = 1; f < 3; f++) {
                    await ffmpeg.FS('writeFile', `frame_${String(i * 3 + f).padStart(4, '0')}.png`, await fetchFile(blob));
                }
            }
        }

        updateStages('encode');
        setProgress(85);
        log('Encoding video with FFmpeg...');

        const totalFrames = frameUrls.length * 3;
        await ffmpeg.run(
            '-framerate', String(fps),
            '-i', 'frame_%04d.png',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-preset', 'ultrafast',
            '-crf', '23',
            'output.mp4'
        );

        const data = ffmpeg.FS('readFile', 'output.mp4');
        const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
        const videoUrl = URL.createObjectURL(videoBlob);

        for (let i = 0; i < totalFrames; i++) {
            ffmpeg.FS('unlink', `frame_${String(i).padStart(4, '0')}.png`);
        }

        frameUrls.forEach(url => URL.revokeObjectURL(url));

        showOutput(videoUrl, 'ai-generated-video.mp4');
        updateStages('done');
        setProgress(100);

    } catch (error) {
        console.error('Error:', error);
        if (error.message.includes('401')) {
            alert('Invalid token. Please check your Hugging Face token.');
        } else {
            alert('Error: ' + error.message);
        }
    }

    hideProgress();
    setupPanel.classList.remove('hidden');
}

function loadImage(fileOrBlob) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(fileOrBlob);
    });
}

function canvasToBlob(canvas) {
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
}

function switchToTool(tool) {
    document.getElementById(`tool-${tool}`).classList.remove('hidden');
    document.querySelector('.tools-grid').classList.add('hidden');
    document.querySelector('#tools-section h2').classList.add('hidden');
}

function hideTools() {
    document.querySelectorAll('.tool-panel').forEach(p => p.classList.add('hidden'));
    document.querySelector('.tools-grid').classList.remove('hidden');
    document.querySelector('#tools-section h2').classList.remove('hidden');
}

newVideoBtn.addEventListener('click', () => {
    outputSection.classList.add('hidden');
    setupPanel.classList.remove('hidden');
});

document.getElementById('generate-ai-video').addEventListener('click', generateAIVideo);

document.getElementById('slideshow-upload').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    const preview = document.getElementById('slideshow-preview');
    files.forEach((file, i) => {
        const id = Date.now() + i;
        slideshowImages.push({ id, file });
        const reader = new FileReader();
        reader.onload = (ev) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.id = `slide-${id}`;
            div.innerHTML = `<img src="${ev.target.result}"><button class="remove" onclick="removeSlide(${id})">x</button>`;
            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
    e.target.value = '';
});

function removeSlide(id) {
    slideshowImages = slideshowImages.filter(img => img.id !== id);
    document.getElementById(`slide-${id}`)?.remove();
}

document.getElementById('create-slideshow-btn').addEventListener('click', async () => {
    if (slideshowImages.length === 0) {
        alert('Upload at least one image');
        return;
    }

    showProgress();
    updateStages('init');

    try {
        const dur = parseInt(document.getElementById('slide-dur').value);
        const trans = document.getElementById('slide-trans').value;
        const fps = 30;
        const framesPerSlide = dur * fps;

        for (let i = 0; i < slideshowImages.length; i++) {
            const img = await loadImage(slideshowImages[i].file);
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            for (let f = 0; f < framesPerSlide; f++) {
                if (trans === 'crossfade' && f < 10 && i > 0) {
                    ctx.fillStyle = '#000';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.globalAlpha = f / 10;
                    ctx.drawImage(img, 0, 0);
                    ctx.globalAlpha = 1;
                } else {
                    ctx.drawImage(img, 0, 0);
                }

                const blob = await canvasToBlob(canvas);
                const frameNum = i * framesPerSlide + f;
                await ffmpeg.FS('writeFile', `slide_${String(frameNum).padStart(6, '0')}.png`, await fetchFile(blob));
                setProgress(Math.round(((i * framesPerSlide + f) / (slideshowImages.length * framesPerSlide)) * 70));
            }
        }

        updateStages('encode');
        await ffmpeg.run(
            '-framerate', String(fps),
            '-i', 'slide_%06d.png',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-preset', 'ultrafast',
            'slideshow.mp4'
        );

        const data = ffmpeg.FS('readFile', 'slideshow.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        showOutput(url, 'slideshow.mp4');

        const totalFrames = slideshowImages.length * framesPerSlide;
        for (let i = 0; i < totalFrames; i++) {
            ffmpeg.FS('unlink', `slide_${String(i).padStart(6, '0')}.png`);
        }

    } catch (error) {
        alert('Error: ' + error.message);
    }
    hideProgress();
});

document.getElementById('merge-upload').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    const preview = document.getElementById('merge-preview');
    files.forEach((file, i) => {
        const id = Date.now() + i;
        mergeVideos.push({ id, file });
        const url = URL.createObjectURL(file);
        const div = document.createElement('div');
        div.className = 'preview-item';
        div.id = `merge-${id}`;
        div.innerHTML = `<video src="${url}"></video><button class="remove" onclick="removeMerge(${id})">x</button>`;
        preview.appendChild(div);
    });
    e.target.value = '';
});

function removeMerge(id) {
    mergeVideos = mergeVideos.filter(v => v.id !== id);
    document.getElementById(`merge-${id}`)?.remove();
}

document.getElementById('merge-btn').addEventListener('click', async () => {
    if (mergeVideos.length < 2) {
        alert('Upload at least 2 videos');
        return;
    }

    showProgress();
    updateStages('init');

    try {
        for (let i = 0; i < mergeVideos.length; i++) {
            await ffmpeg.FS('writeFile', `input${i}.mp4`, await fetchFile(mergeVideos[i].file));
            setProgress(Math.round(((i + 1) / mergeVideos.length) * 30));
        }

        const fileList = mergeVideos.map((_, i) => `file 'input${i}.mp4'`).join('\n');
        await ffmpeg.FS('writeFile', 'list.txt', new TextEncoder().encode(fileList));

        updateStages('encode');
        await ffmpeg.run('-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', 'merged.mp4');

        const data = ffmpeg.FS('readFile', 'merged.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        showOutput(url, 'merged.mp4');

        for (let i = 0; i < mergeVideos.length; i++) {
            ffmpeg.FS('unlink', `input${i}.mp4`);
        }
        ffmpeg.FS('unlink', 'list.txt');

    } catch (error) {
        alert('Error: ' + error.message);
    }
    hideProgress();
});

document.getElementById('convert-btn').addEventListener('click', async () => {
    const file = document.getElementById('convert-upload').files[0];
    if (!file) {
        alert('Upload a video');
        return;
    }

    showProgress();
    updateStages('init');

    try {
        const format = document.getElementById('conv-format').value;
        await ffmpeg.FS('writeFile', 'input', await fetchFile(file));

        updateStages('encode');
        const args = ['-i', 'input'];
        if (format === 'gif') {
            args.push('-vf', 'fps=10,scale=640:-1:flags=lanczos', '-loop', '0');
        } else if (format === 'webm') {
            args.push('-c:v', 'libvpx-vp9', '-c:a', 'libvorbis');
        } else {
            args.push('-c:v', 'libx264', '-c:a', 'aac');
        }
        args.push('-preset', 'ultrafast', `output.${format}`);

        await ffmpeg.run(...args);

        const data = ffmpeg.FS('readFile', `output.${format}`);
        const mimeMap = { gif: 'image/gif', webm: 'video/webm', mp4: 'video/mp4' };
        const blob = new Blob([data.buffer], { type: mimeMap[format] });
        const url = URL.createObjectURL(blob);
        showOutput(url, `converted.${format}`);

        ffmpeg.FS('unlink', 'input');

    } catch (error) {
        alert('Error: ' + error.message);
    }
    hideProgress();
});

initApp().catch(err => {
    loadingScreen.innerHTML = `<p style="color: #e74c3c;">Failed to load. Please refresh.</p><p>${err.message}</p>`;
});
