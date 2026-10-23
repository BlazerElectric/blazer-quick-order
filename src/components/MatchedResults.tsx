import React, { useState } from 'react';
import { Copy, ShoppingCart, Trash2, ArrowRightLeft, Check, Sparkles, AlertCircle } from 'lucide-react';
import { MatchedResultItem, ProductItem } from '../types';

interface MatchedResultsProps {
  items: MatchedResultItem[];
  onUpdateQty: (id: string, newQty: number) => void;
  onSwapProduct: (id: string, newProduct: ProductItem) => void;
  onRemoveItem: (id: string) => void;
  catalog: ProductItem[];
}

export const MatchedResults: React.FC<MatchedResultsProps> = ({
  items,
  onUpdateQty,
  onSwapProduct,
  onRemoveItem,
  catalog,
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const getPayloadString = () => {
    return items
      .filter((i) => i.product && i.product.PROD_ID && i.qty > 0)
      .map((i) => `${i.product.PROD_ID},${i.qty}`)
      .join('\n');
  };

  const handleCopyRawList = () => {
    if (items.length === 0) {
      showToast('No items in list to copy.');
      return;
    }
    const payload = getPayloadString();
    navigator.clipboard
      .writeText(payload)
      .then(() => {
        showToast(`Copied ${items.length} items to clipboard in PROD_ID,QTY format!`);
      })
      .catch((err) => {
        console.error('Clipboard copy failed:', err);
        showToast('Failed to copy to clipboard.');
      });
  };

  const handleSendToBuyBlazerCart = () => {
    if (items.length === 0) {
      showToast('No items in list to add to BuyBlazer.');
      return;
    }
    const payload = getPayloadString();

    try {
      window.parent.postMessage(
        {
          type: 'BLAZER_AI_ADD_TO_CART',
          payload: payload,
        },
        'https://www.buyblazer.com'
      );
    } catch (e) {
      console.warn('postMessage to buyblazer parent window failed:', e);
    }

    showToast(`Order payload sent to BuyBlazer cart! (${items.length} line items)`);
  };

  const handleSelectSwap = (itemId: string, selectedProdId: string) => {
    if (!selectedProdId) return;
    const targetProduct = catalog.find(
      (p) => String(p.PROD_ID).trim() === String(selectedProdId).trim()
    );
    if (targetProduct) {
      onSwapProduct(itemId, targetProduct);
    }
  };

  const totalQty = items.reduce((acc, curr) => acc + (curr.qty || 0), 0);

  return (
    <section className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-[#002d72] text-white text-xs font-semibold px-4 py-3 rounded-lg shadow-md flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-gray-300 hover:text-white font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-xs gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
            Matched Result Items
          </h2>
          {items.length > 0 && (
            <span className="bg-blue-100 text-[#002d72] text-xs font-bold px-2 py-0.5 rounded-full">
              {items.length} {items.length === 1 ? 'item' : 'items'} ({totalQty} total units)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyRawList}
            className="text-xs border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-gray-500" />
            Copy Raw List
          </button>
          <button
            type="button"
            onClick={handleSendToBuyBlazerCart}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3.5 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Add All to BuyBlazer Cart
          </button>
        </div>
      </div>

      {/* Matched Cards List or Empty Placeholder */}
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center text-gray-400 text-sm">
            <p className="font-semibold text-gray-500">No items processed yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              Enter your contractor material list on the left and click &quot;AI Match &amp; Process Order&quot;.
            </p>
          </div>
        ) : (
          items.map((item, index) => {
            const prod = item.product;
            const alternatives = item.alternatives || [];

            return (
              <div
                key={item.id}
                className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col gap-3 transition hover:border-gray-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-block bg-[#002d72] text-white text-xs font-bold px-2 py-0.5 rounded">
                        PROD ID: {prod.PROD_ID}
                      </span>
                      {prod.brand_manufacturer && (
                        <span className="inline-block bg-gray-100 text-gray-600 text-[11px] font-semibold px-2 py-0.5 rounded">
                          {prod.brand_manufacturer}
                        </span>
                      )}
                      {item.originalQuery && (
                        <span className="text-[11px] text-gray-400 italic">
                          Matched from: &quot;{item.originalQuery}&quot;
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 leading-snug">
                      {prod.clean_title || prod.PRODUCT}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      <span className="font-medium text-gray-600">ERP Name:</span>{' '}
                      {(prod.PRODUCT || '').substring(0, 90)}... |{' '}
                      <span className="font-medium text-gray-600">MPN:</span>{' '}
                      {prod.manufacturer_part_number || 'N/A'}
                    </p>
                  </div>

                  {/* Quantity and Remove */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                        Qty {item.unit ? `(${item.unit})` : ''}
                      </label>
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, Math.max(1, item.qty - 1))}
                          className="px-2 py-1 text-gray-600 hover:bg-gray-200 text-xs font-bold cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            onUpdateQty(item.id, isNaN(val) || val < 1 ? 1 : val);
                          }}
                          className="w-14 text-center bg-white text-xs font-bold py-1 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, item.qty + 1)}
                          className="px-2 py-1 text-gray-600 hover:bg-gray-200 text-xs font-bold cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer self-center"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Close Alternatives Dropdown */}
                <div className="border-t border-gray-100 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="w-full">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                      <ArrowRightLeft className="w-3 h-3 text-blue-600" />
                      Close Alternatives (Click to Swap):
                    </label>
                    <select
                      value=""
                      onChange={(e) => handleSelectSwap(item.id, e.target.value)}
                      className="w-full text-xs p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium cursor-pointer focus:ring-1 focus:ring-[#002d72]"
                    >
                      <option value="">
                        -- Active: {prod.PROD_ID} - {(prod.clean_title || prod.PRODUCT || '').substring(0, 45)}... --
                      </option>
                      {alternatives.map((alt) => (
                        <option key={alt.PROD_ID} value={alt.PROD_ID}>
                          Swap to: {alt.PROD_ID} - {(alt.clean_title || alt.PRODUCT || '').substring(0, 50)}
                          {alt.manufacturer_part_number ? ` (MPN: ${alt.manufacturer_part_number})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
