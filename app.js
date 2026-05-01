const { FFmpeg } = FFmpegWASM;
const { fetchFile } = FFmpegUtil;

let ffmpeg = null;
let uploadedImages = [];
let uploadedVideos = [];

// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const appContent = document.getElementById('app-content');
const progressSection = document.getElementById('progress-section');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const progressLog = document.getElementById('progress-log');
const outputSection = document.getElementById('output-section');
const outputVideo = document.getElementById('output-video');
const downloadBtn = document.getElementById('download-btn');

// Initialize FFmpeg
async function initFFmpeg() {
    ffmpeg = new FFmpeg();

    ffmpeg.on('log', ({ message }) => {
        console.log('FFmpeg:', message);
        progressLog.textContent = message;
    });

    ffmpeg.on('progress', ({ progress, time }) => {
        const percent = Math.round(progress * 100);
        progressFill.style.width = `${percent}%`;
        progressText.textContent = `${percent}%`;
    });

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    loadingScreen.classList.add('hidden');
    appContent.classList.remove('hidden');
}

async function toBlobURL(url, mimeType) {
    const buf = await (await fetch(url)).arrayBuffer();
    const blob = new Blob([buf], { type: mimeType });
    return URL.createObjectURL(blob);
}

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
        hideOutput();
    });
});

// Show/hide progress and output
function showProgress() {
    progressSection.classList.remove('hidden');
    outputSection.classList.add('hidden');
    progressFill.style.width = '0%';
    progressText.textContent = '0%';
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

function hideOutput() {
    outputSection.classList.add('hidden');
}

// ====== TEXT TO VIDEO ======
async function generateTextVideo() {
    const text = document.getElementById('text-content').value.trim();
    if (!text) {
        alert('Please enter some text');
        return;
    }

    showProgress();
    hideOutput();

    try {
        const bgColor = document.getElementById('bg-color').value;
        const textColor = document.getElementById('text-color').value;
        const duration = parseInt(document.getElementById('video-duration').value);
        const fontSize = parseInt(document.getElementById('font-size').value);
        const [width, height] = document.getElementById('resolution').value.split('x').map(Number);
        const fps = 30;
        const totalFrames = duration * fps;

        // Create frames using canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Write frames to disk
        for (let i = 0; i < totalFrames; i++) {
            // Draw background
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, width, height);

            // Draw text with wrapping
            ctx.fillStyle = textColor;
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const lines = wrapText(ctx, text, width - 80);
            const lineHeight = fontSize * 1.4;
            const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;

            lines.forEach((line, idx) => {
                ctx.fillText(line, width / 2, startY + idx * lineHeight);
            });

            // Convert to blob and write to FFmpeg FS
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
            const frameData = await fetchFile(blob);
            await ffmpeg.writeFile(`frame_${String(i).padStart(6, '0')}.jpg`, frameData);

            if (i % 30 === 0) {
                progressFill.style.width = `${Math.round((i / totalFrames) * 50)}%`;
                progressText.textContent = `Generating frames: ${Math.round((i / totalFrames) * 50)}%`;
            }
        }

        progressText.textContent = 'Encoding video...';

        // Encode frames to video
        await ffmpeg.exec([
            '-framerate', String(fps),
            '-i', 'frame_%06d.jpg',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-preset', 'ultrafast',
            'output.mp4'
        ]);

        // Read output file
        const data = await ffmpeg.readFile('output.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);

        showOutput(url, 'text-video.mp4');

        // Cleanup
        for (let i = 0; i < totalFrames; i++) {
            await ffmpeg.deleteFile(`frame_${String(i).padStart(6, '0')}.jpg`).catch(() => {});
        }
        await ffmpeg.deleteFile('output.mp4').catch(() => {});

    } catch (error) {
        console.error('Error:', error);
        alert('Error generating video: ' + error.message);
    }

    hideProgress();
}

function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    });

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines;
}

// ====== IMAGE SLIDESHOW ======
document.getElementById('image-upload').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    const preview = document.getElementById('image-preview');

    files.forEach((file, index) => {
        const id = Date.now() + index;
        uploadedImages.push({ id, file });

        const reader = new FileReader();
        reader.onload = (ev) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.id = `img-${id}`;
            div.innerHTML = `
                <img src="${ev.target.result}" alt="Preview">
                <button class="remove" onclick="removeImage(${id})">×</button>
            `;
            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });

    e.target.value = '';
});

function removeImage(id) {
    uploadedImages = uploadedImages.filter(img => img.id !== id);
    document.getElementById(`img-${id}`).remove();
}

