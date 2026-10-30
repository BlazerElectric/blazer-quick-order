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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

function cleanJsonText(raw: string): any {
  if (!raw) return {};
  const trimmed = raw.trim();
  // Strip ```json and ``` if present
  const unquoted = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(unquoted);
  } catch (err) {
    // If it still fails, search for the outer JSON object {...}
    const match = unquoted.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw err;
  }
}

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

    const parsedData = cleanJsonText(response.text || '{}');

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
  if (!imageBase64) {
    return res.status(400).json({ success: false, error: 'Image data is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!isValidGeminiKey(apiKey)) {
    return res.json({
      success: false,
      error: 'Photo AI recognition requires an active Google AI Studio Gemini API key. Please use the Text or Table input tabs.',
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
- A photo of electrical supplies or jobsite materials

Carefully read all handwriting or printed text. Extract every distinct electrical material or supply item the contractor needs.
Understand trade slang and abbreviations:
- MC / metal clad / armored cable (e.g. "12/2 mc", "10/3 mc", "8/3")
- Romex / NM-B (e.g. "14/2 romex", "12/2 nm-b")
- EMT conduit, connectors, couplings, straps (e.g. "1/2 emt", "3/4 compression conn", "1in set screw")
- Caddy / fasteners (e.g. "cj6", "caddy clip", "k16", "batwings")
- Boxes & covers (e.g. "1900 box", "4-square", "mud ring", "handy box")
- Wire nuts / connectors (e.g. "yellows", "reds", "tans", "twister")
- Breakers, panels, ground rods, strut, etc.

Job context if provided: "${jobContext || 'General electrical job'}".

For each item, output:
- query: A clean, descriptive search term for Blazer Electric's catalog (e.g. "10/2 MC cable", "Caddy CJ6", "3/4 inch EMT compression connector")
- qty: The numerical quantity (e.g. 50, 12, 10, 100). Default to 1 if not specified.
- unit: Unit of measure if mentioned (e.g. "ft", "boxes", "rolls", "pcs", "ea", "spools")
- originalText: The exact text snippet detected on the image

Also provide a concise transcript or summary of the entire note in 'transcribedNotes'.

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

    // Clean and validate base64 string
    const cleanBase64 = String(imageBase64)
      .replace(/^data:[^;]+;base64,/, '')
      .replace(/[\r\n\s]+/g, '');

    // Strictly normalize to Gemini-supported MIME types
    let validMimeType = 'image/jpeg';
    if (mimeType) {
      const lower = mimeType.toLowerCase();
      if (lower.includes('png')) validMimeType = 'image/png';
      else if (lower.includes('webp')) validMimeType = 'image/webp';
      else if (lower.includes('heic')) validMimeType = 'image/heic';
      else if (lower.includes('heif')) validMimeType = 'image/heif';
      else validMimeType = 'image/jpeg';
    }

    const generatePromise = ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            {
              inlineData: {
                data: cleanBase64,
                mimeType: validMimeType,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    // 25 second timeout safeguard
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI vision processing timed out after 25s')), 25000)
    );

    const response = (await Promise.race([generatePromise, timeoutPromise])) as any;
    const parsedData = cleanJsonText(response.text || '{}');

    return res.json({
      success: true,
      items: Array.isArray(parsedData.items) ? parsedData.items : [],
      transcribedNotes: parsedData.transcribedNotes || '',
      usedAi: true,
    });
  } catch (error: any) {
    console.warn('Photo OCR error:', error?.message || error);
    let errorMessage = 'Could not process the photo. Please make sure the handwriting is visible.';
    const msg = error?.message || '';
    if (msg.includes('timed out')) {
      errorMessage = 'Image recognition timed out. Please try a clearer photo or use the Text / Table input.';
    } else if (msg.includes('API key') || msg.includes('API_KEY')) {
      errorMessage = 'Invalid or unconfigured Gemini API key. Please use the Text or Table input.';
    } else if (msg.includes('quota') || msg.includes('429')) {
      errorMessage = 'Recognition service is busy. Please try again in a few moments.';
    } else if (msg.includes('Unable to process input image')) {
      errorMessage = 'The uploaded image format could not be processed. Please upload a clear JPG or PNG photo.';
    }

    return res.json({
      success: false,
      error: errorMessage,
      items: null,
    });
  }
});

// Express global error handler to prevent HTML error responses
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.warn('Express request error:', err?.message || err);
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Image file is too large. Please select a photo under 25MB.',
    });
  }
  return res.status(500).json({
    success: false,
    error: 'An internal server error occurred processing the request.',
  });
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
