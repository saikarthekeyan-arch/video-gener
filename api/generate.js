export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { token, model, prompt, negativePrompt, width, height } = req.body;

    if (!token) {
        return res.status(400).json({ error: 'Token required' });
    }

    const apiUrl = `https://api-inference.huggingface.co/models/${model || 'stabilityai/stable-diffusion-2-1'}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'x-wait-for-model': 'true'
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    negative_prompt: negativePrompt || 'blurry, low quality',
                    width: width || 512,
                    height: height || 512,
                    num_inference_steps: 20,
                    guidance_scale: 7.5
                }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            return res.status(response.status).json({ error });
        }

        const buffer = await response.arrayBuffer();
        res.setHeader('Content-Type', 'image/png');
        res.send(Buffer.from(buffer));
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
