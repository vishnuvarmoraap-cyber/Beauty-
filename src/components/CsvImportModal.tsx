import React, { useState, useRef } from 'react';
import { Product, SupplierParty } from '../types';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X, Download, HelpCircle } from 'lucide-react';
import { formatINR } from '../pdfUtils';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: SupplierParty[];
  onImportProducts: (validProducts: Omit<Product, 'id' | 'lastUpdated'>[]) => void;
}

interface ParsedRow {
  rowNumber: number;
  barcode: string;
  name: string;
  brand: string;
  category: Product['category'];
  purchasePrice: number;
  sellingPrice: number;
  currentStock: number;
  minStockLevel: number;
  supplierId: string;
  batchNumber?: string;
  expiryDate?: string;
  location?: string;
  imageUrl?: string;
  notes?: string;
  isValid: boolean;
  errors: string[];
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  suppliers,
  onImportProducts,
}) => {
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importSummary, setImportSummary] = useState<{ total: number; valid: number; invalid: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Simple CSV row parser handling quotes & commas
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleProcessCSV = (rawContent: string) => {
    const lines = rawContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      alert('CSV file must have a header row and at least one product data row.');
      return;
    }

    const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/[\s_-]+/g, ''));

    // Find column indexes
    const barcodeIdx = headers.findIndex((h) => h.includes('barcode') || h.includes('ean') || h.includes('sku') || h.includes('upc'));
    const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('title') || h.includes('product'));
    const brandIdx = headers.findIndex((h) => h.includes('brand') || h.includes('make'));
    const categoryIdx = headers.findIndex((h) => h.includes('cat') || h.includes('type'));
    const buyPriceIdx = headers.findIndex((h) => h.includes('buy') || h.includes('purchase') || h.includes('cost'));
    const sellPriceIdx = headers.findIndex((h) => h.includes('sell') || h.includes('mrp') || h.includes('retail') || h.includes('price'));
    const stockIdx = headers.findIndex((h) => h.includes('stock') || h.includes('qty') || h.includes('quantity'));
    const minStockIdx = headers.findIndex((h) => h.includes('min') || h.includes('alert') || h.includes('threshold'));
    const batchIdx = headers.findIndex((h) => h.includes('batch'));
    const expiryIdx = headers.findIndex((h) => h.includes('expir') || h.includes('exp'));
    const locationIdx = headers.findIndex((h) => h.includes('location') || h.includes('rack') || h.includes('aisle'));
    const imageIdx = headers.findIndex((h) => h.includes('image') || h.includes('photo') || h.includes('img'));
    const notesIdx = headers.findIndex((h) => h.includes('note') || h.includes('desc'));

    const rows: ParsedRow[] = [];
    const validCategories = ['Makeup', 'Skincare', 'Haircare', 'Fragrance', 'Bath & Body', 'Tools & Brushes', 'Nail Care'];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;

      const errors: string[] = [];

      // Extract & Validate Barcode
      const barcode = (barcodeIdx >= 0 ? cols[barcodeIdx] : cols[0]) || '';
      if (!barcode) {
        errors.push('Barcode is required');
      }

      // Extract & Validate Name
      const name = (nameIdx >= 0 ? cols[nameIdx] : cols[1]) || '';
      if (!name) {
        errors.push('Product name is required');
      }

      // Extract & Validate Brand
      const brand = (brandIdx >= 0 ? cols[brandIdx] : cols[2]) || '';
      if (!brand) {
        errors.push('Brand is required');
      }

      // Extract & Validate Category
      let categoryRaw = (categoryIdx >= 0 ? cols[categoryIdx] : 'Makeup') || 'Makeup';
      let category: Product['category'] = 'Makeup';
      const matchedCat = validCategories.find((c) => c.toLowerCase() === categoryRaw.toLowerCase());
      if (matchedCat) {
        category = matchedCat as Product['category'];
      } else {
        category = 'Makeup';
      }

      // Extract & Validate Cost/Purchase Price
      const purchasePriceStr = buyPriceIdx >= 0 ? cols[buyPriceIdx] : cols[3];
      const purchasePrice = parseFloat(purchasePriceStr) || 0;
      if (isNaN(purchasePrice) || purchasePrice < 0) {
        errors.push('Purchase price must be a valid positive number');
      }

      // Extract & Validate Selling Price
      const sellingPriceStr = sellPriceIdx >= 0 ? cols[sellPriceIdx] : cols[4];
      const sellingPrice = parseFloat(sellingPriceStr) || 0;
      if (isNaN(sellingPrice) || sellingPrice <= 0) {
        errors.push('Selling price (MRP) must be greater than 0');
      }

      // Extract & Validate Stock
      const stockStr = stockIdx >= 0 ? cols[stockIdx] : cols[5];
      const currentStock = parseInt(stockStr, 10);
      if (isNaN(currentStock) || currentStock < 0) {
        errors.push('Stock quantity must be a non-negative integer');
      }

      // Optional fields
      const minStockLevel = minStockIdx >= 0 && parseInt(cols[minStockIdx], 10) > 0 ? parseInt(cols[minStockIdx], 10) : 5;
      const batchNumber = batchIdx >= 0 ? cols[batchIdx] : '';
      const expiryDate = expiryIdx >= 0 ? cols[expiryIdx] : '';
      const location = locationIdx >= 0 ? cols[locationIdx] : '';
      const imageUrl = imageIdx >= 0 ? cols[imageIdx] : '';
      const notes = notesIdx >= 0 ? cols[notesIdx] : '';

      rows.push({
        rowNumber: i + 1,
        barcode,
        name,
        brand,
        category,
        purchasePrice,
        sellingPrice,
        currentStock: isNaN(currentStock) ? 0 : currentStock,
        minStockLevel,
        supplierId: suppliers[0]?.id || '',
        batchNumber,
        expiryDate,
        location,
        imageUrl,
        notes,
        isValid: errors.length === 0,
        errors,
      });
    }

    setParsedRows(rows);
    setImportSummary({
      total: rows.length,
      valid: rows.filter((r) => r.isValid).length,
      invalid: rows.filter((r) => !r.isValid).length,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvText(text);
        handleProcessCSV(text);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadSampleTemplate = () => {
    const sampleHeaders = 'Barcode,ProductName,Brand,Category,PurchasePrice,SellingPrice,CurrentStock,MinStockAlert,BatchNumber,ExpiryDate,Location,ImageUrl,Notes\n';
    const sampleRows = [
      '8901030784912,"SuperStay Matte Ink (Heroine 25)","Maybelline New York","Makeup",385,699,30,10,"MB-2026-01","2027-12-31","Aisle 1 - Bay A","https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=150","Bestseller coral shade"',
      '773602058471,"Lipstick Velvet Teddy (Neutral)","M.A.C","Makeup",1250,2200,18,6,"MAC-VT-22","2028-04-15","Luxury Showcase 1","https://images.unsplash.com/photo-1627384113743-6bd5a479fffd?w=150","Top neutral shade"',
      '8809416470009,"Low pH Good Morning Gel Cleanser (150ml)","COSRX","Skincare",450,850,25,8,"CX-GM-26","2027-09-30","K-Beauty Rack 2","https://images.unsplash.com/photo-1608248597359-5775c929a008?w=150","Gentle daily cleanser"',
      '3600523821034,"Revitalift Triple Power Moisturizer","L\'Oréal Paris","Skincare",680,1299,15,5,"LOR-TP-88","2027-11-20","Aisle 3","https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=150","Anti-aging formula"',
    ].join('\n');

    const blob = new Blob([sampleHeaders + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'LuxeCosmetics_Stock_Sample_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmImport = () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      alert('No valid products to import. Please resolve validation errors.');
      return;
    }

    const payload = validRows.map((r) => ({
      barcode: r.barcode,
      name: r.name,
      brand: r.brand,
      category: r.category,
      purchasePrice: r.purchasePrice,
      sellingPrice: r.sellingPrice,
      currentStock: r.currentStock,
      minStockLevel: r.minStockLevel,
      supplierId: r.supplierId,
      batchNumber: r.batchNumber,
      expiryDate: r.expiryDate,
      location: r.location,
      imageUrl: r.imageUrl,
      notes: r.notes,
    }));

    onImportProducts(payload);
    alert(`Successfully imported ${validRows.length} cosmetic products into Stock Master!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-900 dark:text-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Bulk CSV Import - Stock Master</h3>
              <p className="text-xs text-slate-500">
                Quickly import cosmetic inventory, prices, barcodes, and stock levels in bulk.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Top Actions: Template Download & File Selector */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">
                Need a ready CSV template?
              </span>
              <p className="text-[11px] text-slate-500">
                Download a pre-formatted template with headers: Barcode, Name, Brand, Buy/Sell Price, Stock.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownloadSampleTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-pink-500" />
                <span>Download Sample CSV</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-700 text-white font-semibold transition shadow-xs cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload CSV File</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </div>

          {/* Direct CSV Text Area (Paste option) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Or Paste CSV Content Directly:
              </label>
              {csvText && (
                <button
                  type="button"
                  onClick={() => {
                    setCsvText('');
                    setParsedRows([]);
                    setImportSummary(null);
                  }}
                  className="text-[11px] text-rose-500 hover:underline"
                >
                  Clear CSV Text
                </button>
              )}
            </div>
            <textarea
              rows={3}
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                if (e.target.value.trim()) {
                  handleProcessCSV(e.target.value);
                } else {
                  setParsedRows([]);
                  setImportSummary(null);
                }
              }}
              placeholder="Barcode,ProductName,Brand,Category,PurchasePrice,SellingPrice,CurrentStock&#10;8901030784912,Maybelline SuperStay Lipstick,Maybelline New York,Makeup,385,699,40"
              className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 font-mono text-[11px] focus:outline-hidden focus:border-pink-500"
            />
          </div>

          {/* Validation Status & Summary */}
          {importSummary && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  Rows detected: <strong>{importSummary.total}</strong>
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {importSummary.valid} Valid
                </span>
                {importSummary.invalid > 0 && (
                  <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5" /> {importSummary.invalid} with Errors
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400">
                Only valid rows will be imported into Stock Master.
              </span>
            </div>
          )}

          {/* Preview Table with Per-Row Validation Alerts */}
          {parsedRows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-72">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 sticky top-0 z-10 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-3 py-2.5 w-12 text-center">Row</th>
                    <th className="px-3 py-2.5 w-20 text-center">Status</th>
                    <th className="px-3 py-2.5">Barcode</th>
                    <th className="px-3 py-2.5">Product Title</th>
                    <th className="px-3 py-2.5">Brand</th>
                    <th className="px-3 py-2.5 text-right">Cost (₹)</th>
                    <th className="px-3 py-2.5 text-right">Sell (₹)</th>
                    <th className="px-3 py-2.5 text-center">Stock</th>
                    <th className="px-3 py-2.5">Validation Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {parsedRows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={
                        row.isValid
                          ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          : 'bg-rose-50/50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200'
                      }
                    >
                      <td className="px-3 py-2 text-center text-slate-400 font-mono text-[11px]">
                        #{row.rowNumber}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.isValid ? (
                          <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                            Valid
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
                            Error
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] font-medium">
                        {row.barcode || <span className="text-rose-500 font-normal">[Missing]</span>}
                      </td>
                      <td className="px-3 py-2 font-semibold">
                        {row.name || <span className="text-rose-500 font-normal">[Missing Name]</span>}
                      </td>
                      <td className="px-3 py-2">
                        {row.brand || <span className="text-rose-500 font-normal">[Missing Brand]</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatINR(row.purchasePrice)}
                      </td>
                      <td className="px-3 py-2 text-right font-bold">
                        {formatINR(row.sellingPrice)}
                      </td>
                      <td className="px-3 py-2 text-center font-bold">
                        {row.currentStock}
                      </td>
                      <td className="px-3 py-2 text-[11px]">
                        {row.isValid ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Ready to import</span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400 font-medium">
                            {row.errors.join('; ')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <div className="text-xs text-slate-500">
            {importSummary && importSummary.valid > 0 ? (
              <span>
                Ready to insert <strong>{importSummary.valid}</strong> products into active inventory.
              </span>
            ) : (
              <span>Required columns: Barcode, Name, Brand, PurchasePrice, SellingPrice, CurrentStock</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!importSummary || importSummary.valid === 0}
              onClick={handleConfirmImport}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:brightness-110 disabled:opacity-50 text-white font-semibold text-xs shadow-md transition cursor-pointer"
            >
              Confirm Import ({importSummary?.valid || 0} Products)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