async function generateSlideshow() {
    if (uploadedImages.length === 0) {
        alert('Please upload at least one image');
        return;
    }

    showProgress();
    hideOutput();

    try {
        const slideDuration = parseInt(document.getElementById('slide-duration').value);
        const transition = document.getElementById('transition-type').value;
        const [width, height] = document.getElementById('slideshow-resolution').value.split('x').map(Number);
        const fps = 30;
        const framesPerSlide = slideDuration * fps;

        // Process each image
        for (let i = 0; i < uploadedImages.length; i++) {
            const img = await loadImage(uploadedImages[i].file);

            // Create canvas for this slide
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            for (let f = 0; f < framesPerSlide; f++) {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, width, height);

                // Draw image scaled to fit
                const scale = Math.min(width / img.width, height / img.height);
                const drawWidth = img.width * scale;
                const drawHeight = img.height * scale;
                const x = (width - drawWidth) / 2;
                const y = (height - drawHeight) / 2;

                // Apply fade transition if enabled
                if (transition === 'fade' && f < 10) {
                    ctx.globalAlpha = f / 10;
                } else if (transition === 'fade' && f > framesPerSlide - 10 && uploadedImages.length > 1) {
                    ctx.globalAlpha = (framesPerSlide - f) / 10;
                } else {
                    ctx.globalAlpha = 1;
                }

                ctx.drawImage(img, x, y, drawWidth, drawHeight);
                ctx.globalAlpha = 1;

                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
                const frameNum = i * framesPerSlide + f;
                await ffmpeg.writeFile(`slide_${String(frameNum).padStart(6, '0')}.jpg`, await fetchFile(blob));

                const totalFrames = uploadedImages.length * framesPerSlide;
                if (frameNum % 30 === 0) {
                    progressFill.style.width = `${Math.round((frameNum / totalFrames) * 50)}%`;
                    progressText.textContent = `Generating frames: ${Math.round((frameNum / totalFrames) * 50)}%`;
                }
            }
        }

        progressText.textContent = 'Encoding slideshow...';

        const totalFrames = uploadedImages.length * framesPerSlide;

        await ffmpeg.exec([
            '-framerate', String(fps),
            '-i', 'slide_%06d.jpg',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-preset', 'ultrafast',
            'slideshow.mp4'
        ]);

        const data = await ffmpeg.readFile('slideshow.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);

        showOutput(url, 'slideshow.mp4');

        // Cleanup
        for (let i = 0; i < totalFrames; i++) {
            await ffmpeg.deleteFile(`slide_${String(i).padStart(6, '0')}.jpg`).catch(() => {});
        }
        await ffmpeg.deleteFile('slideshow.mp4').catch(() => {});

    } catch (error) {
        console.error('Error:', error);
        alert('Error creating slideshow: ' + error.message);
    }

    hideProgress();
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

// ====== MERGE VIDEOS ======
document.getElementById('video-upload').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    const preview = document.getElementById('video-preview');

    files.forEach((file, index) => {
        const id = Date.now() + index;
        uploadedVideos.push({ id, file });

        const url = URL.createObjectURL(file);
        const div = document.createElement('div');
        div.className = 'preview-item';
        div.id = `vid-${id}`;
        div.innerHTML = `
            <video src="${url}"></video>
            <button class="remove" onclick="removeVideo(${id})">×</button>
        `;
        preview.appendChild(div);
    });

    e.target.value = '';
});

function removeVideo(id) {
    uploadedVideos = uploadedVideos.filter(vid => vid.id !== id);
    document.getElementById(`vid-${id}`).remove();
}

