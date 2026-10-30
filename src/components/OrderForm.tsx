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
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { OrderInputRow } from '../types';
import { compressAndNormalizeImage, createSampleJobsiteNote } from '../utils/imageUtils';

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
  bannerMessage: { type: 'error' | 'info' | 'success'; text: string } | null;
  setBannerMessage: (msg: { type: 'error' | 'info' | 'success'; text: string } | null) => void;
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
  bannerMessage,
  setBannerMessage,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [photoPayload, setPhotoPayload] = useState<{ base64: string; mimeType: string } | null>(null);

  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const toggleSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setBannerMessage({
        type: 'error',
        text: 'Speech recognition is not supported in this browser. Please type or paste your materials.',
      });
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
        setBannerMessage({
          type: 'info',
          text: `Loaded order file: ${file.name}`,
        });
      }
    };
    reader.readAsText(file);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    setBannerMessage(null);

    try {
      const { base64, mimeType, dataUrl } = await compressAndNormalizeImage(file);
      setPhotoDataUrl(dataUrl);
      setPhotoPayload({ base64, mimeType });
    } catch (err: any) {
      console.error('Error optimizing image:', err);
      setBannerMessage({
        type: 'error',
        text: 'Could not process the selected image file. Please try another photo.',
      });
    } finally {
      setIsCompressing(false);
      // Reset input value so re-selecting same file triggers onChange
      if (e.target) e.target.value = '';
    }
  };

  const handleLoadSampleDrywall = () => {
    try {
      const sample = createSampleJobsiteNote();
      setPhotoDataUrl(sample.dataUrl);
      setPhotoPayload({ base64: sample.base64, mimeType: sample.mimeType });
      setJobContext('Suite 200 Trim - Commercial Tenant Finish');
      setBannerMessage({
        type: 'success',
        text: 'Sample handwritten drywall note loaded. Click "Scan & Match Photo" to test AI extraction!',
      });
    } catch (err) {
      console.error('Failed to generate sample note:', err);
    }
  };

  const handleTriggerPhotoScan = () => {
    if (!photoDataUrl || !photoPayload) {
      setBannerMessage({
        type: 'error',
        text: 'Please snap a photo or upload an image first.',
      });
      return;
    }
    setBannerMessage(null);
    onProcessPhoto(photoPayload.base64, photoPayload.mimeType);
  };

  return (
    <section className="bg-white p-6 rounded-xl shadow-xs border border-gray-200 flex flex-col justify-between">
      <div className="space-y-5">
        {/* Banner Message (Error / Info) */}
        {bannerMessage && (
          <div
            className={`p-3 rounded-lg text-xs font-semibold flex items-start justify-between gap-2 border animate-fade-in ${
              bannerMessage.type === 'error'
                ? 'bg-red-50 text-red-800 border-red-200'
                : bannerMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-blue-50 text-[#002d72] border-blue-200'
            }`}
          >
            <div className="flex items-start gap-2">
              {bannerMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <span>{bannerMessage.text}</span>
            </div>
            <button
              onClick={() => setBannerMessage(null)}
              className="text-gray-400 hover:text-gray-700 font-bold ml-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

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
              onClick={() => {
                setMode('text');
                setBannerMessage(null);
              }}
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
              onClick={() => {
                setMode('table');
                setBannerMessage(null);
              }}
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
              onClick={() => {
                setMode('file');
                setBannerMessage(null);
              }}
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
              onClick={() => {
                setMode('photo');
                setBannerMessage(null);
              }}
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
              <div className="space-y-2">
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
                  {isCompressing ? (
                    <div className="py-2">
                      <span className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin inline-block mb-2"></span>
                      <p className="text-xs text-amber-800 font-bold">Optimizing photo for fast AI analysis...</p>
                    </div>
                  ) : (
                    <>
                      <Camera className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                      <p className="text-xs text-gray-700 font-bold">
                        Snap photo or upload image
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Works with drywall pencil scribbles, handwritten legal pads, or printed tickets
                      </p>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-gray-400">Testing without a photo?</span>
                  <button
                    type="button"
                    onClick={handleLoadSampleDrywall}
                    className="text-xs text-[#002d72] hover:text-[#1e3a8a] font-bold hover:underline flex items-center gap-1 cursor-pointer bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Load Sample Jobsite Note
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-black/5 flex items-center justify-center max-h-48">
                  <img
                    src={photoDataUrl}
                    alt="Jobsite Note"
                    className="object-contain max-h-48 w-auto rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoDataUrl(null);
                      setPhotoPayload(null);
                      setBannerMessage(null);
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
                  <button
                    type="button"
                    onClick={handleLoadSampleDrywall}
                    className="text-gray-500 hover:text-[#002d72] font-medium hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Load Sample Note
                  </button>
                </div>
              </div>
            )}

            {detectedPhotoNotes && (
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-lg text-xs text-gray-700 space-y-1">
                <div className="font-bold text-[#002d72] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Detected Handwriting / Note:
                </div>
                <p className="font-mono text-[11px] text-gray-800 italic leading-relaxed">
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
          onClick={() => {
            onReset();
            setBannerMessage(null);
          }}
          className="w-1/3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 px-4 rounded-lg transition text-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>

        {mode === 'photo' ? (
          <button
            type="button"
            disabled={isProcessing || isCompressing || !photoDataUrl}
            onClick={handleTriggerPhotoScan}
            className="w-2/3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-lg shadow-xs transition flex items-center justify-center gap-2 text-xs cursor-pointer"
          >
            {isProcessing ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Scanning Photo with AI...
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
