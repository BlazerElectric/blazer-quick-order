import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { OrderForm } from './components/OrderForm';
import { MatchedResults } from './components/MatchedResults';
import { Footer } from './components/Footer';
import { ProductItem, MatchedResultItem, OrderInputRow } from './types';
import {
  fetchCsvCatalog,
  parseInputLine,
  matchQueryAgainstCatalog,
} from './utils/matching';

export const App: React.FC = () => {
  const [catalog, setCatalog] = useState<ProductItem[]>([]);
  const [rankMap, setRankMap] = useState<Record<string, number>>({});
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);

  // Form State
  const [jobContext, setJobContext] = useState('');
  const [orderText, setOrderText] = useState('');
  const [mode, setMode] = useState<'text' | 'table' | 'file'>('text');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [tableRows, setTableRows] = useState<OrderInputRow[]>([
    { id: 'row-1', description: '3/4 EMT connector', qty: 10 },
  ]);

  // Results State
  const [matchedItems, setMatchedItems] = useState<MatchedResultItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load Catalog & Check Health on Mount
  useEffect(() => {
    async function initCatalog() {
      try {
        setIsLoadingCatalog(true);
        const { catalog: loadedCatalog, rankMap: loadedRanks } = await fetchCsvCatalog();
        setCatalog(loadedCatalog);
        setRankMap(loadedRanks);
        setCatalogError(null);
      } catch (err: any) {
        console.error('Failed to load catalog data:', err);
        setCatalogError(err?.message || 'Error loading catalog');
      } finally {
        setIsLoadingCatalog(false);
      }
    }

    async function checkHealth() {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          setHasGeminiKey(Boolean(data.hasGeminiKey));
        }
      } catch (e) {
        // Dev server or local without backend
      }
    }

    initCatalog();
    checkHealth();
  }, []);

  const handleLoadDemo = () => {
    setMode('text');
    setOrderText('50ft 10/2 MC cable, 12 Caddy CJ6, 5 1in EMT connectors');
    setJobContext('Commercial Office Trim');
  };

  const handleReset = () => {
    setOrderText('');
    setJobContext('');
    setUploadedFileName(null);
    setTableRows([
      { id: 'row-1', description: '', qty: 1 },
    ]);
    setMatchedItems([]);
  };

  const handleProcessOrder = async () => {
    if (catalog.length === 0) {
      alert('Catalog is still loading. Please wait a moment and try again.');
      return;
    }

    let parsedInputs: { query: string; qty: number; unit?: string }[] = [];

    if (mode === 'table') {
      parsedInputs = tableRows
        .filter((r) => r.description.trim().length > 0)
        .map((r) => ({
          query: r.description.trim(),
          qty: r.qty > 0 ? r.qty : 1,
        }));
    } else {
      const rawText = orderText.trim();
      if (!rawText) {
        alert('Please enter items to order.');
        return;
      }

      setIsProcessing(true);

      // Attempt AI smart parsing if Gemini is available
      if (hasGeminiKey) {
        try {
          const res = await fetch('/api/parse-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: rawText, jobContext }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.items) && data.items.length > 0) {
              parsedInputs = data.items.map((it: any) => ({
                query: it.query || it.originalText,
                qty: parseInt(it.qty, 10) || 1,
                unit: it.unit || '',
              }));
            }
          }
        } catch (e) {
          console.warn('AI Parsing failed, falling back to local heuristic matcher', e);
        }
      }

      // If AI didn't return items, use deterministic line parser
      if (parsedInputs.length === 0) {
        const lines = rawText.split(/\r?\n|,/);
        lines.forEach((raw) => {
          if (!raw.trim()) return;
          const parsed = parseInputLine(raw);
          if (parsed.query) {
            parsedInputs.push(parsed);
          }
        });
      }
    }

    if (parsedInputs.length === 0) {
      setIsProcessing(false);
      alert('Please enter items to order.');
      return;
    }

    setIsProcessing(true);

    try {
      // Run the catalog matching across 8,479 SKUs
      const results: MatchedResultItem[] = parsedInputs.map((input) =>
        matchQueryAgainstCatalog(input.query, input.qty, input.unit, catalog, rankMap)
      );

      setMatchedItems(results);
    } catch (err) {
      console.error('Error during matching:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateQty = (id: string, newQty: number) => {
    setMatchedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty: newQty } : item))
    );
  };

  const handleSwapProduct = (id: string, newProduct: ProductItem) => {
    setMatchedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        // Keep existing alternatives, excluding the newly active one and including the old one
        const updatedAlts = [
          item.product,
          ...item.alternatives.filter((a) => a.PROD_ID !== newProduct.PROD_ID),
        ].slice(0, 4);

        return {
          ...item,
          product: newProduct,
          alternatives: updatedAlts,
        };
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setMatchedItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="bg-[#f4f6f8] min-h-screen text-gray-800 flex flex-col justify-between">
      <div>
        <Header
          catalogCount={catalog.length}
          isLoadingCatalog={isLoadingCatalog}
          catalogError={catalogError}
          onLoadDemo={handleLoadDemo}
          hasGeminiKey={hasGeminiKey}
        />

        <main className="max-w-6xl mx-auto px-4 w-full grid grid-cols-1 md:grid-cols-12 gap-6 pb-12">
          {/* Left Panel: Input Form */}
          <div className="md:col-span-5">
            <OrderForm
              jobContext={jobContext}
              setJobContext={setJobContext}
              orderText={orderText}
              setOrderText={setOrderText}
              tableRows={tableRows}
              setTableRows={setTableRows}
              mode={mode}
              setMode={setMode}
              onReset={handleReset}
              onProcessOrder={handleProcessOrder}
              isProcessing={isProcessing}
              uploadedFileName={uploadedFileName}
              setUploadedFileName={setUploadedFileName}
            />
          </div>

          {/* Right Panel: Matched Results */}
          <div className="md:col-span-7">
            <MatchedResults
              items={matchedItems}
              onUpdateQty={handleUpdateQty}
              onSwapProduct={handleSwapProduct}
              onRemoveItem={handleRemoveItem}
              catalog={catalog}
            />
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
};
export default App;
