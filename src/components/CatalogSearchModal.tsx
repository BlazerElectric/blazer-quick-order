import React, { useState, useMemo } from 'react';
import { Search, X, Plus, Check, Filter, Package } from 'lucide-react';
import { ProductItem } from '../types';
import { searchCatalogInstant } from '../utils/matching';

interface CatalogSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: ProductItem[];
  categories: string[];
  onAddProduct: (product: ProductItem, qty: number) => void;
}

export const CatalogSearchModal: React.FC<CatalogSearchModalProps> = ({
  isOpen,
  onClose,
  catalog,
  categories,
  onAddProduct,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const results = useMemo(() => {
    if (!isOpen) return [];
    return searchCatalogInstant(searchTerm, catalog, selectedCategory, 40);
  }, [isOpen, searchTerm, selectedCategory, catalog]);

  if (!isOpen) return null;

  const handleQtyChange = (prodId: string, val: number) => {
    setQuantities((prev) => ({
      ...prev,
      [prodId]: Math.max(1, val),
    }));
  };

  const handleAdd = (product: ProductItem) => {
    const qty = quantities[product.PROD_ID] || 1;
    onAddProduct(product, qty);
    setAddedIds((prev) => new Set(prev).add(product.PROD_ID));

    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(product.PROD_ID);
        return next;
      });
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#002d72]" />
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Browse &amp; Add from Blazer Catalog
              </h2>
              <p className="text-xs text-gray-500">
                Instantly search 8,400+ SKUs by MPN, product title, brand, or ERP name
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Category Filters */}
        <div className="p-4 border-b border-gray-200 space-y-3 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by part #, MPN, brand (e.g. 250-RT2, Bridgeport, 10/2, Caddy, strut)..."
              className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#002d72] focus:border-transparent focus:outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-gray-400 font-bold uppercase text-[10px] shrink-0 flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-[#002d72] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Categories
            </button>
            {categories.slice(0, 8).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#002d72] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#f8fafc]">
          <div className="flex items-center justify-between text-xs text-gray-500 px-1 pb-1">
            <span>
              Showing {results.length} results {searchTerm && `for "${searchTerm}"`}
            </span>
            <span className="text-[11px] text-gray-400">Total catalog: {catalog.length.toLocaleString()} SKUs</span>
          </div>

          {results.length === 0 ? (
            <div className="p-12 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
              <p className="text-sm font-semibold text-gray-600">No matching catalog items found</p>
              <p className="text-xs text-gray-400 mt-1">Try broadening your search term or selecting &quot;All Categories&quot;</p>
            </div>
          ) : (
            results.map((product) => {
              const qty = quantities[product.PROD_ID] || 1;
              const isAdded = addedIds.has(product.PROD_ID);

              return (
                <div
                  key={product.PROD_ID}
                  className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs hover:border-blue-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-[#002d72] text-white text-[11px] font-bold px-2 py-0.5 rounded">
                        PROD ID: {product.PROD_ID}
                      </span>
                      {product.brand_manufacturer && (
                        <span className="bg-gray-100 text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded">
                          {product.brand_manufacturer}
                        </span>
                      )}
                      {product.manufacturer_part_number && (
                        <span className="text-[11px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          MPN: {product.manufacturer_part_number}
                        </span>
                      )}
                      {product.primary_category && (
                        <span className="text-[10px] text-gray-400">
                          {product.primary_category}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 leading-snug">
                      {product.clean_title || product.PRODUCT}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-1">
                      {product.PRODUCT}
                    </p>
                  </div>

                  {/* Add action */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                      <button
                        type="button"
                        onClick={() => handleQtyChange(product.PROD_ID, qty - 1)}
                        className="px-2 py-1 text-gray-600 hover:bg-gray-200 text-xs font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={qty}
                        onChange={(e) =>
                          handleQtyChange(product.PROD_ID, parseInt(e.target.value, 10) || 1)
                        }
                        className="w-12 text-center bg-white text-xs font-bold py-1 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleQtyChange(product.PROD_ID, qty + 1)}
                        className="px-2 py-1 text-gray-600 hover:bg-gray-200 text-xs font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAdd(product)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                        isAdded
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#002d72] hover:bg-[#1e3a8a] text-white'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Added!
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          Add to Order
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-gray-50 border-t border-gray-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-lg transition cursor-pointer"
          >
            Done Adding
          </button>
        </div>
      </div>
    </div>
  );
};