async function mergeVideos() {
    if (uploadedVideos.length < 2) {
        alert('Please upload at least 2 videos to merge');
        return;
    }

    showProgress();
    hideOutput();

    try {
        // Write all videos to FFmpeg FS
        for (let i = 0; i < uploadedVideos.length; i++) {
            const data = await fetchFile(uploadedVideos[i].file);
            await ffmpeg.writeFile(`input${i}.mp4`, data);
            progressFill.style.width = `${Math.round(((i + 1) / uploadedVideos.length) * 30)}%`;
        }

        progressText.textContent = 'Creating concat list...';

        // Create concat file
        const fileList = uploadedVideos.map((_, i) => `file 'input${i}.mp4'`).join('\n');
        await ffmpeg.writeFile('filelist.txt', new TextEncoder().encode(fileList));

        progressText.textContent = 'Merging videos...';

        // Use concat demuxer
        await ffmpeg.exec([
            '-f', 'concat',
            '-safe', '0',
            '-i', 'filelist.txt',
            '-c', 'copy',
            'merged.mp4'
        ]);

        const data = await ffmpeg.readFile('merged.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);

        showOutput(url, 'merged-video.mp4');

        // Cleanup
        for (let i = 0; i < uploadedVideos.length; i++) {
            await ffmpeg.deleteFile(`input${i}.mp4`).catch(() => {});
        }
        await ffmpeg.deleteFile('filelist.txt').catch(() => {});
        await ffmpeg.deleteFile('merged.mp4').catch(() => {});

    } catch (error) {
        console.error('Error:', error);
        alert('Error merging videos. Try converting videos to same format first.');
    }

    hideProgress();
}

// ====== ADD AUDIO ======
async function addAudio() {
    const videoFile = document.getElementById('audio-video-upload').files[0];
    const audioFile = document.getElementById('audio-upload').files[0];

    if (!videoFile) {
        alert('Please upload a video');
        return;
    }
    if (!audioFile) {
        alert('Please upload an audio file');
        return;
    }

    showProgress();
    hideOutput();

    try {
        progressText.textContent = 'Loading files...';

        await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));
        await ffmpeg.writeFile('input.mp3', await fetchFile(audioFile));

        progressFill.style.width = '30%';
        progressText.textContent = 'Adding audio...';

        const replaceAudio = document.getElementById('replace-audio').checked;

        if (replaceAudio) {
            await ffmpeg.exec([
                '-i', 'input.mp4',
                '-i', 'input.mp3',
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-map', '0:v:0',
                '-map', '1:a:0',
                '-shortest',
                'output.mp4'
            ]);
        } else {
            await ffmpeg.exec([
                '-i', 'input.mp4',
                '-i', 'input.mp3',
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=shortest[a]',
                '-map', '0:v',
                '-map', '[a]',
                'output.mp4'
            ]);
        }

        const data = await ffmpeg.readFile('output.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);

        showOutput(url, 'video-with-audio.mp4');

        await ffmpeg.deleteFile('input.mp4').catch(() => {});
        await ffmpeg.deleteFile('input.mp3').catch(() => {});
        await ffmpeg.deleteFile('output.mp4').catch(() => {});

    } catch (error) {
        console.error('Error:', error);
        alert('Error adding audio: ' + error.message);
    }

    hideProgress();
}

// ====== CONVERT FORMAT ======
async function convertVideo() {
    const file = document.getElementById('convert-upload').files[0];
    if (!file) {
        alert('Please upload a video');
        return;
    }

    showProgress();
    hideOutput();

    try {
        const format = document.getElementById('output-format').value;
        const resolution = document.getElementById('convert-resolution').value;

        progressText.textContent = 'Loading video...';
        await ffmpeg.writeFile('input', await fetchFile(file));

        progressFill.style.width = '30%';
        progressText.textContent = `Converting to ${format.toUpperCase()}...`;

        const args = ['-i', 'input'];

        if (resolution !== 'original') {
            const [w, h] = resolution.split('x');
            args.push('-vf', `scale=${w}:${h}`);
        }

        if (format === 'gif') {
            args.push('-vf', resolution !== 'original' ? `scale=${resolution.split('x')[0]}:-1:flags=lanczos,fps=10` : 'fps=10,scale=640:-1:flags=lanczos');
            args.push('-loop', '0');
        } else if (format === 'webm') {
            args.push('-c:v', 'libvpx-vp9');
            args.push('-c:a', 'libvorbis');
        } else if (format === 'mp4') {
            args.push('-c:v', 'libx264');
            args.push('-c:a', 'aac');
        }

        args.push('-preset', 'ultrafast');
        args.push(`output.${format}`);

        await ffmpeg.exec(args);

        const data = await ffmpeg.readFile(`output.${format}`);
        const mimeType = format === 'gif' ? 'image/gif' :
                        format === 'webm' ? 'video/webm' :
                        format === 'avi' ? 'video/avi' :
                        format === 'mov' ? 'video/quicktime' : 'video/mp4';

        const blob = new Blob([data.buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);

        showOutput(url, `converted.${format}`);

        await ffmpeg.deleteFile('input').catch(() => {});
        await ffmpeg.deleteFile(`output.${format}`).catch(() => {});

    } catch (error) {
        console.error('Error:', error);
        alert('Error converting video: ' + error.message);
    }

    hideProgress();
}

// Event Listeners
document.getElementById('generate-text-video').addEventListener('click', generateTextVideo);
document.getElementById('generate-slideshow').addEventListener('click', generateSlideshow);
document.getElementById('merge-videos').addEventListener('click', mergeVideos);
document.getElementById('add-audio-btn').addEventListener('click', addAudio);
document.getElementById('convert-video').addEventListener('click', convertVideo);

// Initialize on load
initFFmpeg().catch(err => {
    console.error('Failed to initialize FFmpeg:', err);
    loadingScreen.innerHTML = `
        <p style="color: #e74c3c;">Failed to load FFmpeg. Please refresh the page.</p>
        <p style="font-size: 0.9rem; margin-top: 10px;">${err.message}</p>
    `;
});
