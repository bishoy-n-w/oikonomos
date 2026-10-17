import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useModalEscape } from '../../utils/useModalEscape';
import { 
  parseSpreadsheetFile, 
  autoMapHeadersHeuristically, 
  enhanceMappingWithGemini, 
  executeImportBatch, 
  revertImportBatch, 
  TARGET_FIELDS, 
  type ImportResult 
} from '../../services/smartImport';
import type { ClassDoc } from '../../types';
import { 
  Upload, 
  X, 
  Check, 
  Sparkles, 
  FileSpreadsheet, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  Layers 
} from 'lucide-react';

interface SmartImportModalProps {
  churchId: string;
  academicYears: Array<{ id: string; displayName: string }>;
  serviceGroups: Array<{ id: string; displayName: string }>;
  classes: ClassDoc[];
  defaultYearId: string;
  defaultGroupId: string;
  defaultClassId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const SmartImportModal: React.FC<SmartImportModalProps> = ({
  churchId,
  academicYears,
  serviceGroups,
  classes,
  defaultYearId,
  defaultGroupId,
  defaultClassId,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  useModalEscape(onClose, true);

  // Wizard Steps: 1: Upload & Header Row, 2: Mapping, 3: Assignment, 4: Report
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // File & Parsing state
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<any[][]>([]);
  const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [loadingFile, setLoadingFile] = useState(false);

  // Gemini AI state
  const [geminiKey, setGeminiKey] = useState<string>(
    import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('oikonomos_gemini_key') || ''
  );
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [aiEnhancing, setAiEnhancing] = useState(false);

  // Assignment state
  const [targetYearId, setTargetYearId] = useState(defaultYearId || academicYears[0]?.id || '');
  const [targetGroupId, setTargetGroupId] = useState(defaultGroupId || serviceGroups[0]?.id || '');
  const [targetClassId, setTargetClassId] = useState(defaultClassId || '');

  // Import execution & rollback state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [reverting, setReverting] = useState(false);
  const [revertedCount, setRevertedCount] = useState<number | null>(null);

  // Filter available classes matching selected group
  const availableClasses = classes.filter((c) => {
    const yearData = targetYearId ? c.academicYears?.[targetYearId] : Object.values(c.academicYears || {})[0];
    return (yearData?.serviceGroupId || c.serviceGroupId) === targetGroupId;
  });

  // Handle File Selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setLoadingFile(true);
    try {
      setFile(selected);
      const { rawRows: rows } = await parseSpreadsheetFile(selected);
      setRawRows(rows);

      // Auto-map using heuristic layer (Option 3 instant offline)
      if (rows.length > 0) {
        const headers = rows[0].map((h: any) => String(h || '').trim());
        const initialMap = autoMapHeadersHeuristically(headers);
        setColumnMapping(initialMap);
      }
    } catch (err) {
      console.error('Failed to parse file:', err);
      alert('Could not parse spreadsheet. Please ensure it is a valid Excel or CSV file.');
    } finally {
      setLoadingFile(false);
    }
  };

  // When user selects a different header row index
  const handleHeaderRowSelect = (idx: number) => {
    setHeaderRowIdx(idx);
    if (rawRows.length > idx) {
      const headers = rawRows[idx].map((h: any) => String(h || '').trim());
      const updatedMap = autoMapHeadersHeuristically(headers);
      setColumnMapping(updatedMap);
    }
  };

  // Trigger Gemini AI enhancement (Option 3 AI layer)
  const handleEnhanceWithAI = async () => {
    if (!geminiKey) {
      setShowKeyInput(true);
      return;
    }

    setAiEnhancing(true);
    try {
      localStorage.setItem('oikonomos_gemini_key', geminiKey);
      const headers = rawRows[headerRowIdx].map((h: any) => String(h || '').trim());
      const sample = rawRows.slice(headerRowIdx + 1, headerRowIdx + 4);
      const aiMap = await enhanceMappingWithGemini(headers, sample, geminiKey);
      setColumnMapping((prev) => ({ ...prev, ...aiMap }));
    } finally {
      setAiEnhancing(false);
    }
  };

  // Run the batch import
  const handleExecuteImport = async () => {
    if (!targetYearId || !targetGroupId || !targetClassId) {
      alert('Please select a target Academic Year, Service Group, and Class.');
      return;
    }

    // Check that at least fullName is mapped
    const hasFullName = Object.values(columnMapping).includes('fullName');
    if (!hasFullName) {
      alert('Please map at least one column to "Full Name" before importing.');
      return;
    }

    setImporting(true);
    try {
      const result = await executeImportBatch(
        churchId,
        rawRows,
        headerRowIdx,
        columnMapping,
        {
          academicYearId: targetYearId,
          serviceGroupId: targetGroupId,
          classId: targetClassId,
        },
        user?.email || 'admin'
      );
      setImportResult(result);
      setStep(4);
      onSuccess();
    } catch (err: any) {
      alert(`Import failed: ${err.message || 'Unknown error'}`);
    } finally {
      setImporting(false);
    }
  };

  // One-click Rollback
  const handleRevert = async () => {
    if (!importResult?.batchId) return;
    if (window.confirm('Are you sure you want to revert this import? All students created in this batch will be permanently deleted.')) {
      setReverting(true);
      try {
        const count = await revertImportBatch(churchId, importResult.batchId);
        setRevertedCount(count);
        onSuccess();
      } catch (err: any) {
        alert(`Revert failed: ${err.message || 'Unknown error'}`);
      } finally {
        setReverting(false);
      }
    }
  };

  const headers = rawRows.length > headerRowIdx ? rawRows[headerRowIdx].map((h: any) => String(h || '').trim()) : [];
  const sampleDataRows = rawRows.slice(headerRowIdx + 1, headerRowIdx + 4);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                Smart Excel & CSV Import
              </h3>
              <p className="text-[11px] text-zinc-400">
                Step {step} of 3: {step === 1 ? 'Upload & Header Selection' : step === 2 ? 'Review Column Mapping' : step === 3 ? 'Classroom Assignment' : 'Import Complete'}
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={importing || reverting} className="p-1 text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
          {/* STEP 1: Upload & Header Row Selector */}
          {step === 1 && (
            <div className="space-y-4">
              {/* File Dropzone */}
              <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 text-center hover:border-teal-500 transition cursor-pointer relative bg-zinc-50/50 dark:bg-zinc-800/30">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload className="w-8 h-8 text-teal-600 mx-auto mb-2" />
                <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200">
                  {loadingFile ? 'Reading and parsing spreadsheet...' : file ? file.name : 'Select or drop an Excel (.xlsx, .xls) or CSV file'}
                </p>
                <p className="text-[11px] text-zinc-400 mt-1">Supports English and Arabic column headers</p>
              </div>

              {/* Header Row Index Picker */}
              {rawRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-teal-600" />
                      <span>Select Header Row:</span>
                    </label>
                    <span className="text-[11px] text-teal-600 font-semibold">
                      Row {headerRowIdx + 1} is currently selected as Headers
                    </span>
                  </div>

                  {/* Preview Table of First 5 Rows */}
                  <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-x-auto max-h-48">
                    <table className="w-full text-start text-[11px]">
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {rawRows.slice(0, 5).map((row, rIdx) => {
                          const isSelectedHeader = rIdx === headerRowIdx;

                          return (
                            <tr
                              key={rIdx}
                              onClick={() => handleHeaderRowSelect(rIdx)}
                              className={`cursor-pointer transition ${
                                isSelectedHeader
                                  ? 'bg-teal-50 dark:bg-teal-950/60 font-bold text-teal-900 dark:text-teal-200'
                                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                              }`}
                            >
                              <td className="px-3 py-2 w-16 whitespace-nowrap text-zinc-400 font-mono">
                                Row {rIdx + 1}
                              </td>
                              {row.slice(0, 6).map((cell: any, cIdx: number) => (
                                <td key={cIdx} className="px-3 py-2 whitespace-nowrap truncate max-w-[120px]">
                                  {String(cell || '-')}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Interactive Column Mapping (Option 3 Hybrid AI) */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Option 3 AI Enhancement Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/40 dark:to-emerald-950/40 border border-teal-200 dark:border-teal-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-600 shrink-0" />
                  <div>
                    <p className="font-bold text-xs text-teal-950 dark:text-teal-200">
                      Bilingual AI Mapping Engine
                    </p>
                    <p className="text-[11px] text-teal-700/80 dark:text-teal-400">
                      Auto-matched using bilingual Arabic/English heuristics.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleEnhanceWithAI}
                    disabled={aiEnhancing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-xs cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{aiEnhancing ? 'Analyzing...' : 'Enhance with Gemini AI'}</span>
                  </button>
                </div>
              </div>

              {/* Optional Gemini Key Input */}
              {showKeyInput && (
                <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 space-y-2">
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                    Google Gemini API Key (Free tier from Google AI Studio):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className="flex-1 p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowKeyInput(false);
                        handleEnhanceWithAI();
                      }}
                      className="px-3 py-1.5 rounded-xl font-bold bg-teal-600 text-white text-xs"
                    >
                      Save & Run
                    </button>
                  </div>
                </div>
              )}

              {/* Column Mapping Table */}
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
                <table className="w-full text-start text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-2.5 text-start">Spreadsheet Column</th>
                      <th className="px-4 py-2.5 text-start">Sample Data</th>
                      <th className="px-4 py-2.5 text-start">App Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {headers.map((hdr, idx) => {
                      const currentMappedKey = columnMapping[hdr] || 'ignore';
                      const sampleVal = sampleDataRows[0]?.[idx] || sampleDataRows[1]?.[idx] || '-';

                      return (
                        <tr key={hdr} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                          <td className="px-4 py-2.5 font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                            {hdr}
                          </td>
                          <td className="px-4 py-2.5 text-zinc-500 truncate max-w-[140px]">
                            {String(sampleVal)}
                          </td>
                          <td className="px-4 py-2.5">
                            <select
                              value={currentMappedKey}
                              onChange={(e) => setColumnMapping({ ...columnMapping, [hdr]: e.target.value })}
                              className={`p-1.5 rounded-xl border text-xs font-semibold w-full ${
                                currentMappedKey !== 'ignore'
                                  ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-700'
                                  : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                              }`}
                            >
                              <option value="ignore">[ Ignore this column ]</option>
                              {TARGET_FIELDS.map((f) => (
                                <option key={f.key} value={f.key}>
                                  {f.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: Classroom Assignment */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 space-y-3">
                <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Target Classroom Assignment
                </h4>
                <p className="text-zinc-400 text-xs">
                  All imported students will be enrolled in this designated Academic Year, Service Group, and Class.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Academic Year *</label>
                    <select
                      value={targetYearId}
                      onChange={(e) => setTargetYearId(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-semibold"
                    >
                      {academicYears.map((y) => (
                        <option key={y.id} value={y.id}>{y.displayName}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Service Group *</label>
                    <select
                      value={targetGroupId}
                      onChange={(e) => {
                        setTargetGroupId(e.target.value);
                        setTargetClassId('');
                      }}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-semibold"
                    >
                      {serviceGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.displayName}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Class *</label>
                    <select
                      value={targetClassId}
                      onChange={(e) => setTargetClassId(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-semibold"
                    >
                      <option value="" disabled>Select Class</option>
                      {availableClasses.map((cls) => {
                        const yearData = targetYearId ? cls.academicYears?.[targetYearId] : Object.values(cls.academicYears || {})[0];
                        return (
                          <option key={cls.id} value={cls.id}>
                            {yearData?.displayName || yearData?.name || cls.id}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Completion Report & One-Click Revert */}
          {step === 4 && importResult && (
            <div className="space-y-4">
              <div className={`p-5 rounded-3xl border flex items-start gap-3.5 ${
                importResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
              }`}>
                {importResult.success ? (
                  <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                    Import {importResult.success ? 'Completed Successfully' : 'Completed with Issues'}
                  </h4>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                    Processed <strong className="text-zinc-900 dark:text-zinc-100">{importResult.totalProcessed}</strong> rows. Created <strong className="text-emerald-600">{importResult.totalCreated}</strong> students.
                  </p>
                </div>
              </div>

              {/* Rollback Notification if already reverted */}
              {revertedCount !== null && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Successfully reverted and removed {revertedCount} students from this batch.</span>
                </div>
              )}

              {/* One-Click Revert Button */}
              {revertedCount === null && (
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-zinc-800 dark:text-zinc-200">Spot an error?</p>
                    <p className="text-[11px] text-zinc-400">You can instantly revert this entire import batch.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRevert}
                    disabled={reverting}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 transition cursor-pointer"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${reverting ? 'animate-spin' : ''}`} />
                    <span>{reverting ? 'Reverting...' : 'Revert This Import'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div>
            {step > 1 && step < 4 && (
              <button
                type="button"
                onClick={() => setStep((prev) => (prev - 1) as any)}
                className="px-4 py-2 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Back
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {step < 4 ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                {step === 1 && (
                  <button
                    type="button"
                    disabled={rawRows.length === 0}
                    onClick={() => setStep(2)}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 transition disabled:opacity-50 cursor-pointer shadow-md shadow-teal-600/30"
                  >
                    <span>Next: Mapping</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {step === 2 && (
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 transition cursor-pointer shadow-md shadow-teal-600/30"
                  >
                    <span>Next: Assignment</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {step === 3 && (
                  <button
                    type="button"
                    disabled={importing || !targetClassId}
                    onClick={handleExecuteImport}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 transition disabled:opacity-50 cursor-pointer shadow-md shadow-teal-600/30"
                  >
                    <Check className="w-4 h-4" />
                    <span>{importing ? 'Importing Batch...' : 'Confirm & Import'}</span>
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 transition cursor-pointer"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
