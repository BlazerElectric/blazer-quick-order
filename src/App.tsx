import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { OrderForm } from './components/OrderForm';
import { MatchedResults } from './components/MatchedResults';
import { CatalogSearchModal } from './components/CatalogSearchModal';
import { Footer } from './components/Footer';
import { ProductItem, MatchedResultItem, OrderInputRow } from './types';
import {
  fetchCsvCatalog,
  parseInputLine,
  matchQueryAgainstCatalog,
  InvertedIndex,
} from './utils/matching';

export const App: React.FC = () => {
  const [catalog, setCatalog] = useState<ProductItem[]>([]);
  const [rankMap, setRankMap] = useState<Record<string, number>>({});
  const [catalogIndex, setCatalogIndex] = useState<InvertedIndex | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);

  // Form State
  const [jobContext, setJobContext] = useState('');
  const [orderText, setOrderText] = useState('');
  const [mode, setMode] = useState<'text' | 'table' | 'file' | 'photo'>('text');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [tableRows, setTableRows] = useState<OrderInputRow[]>([
    { id: 'row-1', description: '3/4 EMT connector', qty: 10 },
  ]);

  // Multimodal Photo State
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [detectedPhotoNotes, setDetectedPhotoNotes] = useState<string | null>(null);

  // Results State
  const [matchedItems, setMatchedItems] = useState<MatchedResultItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Catalog Drawer Modal State
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Load Catalog & Check Health on Mount
  useEffect(() => {
    async function initCatalog() {
      try {
        setIsLoadingCatalog(true);
        const { catalog: loadedCatalog, rankMap: loadedRanks, index } = await fetchCsvCatalog();
        setCatalog(loadedCatalog);
        setRankMap(loadedRanks);
        setCatalogIndex(index);
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
        // Dev server or fallback
      }
    }

    initCatalog();
    checkHealth();
  }, []);

  const categories = useMemo(() => {
    return catalogIndex?.categorySet || [];
  }, [catalogIndex]);

  const handleLoadDemo = () => {
    setMode('text');
    setOrderText('50ft 10/2 MC cable, 12 Caddy CJ6, 5 1in EMT connectors');
    setJobContext('Commercial Office Trim');
  };

  const handleReset = () => {
    setOrderText('');
    setJobContext('');
    setUploadedFileName(null);
    setPhotoDataUrl(null);
    setDetectedPhotoNotes(null);
    setTableRows([{ id: 'row-1', description: '', qty: 1 }]);
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

      // Attempt AI smart parsing if Gemini is active
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
          console.warn('AI Parsing error, falling back to local heuristic matcher', e);
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
      // Rapid matching via inverted index
      const results: MatchedResultItem[] = parsedInputs.map((input) =>
        matchQueryAgainstCatalog(input.query, input.qty, input.unit, catalog, rankMap, catalogIndex)
      );

      setMatchedItems(results);
    } catch (err) {
      console.error('Error during matching:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessPhoto = async (base64: string, mimeType: string) => {
    if (catalog.length === 0) {
      alert('Catalog is still loading. Please wait a moment.');
      return;
    }

    setIsProcessing(true);

    try {
      const res = await fetch('/api/parse-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType, jobContext }),
      });

      const data = await res.json();

      if (data.success && Array.isArray(data.items) && data.items.length > 0) {
        setDetectedPhotoNotes(data.transcribedNotes || 'Extracted items from jobsite photo');

        const parsedInputs = data.items.map((it: any) => ({
          query: it.query || it.originalText,
          qty: parseInt(it.qty, 10) || 1,
          unit: it.unit || '',
        }));

        const results: MatchedResultItem[] = parsedInputs.map((input: any) =>
          matchQueryAgainstCatalog(
            input.query,
            input.qty,
            input.unit,
            catalog,
            rankMap,
            catalogIndex
          )
        );

        setMatchedItems(results);
      } else {
        alert(
          data.error ||
            'Could not extract text from image. Make sure the handwriting is clear and well-lit.'
        );
      }
    } catch (err) {
      console.error('Error processing photo:', err);
      alert('Failed to connect to the photo recognition server.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddProductFromCatalog = (product: ProductItem, qty: number) => {
    // Generate 4 alternatives from the same category or brand
    const sameCat = catalog
      .filter((p) => p.PROD_ID !== product.PROD_ID && p.primary_category === product.primary_category)
      .slice(0, 4);

    const newItem: MatchedResultItem = {
      id: `${product.PROD_ID}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      originalQuery: `Manual add: ${product.clean_title || product.PRODUCT}`,
      requestedQty: qty,
      qty,
      product,
      alternatives: sameCat,
      score: 100,
      confidenceLevel: 'high',
      confidenceLabel: 'Exact / High Match',
      matchReasons: ['Directly selected from catalog search', 'Exact SKU match'],
    };

    setMatchedItems((prev) => [newItem, ...prev]);
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
        const updatedAlts = [
          item.product,
          ...item.alternatives.filter((a) => a.PROD_ID !== newProduct.PROD_ID),
        ].slice(0, 4);

        return {
          ...item,
          product: newProduct,
          alternatives: updatedAlts,
          confidenceLevel: 'high',
          confidenceLabel: 'Manually Swapped',
          matchReasons: ['Contractor swapped with close alternative'],
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
              photoDataUrl={photoDataUrl}
              setPhotoDataUrl={setPhotoDataUrl}
              onProcessPhoto={handleProcessPhoto}
              detectedPhotoNotes={detectedPhotoNotes}
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
              onOpenCatalogSearch={() => setIsSearchModalOpen(true)}
            />
          </div>
        </main>
      </div>

      <Footer />

      {/* Live Catalog Search & Manual "Add Item" Modal */}
      <CatalogSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        catalog={catalog}
        categories={categories}
        onAddProduct={handleAddProductFromCatalog}
      />
    </div>
  );
};
export default App;
