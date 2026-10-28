import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useModalEscape } from '../../utils/useModalEscape';
import { 
  parseSpreadsheetFile, 
  autoMapHeadersHeuristically, 
  autoDetectHeaderRow,
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
  Layers,
  Globe,
  Info 
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
  const { translate } = useApp();
  useModalEscape(onClose, true);

  // Wizard Steps: 1: Upload & Header Row, 2: Mapping, 3: Assignment, 4: Report
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // File & Parsing state
  const [file, setFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheetsMap, setSheetsMap] = useState<Record<string, any[][]>>({});
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rawRows, setRawRows] = useState<any[][]>([]);
  const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [loadingFile, setLoadingFile] = useState(false);
  const [isCsv, setIsCsv] = useState(false);
  const [selectedEncoding, setSelectedEncoding] = useState<string>('auto');
  const [detectedEncoding, setDetectedEncoding] = useState<string>('utf-8');

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

  // Batch default values for unmapped/missing fields (one value for all)
  const [defaultValues, setDefaultValues] = useState<Record<string, string>>({
    gender: 'auto',
    deacon: 'auto',
    schoolType: 'auto',
    fatherOfConfession: '',
    school: '',
    region: '',
    street: '',
    notes: '',
  });

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

  // Load and parse spreadsheet with optional encoding override
  const loadAndParseFile = async (targetFile: File, encodingToUse?: string) => {
    setLoadingFile(true);
    try {
      setFile(targetFile);
      const enc = encodingToUse === 'auto' ? undefined : encodingToUse;
      const parsed = await parseSpreadsheetFile(targetFile, enc);
      setIsCsv(!!parsed.isCsv);
      if (parsed.detectedEncoding) {
        setDetectedEncoding(parsed.detectedEncoding);
      }
      setSheetNames(parsed.sheetNames);
      setSheetsMap(parsed.sheets);
      const initialSheet = parsed.sheetNames[0] || '';
      setSelectedSheet(initialSheet);
      const rows = parsed.sheets[initialSheet] || [];
      setRawRows(rows);

      // Auto-detect best header row using Sunday School CRM semantics
      const detectedHeaderIdx = autoDetectHeaderRow(rows);
      setHeaderRowIdx(detectedHeaderIdx);

      // Auto-map using heuristic layer (Option 3 instant offline)
      if (rows.length > detectedHeaderIdx) {
        const headers = rows[detectedHeaderIdx].map((h: any) => String(h || '').trim());
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

  // Handle File Selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setSelectedEncoding('auto');
    await loadAndParseFile(selected, 'auto');
  };

  // Handle Encoding Override Change
  const handleEncodingChange = async (newEncoding: string) => {
    setSelectedEncoding(newEncoding);
    if (file) {
      await loadAndParseFile(file, newEncoding);
    }
  };

  // When user selects a different sheet tab
  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    const rows = sheetsMap[sheetName] || [];
    setRawRows(rows);
    const detectedHeaderIdx = autoDetectHeaderRow(rows);
    setHeaderRowIdx(detectedHeaderIdx);
    if (rows.length > detectedHeaderIdx) {
      const headers = rows[detectedHeaderIdx].map((h: any) => String(h || '').trim());
      const initialMap = autoMapHeadersHeuristically(headers);
      setColumnMapping(initialMap);
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
        user?.email || 'admin',
        defaultValues
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

  const [mappingFilter, setMappingFilter] = useState<'all' | 'mapped' | 'unmapped'>('all');

  // Detect non-empty columns in header row
  let lastNonEmptyCol = -1;
  if (rawRows.length > headerRowIdx) {
    const rawHeaderList = rawRows[headerRowIdx] || [];
    for (let c = rawHeaderList.length - 1; c >= 0; c--) {
      if (String(rawHeaderList[c] || '').trim() !== '') {
        lastNonEmptyCol = c;
        break;
      }
    }
  }

  const headers = rawRows.length > headerRowIdx
    ? rawRows[headerRowIdx].slice(0, Math.max(lastNonEmptyCol + 1, 1)).map((h: any) => String(h || '').trim())
    : [];
  const sampleDataRows = rawRows.slice(headerRowIdx + 1, headerRowIdx + 5);

  const mappedColumnsCount = Object.values(columnMapping).filter((v) => v && v !== 'ignore').length;
  const unmappedColumnsCount = headers.length - mappedColumnsCount;
  const isDobMapped = Object.values(columnMapping).includes('dob');
  const isFullNameMapped = Object.values(columnMapping).includes('fullName');

  const mappedTargetKeys = new Set(
    Object.values(columnMapping).filter((v) => v && v !== 'ignore')
  );
  const unmappedFields = TARGET_FIELDS.filter(
    (f) => f.key !== 'fullName' && !mappedTargetKeys.has(f.key)
  );

  const filteredHeaderIndices = headers
    .map((_, idx) => idx)
    .filter((idx) => {
      const hdr = headers[idx];
      const isMapped = columnMapping[hdr] && columnMapping[hdr] !== 'ignore';
      if (mappingFilter === 'mapped') return isMapped;
      if (mappingFilter === 'unmapped') return !isMapped;
      return true;
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90dvh] pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col">
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
                Step {step} of 4: {step === 1 ? 'Upload & Header Selection' : step === 2 ? 'Review Column Mapping' : step === 3 ? 'Classroom Assignment' : 'Import Complete'}
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

              {/* Multi-Tab / Sheet Selector */}
              {sheetNames.length > 1 && (
                <div className="space-y-2 p-3.5 rounded-2xl bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 text-xs">
                      <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                      <span>{translate('select_sheet')}</span>
                    </label>
                    <span className="text-[11px] text-zinc-400">
                      {sheetNames.length} {translate('sheets_found')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1 max-h-36 overflow-y-auto">
                    {sheetNames.map((sheet) => {
                      const isSelected = sheet === selectedSheet;
                      const rowCount = (sheetsMap[sheet] || []).length;
                      return (
                        <button
                          key={sheet}
                          type="button"
                          onClick={() => handleSheetChange(sheet)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                            isSelected
                              ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30 ring-2 ring-teal-500/50'
                              : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <bdi>{sheet}</bdi>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            isSelected ? 'bg-teal-700 text-teal-100' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                          }`}>
                            {rowCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Single Sheet Indicator */}
              {sheetNames.length === 1 && (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 text-xs">
                  <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300 font-medium">
                    <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                    <span>Sheet:</span>
                    <strong className="text-zinc-900 dark:text-zinc-100"><bdi>{selectedSheet}</bdi></strong>
                  </div>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {rawRows.length} rows
                  </span>
                </div>
              )}

              {/* CSV Text Encoding Selector */}
              {file && isCsv && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-800/80 text-xs">
                  <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <Globe className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span className="font-semibold">{translate('text_encoding')}:</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200">
                      {detectedEncoding === 'windows-1256' ? translate('encoding_win1256') : translate('encoding_utf8')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">{translate('encoding_override')}</label>
                    <select
                      value={selectedEncoding}
                      onChange={(e) => handleEncodingChange(e.target.value)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-[11px] font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                    >
                      <option value="auto">{translate('encoding_auto')}</option>
                      <option value="utf-8">{translate('encoding_utf8')}</option>
                      <option value="windows-1256">{translate('encoding_win1256')}</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Header Row Index Picker */}
              {rawRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-teal-600" />
                      <span>Select Header Row:</span>
                    </label>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold text-[11px]">
                      <Sparkles className="w-3 h-3 text-teal-600" />
                      <span>Row {headerRowIdx + 1} Selected as Headers</span>
                    </span>
                  </div>

                  {/* Preview Table of First 5 Rows */}
                  <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-x-auto max-h-48">
                    <table className="w-full text-start text-[11px]">
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {rawRows.slice(0, 6).map((row, rIdx) => {
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
                              <td className="px-3 py-2 w-20 whitespace-nowrap text-zinc-400 font-mono">
                                {isSelectedHeader ? '👉 Row ' + (rIdx + 1) : 'Row ' + (rIdx + 1)}
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
                  <p className="text-[11px] text-zinc-400">
                    💡 Click on the row in the table above that contains the actual column names (e.g. Full Name, Phone, DOB).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Interactive Column Mapping (Option 3 Hybrid AI) */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Option 3 AI Enhancement Bar */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/40 dark:to-emerald-950/40 border border-teal-200 dark:border-teal-800 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-teal-600 shrink-0" />
                    <div>
                      <p className="font-bold text-xs text-teal-950 dark:text-teal-200">
                        Smart AI & Heuristic Mapping Engine
                      </p>
                      <p className="text-[11px] text-teal-700/90 dark:text-teal-300">
                        Auto-mapped {mappedColumnsCount} of {headers.length} spreadsheet columns to CRM attributes.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleEnhanceWithAI}
                    disabled={aiEnhancing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-xs cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{aiEnhancing ? 'Analyzing with AI...' : 'Deep Scan with Gemini AI'}</span>
                  </button>
                </div>

                {/* Status overview badges */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-teal-200/60 dark:border-teal-800/60 text-[11px]">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold ${
                    isFullNameMapped ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {isFullNameMapped ? '✅ Full Name Mapped' : '❌ Full Name Missing'}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold ${
                    isDobMapped ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}>
                    {isDobMapped ? '📅 Date of Birth Mapped' : '⚪ Date of Birth Unmapped'}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200 font-bold">
                    🔍 Review or change any mapping below
                  </span>
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
                      className="px-3 py-1.5 rounded-xl font-bold bg-teal-600 text-white text-xs cursor-pointer"
                    >
                      Save & Run
                    </button>
                  </div>
                </div>
              )}

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 w-fit text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setMappingFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    mappingFilter === 'all'
                      ? 'bg-white dark:bg-zinc-900 text-teal-700 dark:text-teal-300 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  All Columns ({headers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMappingFilter('mapped')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    mappingFilter === 'mapped'
                      ? 'bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <span>✨ Mapped</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono">
                    {mappedColumnsCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMappingFilter('unmapped')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    mappingFilter === 'unmapped'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <span>⚪ Unmapped</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-[10px] font-mono">
                    {unmappedColumnsCount}
                  </span>
                </button>
              </div>

              {/* Column Mapping Cards List (Full width, perfectly visible) */}
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pe-1">
                {filteredHeaderIndices.length === 0 && (
                  <div className="p-8 text-center text-zinc-400 bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                    No columns match this filter.
                  </div>
                )}

                {filteredHeaderIndices.map((idx) => {
                  const hdr = headers[idx];
                  const currentMappedKey = columnMapping[hdr] || 'ignore';
                  const sampleVal = sampleDataRows[0]?.[idx] || sampleDataRows[1]?.[idx] || '';
                  const isMapped = currentMappedKey !== 'ignore';

                  return (
                    <div
                      key={`${idx}_${hdr}`}
                      className={`p-3.5 rounded-2xl border transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                        isMapped
                          ? 'bg-teal-50/40 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800/80'
                          : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      {/* Left: Column info & Sample */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                            <bdi>{hdr || `(Column ${idx + 1})`}</bdi>
                          </span>
                          {isMapped ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 shrink-0">
                              ✨ Mapped
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-200 dark:bg-zinc-700 text-zinc-500 shrink-0">
                              Ignored
                            </span>
                          )}
                        </div>

                        {/* Sample Value */}
                        {sampleVal ? (
                          <p className="text-[11px] text-zinc-500 font-mono ps-8 truncate">
                            Sample: <strong className="text-zinc-700 dark:text-zinc-300">{String(sampleVal)}</strong>
                          </p>
                        ) : (
                          <p className="text-[11px] text-zinc-400 ps-8 italic">No sample data in first rows</p>
                        )}
                      </div>

                      {/* Directional arrow */}
                      <div className="hidden md:flex text-zinc-300 dark:text-zinc-600 font-bold shrink-0">
                        ➔
                      </div>

                      {/* Right: Target CRM Field Selector - 100% visible & editable */}
                      <div className="w-full md:w-80 shrink-0 space-y-1">
                        <select
                          value={currentMappedKey}
                          onChange={(e) => setColumnMapping({ ...columnMapping, [hdr]: e.target.value })}
                          className={`w-full p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer shadow-xs ${
                            isMapped
                              ? 'bg-white dark:bg-zinc-900 text-teal-800 dark:text-teal-200 border-teal-500 dark:border-teal-600 ring-2 ring-teal-500/20'
                              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                          }`}
                        >
                          <option value="ignore">[ Ignore this column / تجاهل هذا العمود ]</option>
                          <optgroup label="Student Profile / بيانات الطالب">
                            {TARGET_FIELDS.filter(f => f.category === 'profile').map((f) => (
                              <option key={f.key} value={f.key}>{f.label}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Family & Contacts / أرقام وبيانات الأسرة">
                            {TARGET_FIELDS.filter(f => f.category === 'contacts').map((f) => (
                              <option key={f.key} value={f.key}>{f.label}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Address / العنوان">
                            {TARGET_FIELDS.filter(f => f.category === 'address').map((f) => (
                              <option key={f.key} value={f.key}>{f.label}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Notes / ملاحظات">
                            {TARGET_FIELDS.filter(f => f.category === 'notes').map((f) => (
                              <option key={f.key} value={f.key}>{f.label}</option>
                            ))}
                          </optgroup>
                        </select>

                        {/* Field-specific helper tag */}
                        {currentMappedKey === 'dob' && (
                          <p className="text-[10px] text-blue-600 dark:text-blue-400 ps-1">
                            📅 Dates will be auto-normalized to YYYY-MM-DD
                          </p>
                        )}
                        {(currentMappedKey === 'fatherMob' || currentMappedKey === 'motherMob' || currentMappedKey === 'kidMob' || currentMappedKey === 'otherMob') && (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 ps-1">
                            📞 Numbers will be auto-formatted to E.164
                          </p>
                        )}
                        {currentMappedKey === 'fullName' && (
                          <p className="text-[10px] text-teal-600 dark:text-teal-400 ps-1 font-semibold">
                            👤 Required student identifier
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
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

              {/* Batch Defaults for Unmapped / Missing Fields (Dynamic list of unmapped fields) */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 space-y-3">
                <div>
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-teal-600" />
                    <span>Unmapped Fields ({unmappedFields.length}) - Set Unified Value (Optional)</span>
                  </h4>
                  <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">
                    The following CRM fields were not found in your spreadsheet. You can provide a unified value for any of them to apply to all students in this batch:
                  </p>
                </div>

                {unmappedFields.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>All CRM fields have been mapped from your spreadsheet columns!</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {unmappedFields.map((field) => (
                      <div key={field.key} className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 space-y-1">
                        <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 truncate">
                          {field.label}
                        </label>

                        {field.type === 'select' && field.key === 'gender' && (
                          <select
                            value={defaultValues.gender || 'auto'}
                            onChange={(e) => setDefaultValues({ ...defaultValues, gender: e.target.value })}
                            className="w-full p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold"
                          >
                            <option value="auto">-- Leave Empty / فارغ --</option>
                            <option value="male">All Male / كلهم بنين (ذكر)</option>
                            <option value="female">All Female / كلهم بنات (أنثى)</option>
                          </select>
                        )}

                        {field.type === 'select' && field.key === 'deacon' && (
                          <select
                            value={defaultValues.deacon || 'auto'}
                            onChange={(e) => setDefaultValues({ ...defaultValues, deacon: e.target.value })}
                            className="w-full p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold"
                          >
                            <option value="auto">-- Leave Empty / فارغ --</option>
                            <option value="true">All Deacons / كلهم شمامسة (نعم)</option>
                            <option value="false">Not Deacons / مش شمامسة (لا)</option>
                          </select>
                        )}

                        {field.type === 'select' && field.key === 'schoolType' && (
                          <select
                            value={defaultValues.schoolType ?? 'auto'}
                            onChange={(e) => setDefaultValues({ ...defaultValues, schoolType: e.target.value })}
                            className="w-full p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold"
                          >
                            <option value="auto">⚡ Auto-Detect from School Name / كشف تلقائي من اسم المدرسة</option>
                            <option value="">-- Leave Empty / فارغ --</option>
                            <option value="National">All National / كلهم ناشونال (عربي / تجريبي / لغات)</option>
                            <option value="International">All International / كلهم انترناشونال (دولي)</option>
                          </select>
                        )}

                        {field.type === 'date' && (
                          <input
                            type="date"
                            value={defaultValues[field.key] || ''}
                            onChange={(e) => setDefaultValues({ ...defaultValues, [field.key]: e.target.value })}
                            className="w-full p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs"
                          />
                        )}

                        {field.type === 'tel' && (
                          <input
                            type="tel"
                            placeholder="+201..."
                            value={defaultValues[field.key] || ''}
                            onChange={(e) => setDefaultValues({ ...defaultValues, [field.key]: e.target.value })}
                            className="w-full p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-mono"
                          />
                        )}

                        {field.type === 'text' && (
                          <input
                            type="text"
                            placeholder={`Value for all...`}
                            value={defaultValues[field.key] || ''}
                            onChange={(e) => setDefaultValues({ ...defaultValues, [field.key]: e.target.value })}
                            className="w-full p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Completion Report & Detailed Attributes Breakdown */}
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
                    Processed <strong className="text-zinc-900 dark:text-zinc-100">{importResult.totalProcessed}</strong> total rows in sheet. Created <strong className="text-emerald-600">{importResult.totalCreated}</strong> students.
                    {importResult.totalSkipped > 0 && (
                      <span className="ms-1 text-zinc-400">({importResult.totalSkipped} blank/empty rows skipped)</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Notice when dates lacked years and were assigned year 2000 */}
              {Boolean(importResult.datesWithDefaultYearCount && importResult.datesWithDefaultYearCount > 0) && (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">
                      {importResult.datesWithDefaultYearCount} birth date(s) had day and month only (e.g. &apos;8 فبراير&apos;). Year 2000 was assigned as default (e.g. 2000-02-08).
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                      تم تعيين عام 2000 كعام افتراضي لـ {importResult.datesWithDefaultYearCount} تاريخ ميلاد بدون سنة (مثال: 2000-02-08).
                    </p>
                  </div>
                </div>
              )}

              {/* Imported Attributes Breakdown Grid */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 space-y-2.5">
                <h4 className="font-bold text-xs uppercase text-zinc-500 dark:text-zinc-400">
                  Imported Attributes Breakdown
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase">Full Name</p>
                    <p className="text-sm font-extrabold text-teal-600">{importResult.attributeCounts?.fullName || importResult.totalCreated} / {importResult.totalCreated}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase">Date of Birth</p>
                    <p className="text-sm font-extrabold text-blue-600">{importResult.attributeCounts?.dob || 0} / {importResult.totalCreated}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase">Gender</p>
                    <p className="text-sm font-extrabold text-purple-600">{importResult.attributeCounts?.gender || importResult.totalCreated} / {importResult.totalCreated}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase">Father Phone</p>
                    <p className="text-sm font-extrabold text-emerald-600">{importResult.attributeCounts?.fatherMob || 0} / {importResult.totalCreated}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase">Mother Phone</p>
                    <p className="text-sm font-extrabold text-emerald-600">{importResult.attributeCounts?.motherMob || 0} / {importResult.totalCreated}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase">Home Address</p>
                    <p className="text-sm font-extrabold text-zinc-700 dark:text-zinc-300">{importResult.attributeCounts?.address || 0} / {importResult.totalCreated}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase">School</p>
                    <p className="text-sm font-extrabold text-zinc-700 dark:text-zinc-300">{importResult.attributeCounts?.school || 0} / {importResult.totalCreated}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase">Confession Father</p>
                    <p className="text-sm font-extrabold text-zinc-700 dark:text-zinc-300">{importResult.attributeCounts?.fatherOfConfession || 0} / {importResult.totalCreated}</p>
                  </div>
                </div>
              </div>

              {/* Live Preview Table of Newly Imported Students */}
              {importResult.sampleImportedRecords && importResult.sampleImportedRecords.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-zinc-800 dark:text-zinc-200">
                      Imported Students Sample ({importResult.sampleImportedRecords.length}):
                    </h4>
                    <span className="text-[11px] text-zinc-400">Verified & normalized data</span>
                  </div>
                  <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-x-auto max-h-48">
                    <table className="w-full text-start text-[11px]">
                      <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="px-3 py-2 text-start">#</th>
                          <th className="px-3 py-2 text-start">Full Name</th>
                          <th className="px-3 py-2 text-start">Gender</th>
                          <th className="px-3 py-2 text-start">Date of Birth</th>
                          <th className="px-3 py-2 text-start">Father Phone</th>
                          <th className="px-3 py-2 text-start">Address</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                        {importResult.sampleImportedRecords.map((rec, i) => (
                          <tr key={i} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                            <td className="px-3 py-2 text-zinc-400 font-mono">{i + 1}</td>
                            <td className="px-3 py-2 font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap"><bdi>{rec.fullName}</bdi></td>
                            <td className="px-3 py-2 whitespace-nowrap">{rec.gender === 'female' ? 'Female' : 'Male'}</td>
                            <td className="px-3 py-2 font-mono whitespace-nowrap">
                              {rec.dob ? (
                                <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold">{rec.dob}</span>
                              ) : (
                                <span className="text-zinc-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono whitespace-nowrap text-emerald-600 dark:text-emerald-400">{rec.fatherMob || '-'}</td>
                            <td className="px-3 py-2 truncate max-w-[140px]">{rec.address || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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
