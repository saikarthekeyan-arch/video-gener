# Free Video Generator

A 100% free, browser-based video generator that runs entirely client-side. No signup, no paid tiers, no data leaves your browser.

## Features

- **Text to Video** - Create videos with customizable text overlays
- **Image Slideshow** - Convert images into a video with transitions
- **Merge Videos** - Combine multiple videos into one
- **Add Audio** - Add or replace audio in videos
- **Convert Format** - Convert between MP4, WebM, AVI, MOV, and GIF

## Tech Stack

- FFmpeg.wasm (WebAssembly)
- Canvas API
- Pure HTML/CSS/JavaScript

## Deploy to GitHub Pages (Free)

### Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository named `video-generator`
3. Make it **Public** (required for free GitHub Pages)
4. Click "Create repository"

### Step 2: Upload Files

1. Click "uploading an existing file"
2. Upload these 3 files:
   - `index.html`
   - `styles.css`
   - `app.js`
3. Commit the files

### Step 3: Enable GitHub Pages

1. Go to **Settings** > **Pages**
2. Under "Source", select **Deploy from a branch**
3. Select branch: `main` and folder: `/ (root)`
4. Click **Save**
5. Wait 2-5 minutes for deployment

### Step 4: Configure Headers (Required for FFmpeg.wasm)

FFmpeg.wasm requires special headers. Since GitHub Pages doesn't support custom headers directly, use one of these free alternatives:

**Option A: Use Cloudflare Pages (Recommended, Free)**

1. Go to https://pages.cloudflare.com/
2. Connect your GitHub repository
3. Create a `_headers` file in your repo with:
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```
4. Deploy - your site will be live at `your-project.pages.dev`

**Option B: Use Netlify (Free)**

1. Go to https://www.netlify.com/
2. Connect your GitHub repository
3. Create a `netlify.toml` file:
```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "require-corp"
```
4. Deploy - your site will be live at `your-project.netlify.app`

**Option C: Use Vercel (Free)**

1. Go to https://vercel.com/
2. Import your GitHub repository
3. Create a `vercel.json` file:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

## Local Development

Simply open `index.html` in a browser using a local server:

```bash
# Using Python
python -m http.server 8080

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8000
```

Then visit `http://localhost:8080`

## Important Notes

- All processing happens **in your browser** - no uploads to any server
- Large videos may take longer depending on your device
- Supported browsers: Chrome, Edge, Firefox (latest versions)
- Requires modern browser with WebAssembly support

## License

MIT License - Free to use, modify, and distribute
