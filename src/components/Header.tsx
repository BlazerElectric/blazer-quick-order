import React from 'react';
import { Sparkles, Database, FileText } from 'lucide-react';

interface HeaderProps {
  catalogCount: number;
  isLoadingCatalog: boolean;
  catalogError: string | null;
  onLoadDemo: () => void;
  hasGeminiKey: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  catalogCount,
  isLoadingCatalog,
  catalogError,
  onLoadDemo,
  hasGeminiKey,
}) => {
  return (
    <header className="bg-white border-b border-gray-200 shadow-xs py-4 px-6 mb-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src="/Blazer-Blue.jpg"
            alt="Blazer Electric Supply"
            className="h-12 object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <div>
            <h1 className="text-2xl font-black text-[#002d72] tracking-tight flex items-center gap-2">
              AI Quick Order Assistant
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                B2B Pro
              </span>
            </h1>
            <p className="text-xs text-gray-500 font-medium">Fast Natural Language Contractor Order Entry</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isLoadingCatalog ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Loading Catalog...
            </span>
          ) : catalogError ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Catalog Error
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Catalog Ready ({catalogCount.toLocaleString()} SKUs)
            </span>
          )}

          {hasGeminiKey && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-[#002d72] border border-blue-100">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Gemini AI Active
            </span>
          )}

          <button
            onClick={onLoadDemo}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-1.5 px-3 rounded-lg transition border border-gray-300 flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-gray-500" />
            Load Demo Order
          </button>
        </div>
      </div>
    </header>
  );
};
