# Blazer AI Quick Order Assistant

A React application for electrical contractors and estimators to rapidly convert natural language material lists, spreadsheets, or trade jargon into exact Blazer Electric Supply product catalog matches (over 8,400 SKUs) and export them directly to BuyBlazer carts.

## Features

- **Fast Natural Language Contractor Order Entry**:
  - **Text / Voice**: Paste multi-item contractor lists or dictate via microphone with real-time speech recognition.
  - **Quick Table**: Add rows with specific descriptions and quantities.
  - **File Upload**: Drag-and-drop or upload `.txt` or `.csv` files.
- **Intelligent Catalog Matching**:
  - Indexed across 8,400+ electrical catalog SKUs, ERP part numbers, clean titles, search keywords, manufacturer part numbers (MPN), and web order velocity ranks.
  - Nickname and trade slang expansion (e.g., MC cable, Caddy CJ6, EMT fittings, Romex, strut).
  - Server-side Gemini AI parsing support via `@google/genai` with deterministic fallback.
- **Interactive Review & Swapping**:
  - Matched item cards with PROD ID badges, MPN, and ERP names.
  - 4 close alternatives selector per item to quickly swap matched SKUs.
  - In-line quantity adjustment (+/- buttons or manual input) and item removal.
- **BuyBlazer Integration**:
  - Copy raw list in `PROD_ID,QTY` format to clipboard.
  - One-click "Add All to BuyBlazer Cart" transmitting order payloads via secure `postMessage` protocol to `https://www.buyblazer.com`.

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide React, PapaParse
- **Backend / Dev**: Express, Node.js, tsx, Vite, `@google/genai`
- **Branding**: Official Blazer Electric Supply styling and logo