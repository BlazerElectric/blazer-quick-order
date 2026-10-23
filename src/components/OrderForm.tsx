import React, { useState, useRef } from 'react';
import {
  Search,
  RotateCcw,
  Upload,
  Plus,
  Trash2,
  Mic,
  MicOff,
  FileText,
  Table,
  MessageSquareText,
  Camera,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { OrderInputRow } from '../types';

interface OrderFormProps {
  jobContext: string;
  setJobContext: (val: string) => void;
  orderText: string;
  setOrderText: (val: string) => void;
  tableRows: OrderInputRow[];
  setTableRows: React.Dispatch<React.SetStateAction<OrderInputRow[]>>;
  mode: 'text' | 'table' | 'file' | 'photo';
  setMode: (mode: 'text' | 'table' | 'file' | 'photo') => void;
  onReset: () => void;
  onProcessOrder: () => void;
  isProcessing: boolean;
  uploadedFileName: string | null;
  setUploadedFileName: (name: string | null) => void;
  photoDataUrl: string | null;
  setPhotoDataUrl: (url: string | null) => void;
  onProcessPhoto: (base64: string, mimeType: string) => Promise<void>;
  detectedPhotoNotes: string | null;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  jobContext,
  setJobContext,
  orderText,
  setOrderText,
  tableRows,
  setTableRows,
  mode,
  setMode,
  onReset,
  onProcessOrder,
  isProcessing,
  uploadedFileName,
  setUploadedFileName,
  photoDataUrl,
  setPhotoDataUrl,
  onProcessPhoto,
  detectedPhotoNotes,
}) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const toggleSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (event.results[event.results.length - 1].isFinal) {
          setOrderText(orderText ? `${orderText}, ${transcript.trim()}` : transcript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch (err) {
      console.error('Failed to start speech recognition', err);
      setIsListening(false);
    }
  };

  const handleAddTableRow = () => {
    setTableRows((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2, 9),
        description: '',
        qty: 1,
      },
    ]);
  };

  const handleRemoveTableRow = (id: string) => {
    setTableRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const handleTableChange = (id: string, field: 'description' | 'qty', value: string) => {
    setTableRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (field === 'qty') {
          const num = parseInt(value, 10);
          return { ...r, qty: isNaN(num) ? 1 : num };
        }
        return { ...r, description: value };
      })
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setOrderText(content);
        setMode('text');
      }
    };
    reader.readAsText(file);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPhotoDataUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleTriggerPhotoScan = () => {
    if (!photoDataUrl) {
      alert('Please select or take a photo first.');
      return;
    }
    const match = photoDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      alert('Invalid image format.');
      return;
    }
    const mimeType = match[1];
    const base64 = match[2];
    onProcessPhoto(base64, mimeType);
  };

  return (
    <section className="bg-white p-6 rounded-xl shadow-xs border border-gray-200 flex flex-col justify-between">
      <div className="space-y-5">
        {/* Job Context */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
            Job / Project Context (Optional)
          </label>
          <input
            type="text"
            value={jobContext}
            onChange={(e) => setJobContext(e.target.value)}
            placeholder="e.g. Residential 200A Service Upgrade, Commercial Office Trim"
            className="w-full text-sm p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#002d72] focus:border-transparent focus:outline-none"
          />
        </div>

        {/* Input Method Navigation */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
            Input Method
          </label>
          <div className="grid grid-cols-4 gap-1 bg-gray-100 p-1 rounded-lg text-xs font-bold text-center">
            <button
              type="button"
              onClick={() => setMode('text')}
              className={`py-2 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                mode === 'text'
                  ? 'bg-white text-[#002d72] shadow-xs font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <MessageSquareText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Text /</span> Voice
            </button>
            <button
              type="button"
              onClick={() => setMode('table')}
              className={`py-2 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                mode === 'table'
                  ? 'bg-white text-[#002d72] shadow-xs font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              Table
            </button>
            <button
              type="button"
              onClick={() => setMode('file')}
              className={`py-2 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                mode === 'file'
                  ? 'bg-white text-[#002d72] shadow-xs font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              File
            </button>
            <button
              type="button"
              onClick={() => setMode('photo')}
              className={`py-2 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                mode === 'photo'
                  ? 'bg-white text-[#002d72] shadow-xs font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-amber-600" />
              Photo <span className="text-[10px] bg-amber-100 text-amber-800 px-1 rounded">AI</span>
            </button>
          </div>
        </div>

        {/* Mode: Text / Voice */}
        {mode === 'text' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-600">
                Paste Order List or Describe Materials:
              </label>
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`text-xs px-2.5 py-1 rounded-md flex items-center gap-1 font-medium transition cursor-pointer ${
                  isListening
                    ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                }`}
                title="Voice dictation"
              >
                {isListening ? (
                  <>
                    <MicOff className="w-3.5 h-3.5 text-red-600" />
                    Recording...
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5 text-gray-600" />
                    Voice Dictate
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={6}
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
              placeholder="e.g., 50ft 10/2 MC cable, 12 Caddy CJ6, 5 1in EMT connectors"
              className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#002d72] focus:border-transparent focus:outline-none font-mono"
            />
            <p className="text-[11px] text-gray-400">
              Tip: Separate items by newlines or commas. Trade nicknames, part numbers, and quantities are parsed automatically.
            </p>
          </div>
        )}

        {/* Mode: Quick Table */}
        {mode === 'table' && (
          <div className="space-y-2">
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50/50">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="pb-1.5 font-semibold">Description / Part</th>
                    <th className="pb-1.5 w-20 font-semibold">Qty</th>
                    <th className="pb-1.5 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tableRows.map((row) => (
                    <tr key={row.id}>
                      <td className="pr-2 py-1.5">
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => handleTableChange(row.id, 'description', e.target.value)}
                          placeholder="e.g., 3/4 EMT connector"
                          className="w-full p-1.5 border border-gray-300 rounded bg-white text-sm focus:ring-1 focus:ring-[#002d72] focus:outline-none"
                        />
                      </td>
                      <td className="py-1.5">
                        <input
                          type="number"
                          min={1}
                          value={row.qty}
                          onChange={(e) => handleTableChange(row.id, 'qty', e.target.value)}
                          className="w-full p-1.5 border border-gray-300 rounded bg-white text-sm text-center font-bold focus:ring-1 focus:ring-[#002d72] focus:outline-none"
                        />
                      </td>
                      <td className="py-1.5 text-center">
                        {tableRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTableRow(row.id)}
                            className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={handleAddTableRow}
              className="text-xs text-[#1e3a8a] font-bold hover:underline flex items-center gap-1 cursor-pointer pt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Row
            </button>
          </div>
        )}

        {/* Mode: File Upload */}
        {mode === 'file' && (
          <div className="space-y-2">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition cursor-pointer"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,.log"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs text-gray-600">
                <span className="font-bold text-[#002d72]">Click to upload</span> or drag & drop text/CSV order file
              </p>
              <p className="text-[11px] text-gray-400 mt-1">Accepts .txt and .csv line lists</p>
              {uploadedFileName && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-[#002d72] text-xs font-semibold rounded-md border border-blue-200">
                  <FileText className="w-3.5 h-3.5" />
                  {uploadedFileName}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mode: Photo / Drywall Scribble Upload */}
        {mode === 'photo' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-700">
                Jobsite Photo / Drywall Scribble Takeoff:
              </label>
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-600" /> Multimodal Vision
              </span>
            </div>

            {!photoDataUrl ? (
              <div
                onClick={() => cameraInputRef.current?.click()}
                className="border-2 border-dashed border-amber-300 bg-amber-50/40 rounded-xl p-6 text-center hover:bg-amber-50 transition cursor-pointer"
              >
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                <Camera className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                <p className="text-xs text-gray-700 font-bold">
                  Snap photo or upload image
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Works with drywall pencil scribbles, handwritten legal pads, or printed tickets
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-black/5 flex items-center justify-center max-h-44">
                  <img
                    src={photoDataUrl}
                    alt="Jobsite Note"
                    className="object-contain max-h-44 w-auto"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoDataUrl(null);
                    }}
                    className="absolute top-2 right-2 bg-red-600/90 hover:bg-red-700 text-white p-1 rounded-md text-xs cursor-pointer shadow-xs"
                    title="Remove photo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="text-[#002d72] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5" /> Change Photo
                  </button>
                </div>
              </div>
            )}

            {detectedPhotoNotes && (
              <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-gray-700 space-y-1">
                <div className="font-bold text-[#002d72] flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" /> Detected Handwriting:
                </div>
                <p className="font-mono text-[11px] text-gray-800 italic">
                  &quot;{detectedPhotoNotes}&quot;
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex gap-2 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={onReset}
          className="w-1/3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 px-4 rounded-lg transition text-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>

        {mode === 'photo' ? (
          <button
            type="button"
            disabled={isProcessing || !photoDataUrl}
            onClick={handleTriggerPhotoScan}
            className="w-2/3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-lg shadow-xs transition flex items-center justify-center gap-2 text-xs cursor-pointer"
          >
            {isProcessing ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Scanning Photo...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Scan &amp; Match Photo
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            disabled={isProcessing}
            onClick={onProcessOrder}
            className="w-2/3 bg-[#002d72] hover:bg-[#1e3a8a] disabled:opacity-50 text-white font-bold py-3 px-4 rounded-lg shadow-xs transition flex items-center justify-center gap-2 text-xs cursor-pointer"
          >
            {isProcessing ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Matching Catalog...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                AI Match &amp; Process Order
              </>
            )}
          </button>
        )}
      </div>
    </section>
  );
};
