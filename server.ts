import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '25mb' }));

function isValidGeminiKey(key: string | undefined): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  if (trimmed === 'MY_GEMINI_API_KEY' || trimmed.startsWith('MY_')) return false;
  return (trimmed.startsWith('AIzaSy') || trimmed.startsWith('AQ.')) && trimmed.length >= 30;
}

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  const hasValidKey = isValidGeminiKey(process.env.GEMINI_API_KEY);
  res.json({ status: 'ok', hasGeminiKey: hasValidKey });
});

// AI Order Text Parsing endpoint
app.post('/api/parse-order', async (req: Request, res: Response) => {
  const { text, jobContext } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text prompt is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!isValidGeminiKey(apiKey)) {
    return res.json({
      success: false,
      message: 'GEMINI_API_KEY not configured or invalid format, using built-in deterministic parser.',
      items: null,
    });
  }

  try {
    const ai = new GoogleGenAI();
    const systemPrompt = `You are an expert electrical contractor order parsing assistant for Blazer Electric Supply Company.
Given an electrical contractor's order notes or material request list, extract each distinct electrical item into a structured list.
Extract:
- query: A clean, descriptive search term for the electrical catalog (e.g., "10/2 MC cable", "Caddy CJ6 cable support", "1 in EMT compression connector", "1/2 inch EMT set screw connector"). Include relevant trade names, gauges, voltages, or dimensions.
- qty: The numerical quantity (e.g., 50, 12, 5). Default to 1 if not specified.
- unit: The unit of measure if mentioned (e.g., "ft", "pcs", "boxes", "rolls", "spools", "ea").
- originalText: The exact snippet from the input text.

Job context if provided: "${jobContext || 'General electrical construction'}".

Return ONLY a valid JSON object matching this schema:
{
  "items": [
    {
      "query": "string",
      "qty": number,
      "unit": "string",
      "originalText": "string"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            { text: `Contractor Order Text:\n${text}` },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    const parsedData = JSON.parse(responseText);

    return res.json({
      success: true,
      items: parsedData.items || [],
      usedAi: true,
    });
  } catch (error: any) {
    console.warn('Gemini request fallback (using local catalog matcher):', error?.message || 'Unknown error');
    return res.json({
      success: false,
      error: 'Using local catalog matcher',
      items: null,
    });
  }
});

// Multimodal Photo / Drywall Scribble OCR Parsing endpoint
app.post('/api/parse-photo', async (req: Request, res: Response) => {
  const { imageBase64, mimeType, jobContext } = req.body;
  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: 'Image data and mimeType are required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!isValidGeminiKey(apiKey)) {
    return res.json({
      success: false,
      error: 'Photo AI recognition requires an active Google AI Studio Gemini API key (AIzaSy...). Please enter your materials using the Text / Voice or Table tabs.',
      items: null,
    });
  }

  try {
    const ai = new GoogleGenAI();
    const systemPrompt = `You are an expert electrical contractor OCR assistant for Blazer Electric Supply Company.
Examine this photo carefully. It may be:
- A handwritten material note on a scrap of drywall, 2x4 lumber, or cardboard
- A handwritten yellow legal pad or notebook list
- A printed blueprint note, material requisition sheet, or invoice snippet

Extract each distinct electrical item that the contractor needs.
Transcribe trade slang (e.g. "12/2 romex", "1/2 emt straps", "1900 box with 1/2 mud ring", "caddy clips", "3-way switches", "ground rods", "wire nuts").
Job context if provided: "${jobContext || 'General electrical job'}".

For each item, output:
- query: clean search term for Blazer Electric's catalog
- qty: number
- unit: unit of measure if written (e.g., "ft", "boxes", "rolls", "pcs", "ea")
- originalText: exact handwritten or printed text detected on the image

Also provide a brief summary of the detected note in 'transcribedNotes'.

Return ONLY valid JSON matching this schema:
{
  "transcribedNotes": "string",
  "items": [
    {
      "query": "string",
      "qty": number,
      "unit": "string",
      "originalText": "string"
    }
  ]
}`;

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            {
              inlineData: {
                data: cleanBase64,
                mimeType: mimeType || 'image/jpeg',
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    const parsedData = JSON.parse(responseText);

    return res.json({
      success: true,
      items: parsedData.items || [],
      transcribedNotes: parsedData.transcribedNotes || '',
      usedAi: true,
    });
  } catch (error: any) {
    console.warn('Photo OCR error:', error?.message || error);
    return res.json({
      success: false,
      error: error?.message || 'Error processing image',
      items: null,
    });
  }
});

// Setup Vite or static serving
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Blazer Quick Order running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
