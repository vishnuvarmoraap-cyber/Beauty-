import React, { useState } from 'react';
import { Product, SupplierParty, SupplierTransaction, SaleInvoice } from '../types';
import { Download, FileJson, FileSpreadsheet, X, CheckCircle, Database } from 'lucide-react';

interface DataBackupExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  suppliers: SupplierParty[];
  transactions: SupplierTransaction[];
  sales: SaleInvoice[];
}

export const DataBackupExportModal: React.FC<DataBackupExportModalProps> = ({
  isOpen,
  onClose,
  products,
  suppliers,
  transactions,
  sales,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper to escape CSV values
  const escapeCSV = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // 1. Export Entire Application State as JSON
  const handleExportFullJSON = () => {
    const backupData = {
      appName: 'BEAUTY BRANDS Stock Master',
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      metadata: {
        totalProducts: products.length,
        totalSuppliers: suppliers.length,
        totalTransactions: transactions.length,
        totalSalesInvoices: sales.length,
      },
      products,
      suppliers,
      transactions,
      sales,
    };

    const filename = `LuxeCosmetics_Full_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    triggerDownload(JSON.stringify(backupData, null, 2), filename, 'application/json');
    setDownloadSuccess('Complete Application JSON Backup downloaded!');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  // 2. Export Products Catalog CSV
  const handleExportProductsCSV = () => {
    const headers = [
      'ID', 'Barcode', 'Name', 'Brand', 'Category',
      'PurchasePrice', 'SellingPrice', 'CurrentStock', 'MinStockLevel',
      'BatchNumber', 'ExpiryDate', 'SupplierID', 'Location', 'ImageUrl', 'Notes', 'LastUpdated'
    ];

    const rows = products.map((p) => [
      escapeCSV(p.id),
      escapeCSV(p.barcode),
      escapeCSV(p.name),
      escapeCSV(p.brand),
      escapeCSV(p.category),
      escapeCSV(p.purchasePrice),
      escapeCSV(p.sellingPrice),
      escapeCSV(p.currentStock),
      escapeCSV(p.minStockLevel),
      escapeCSV(p.batchNumber || ''),
      escapeCSV(p.expiryDate || ''),
      escapeCSV(p.supplierId),
      escapeCSV(p.location || ''),
      escapeCSV(p.imageUrl || ''),
      escapeCSV(p.notes || ''),
      escapeCSV(p.lastUpdated),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const filename = `LuxeCosmetics_Products_${new Date().toISOString().slice(0, 10)}.csv`;
    triggerDownload(csvContent, filename, 'text/csv;charset=utf-8;');
    setDownloadSuccess('Products CSV exported successfully!');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  // 3. Export Suppliers & Ledger CSV
  const handleExportSuppliersCSV = () => {
    const headers = [
      'ID', 'SupplierName', 'ContactPerson', 'Phone', 'Email',
      'Address', 'GSTNumber', 'OpeningBalance', 'CurrentBalance', 'CreatedAt'
    ];

    const rows = suppliers.map((s) => [
      escapeCSV(s.id),
      escapeCSV(s.name),
      escapeCSV(s.contactPerson),
      escapeCSV(s.phone),
      escapeCSV(s.email),
      escapeCSV(s.address),
      escapeCSV(s.gstNumber || ''),
      escapeCSV(s.openingBalance),
      escapeCSV(s.balance),
      escapeCSV(s.createdAt),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const filename = `LuxeCosmetics_Suppliers_${new Date().toISOString().slice(0, 10)}.csv`;
    triggerDownload(csvContent, filename, 'text/csv;charset=utf-8;');
    setDownloadSuccess('Suppliers CSV exported successfully!');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  // 4. Export Supplier Ledger Transactions CSV
  const handleExportTransactionsCSV = () => {
    const headers = [
      'TransactionID', 'SupplierID', 'Date', 'Type', 'Amount',
      'Direction', 'RefInvoiceNo', 'PaymentMode', 'Notes'
    ];

    const rows = transactions.map((t) => [
      escapeCSV(t.id),
      escapeCSV(t.supplierId),
      escapeCSV(t.date),
      escapeCSV(t.type),
      escapeCSV(t.amount),
      escapeCSV(t.direction),
      escapeCSV(t.referenceInvoiceNo || ''),
      escapeCSV(t.paymentMode || ''),
      escapeCSV(t.notes || ''),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const filename = `LuxeCosmetics_Ledger_Transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    triggerDownload(csvContent, filename, 'text/csv;charset=utf-8;');
    setDownloadSuccess('Transactions CSV exported successfully!');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  // 5. Export Sales Invoices CSV
  const handleExportSalesCSV = () => {
    const headers = [
      'InvoiceNumber', 'Date', 'CustomerName', 'CustomerPhone',
      'PaymentMethod', 'Subtotal', 'DiscountAmount', 'GrandTotal',
      'TotalCost', 'NetProfit', 'ProfitMarginPercent', 'ItemsCount'
    ];

    const rows = sales.map((s) => [
      escapeCSV(s.invoiceNumber),
      escapeCSV(s.date),
      escapeCSV(s.customerName),
      escapeCSV(s.customerPhone || ''),
      escapeCSV(s.paymentMethod),
      escapeCSV(s.subtotal),
      escapeCSV(s.discountAmount),
      escapeCSV(s.grandTotal),
      escapeCSV(s.totalCost),
      escapeCSV(s.netProfit),
      escapeCSV(s.profitMarginPercent.toFixed(2)),
      escapeCSV(s.items.length),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const filename = `LuxeCosmetics_Sales_Invoices_${new Date().toISOString().slice(0, 10)}.csv`;
    triggerDownload(csvContent, filename, 'text/csv;charset=utf-8;');
    setDownloadSuccess('Sales Invoices CSV exported successfully!');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Export Application State & Backups</h3>
              <p className="text-xs text-slate-500">
                Download JSON database backup or CSV spreadsheets for external reporting & record-keeping.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success toast */}
        {downloadSuccess && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{downloadSuccess}</span>
          </div>
        )}

        {/* Database Inventory Snapshot */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 block text-[11px]">Products</span>
            <strong className="text-base text-pink-600 dark:text-pink-400">{products.length}</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 block text-[11px]">Suppliers</span>
            <strong className="text-base text-indigo-600 dark:text-indigo-400">{suppliers.length}</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 block text-[11px]">Transactions</span>
            <strong className="text-base text-amber-600 dark:text-amber-400">{transactions.length}</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 block text-[11px]">Sales Invoices</span>
            <strong className="text-base text-emerald-600 dark:text-emerald-400">{sales.length}</strong>
          </div>
        </div>

        {/* Primary Option: Complete JSON Backup */}
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-pink-500/10 via-rose-500/5 to-transparent border border-pink-500/30 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 font-bold text-sm text-pink-900 dark:text-pink-300">
                <FileJson className="w-4 h-4 text-pink-500" />
                <span>Complete JSON Database Backup</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                Packages all four tables (Products, Suppliers, Transactions, and Sales) into a single JSON file for safe disaster recovery or device migration.
              </p>
            </div>
            <button
              onClick={handleExportFullJSON}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:brightness-110 text-white font-semibold text-xs shadow-md transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download JSON</span>
            </button>
          </div>
        </div>

        {/* Secondary Options: Modular CSV Spreadsheets */}
        <div className="mt-4 space-y-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
            Export Tabular Spreadsheets (CSV for Excel / Google Sheets):
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* Products CSV */}
            <button
              onClick={handleExportProductsCSV}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left flex items-center justify-between transition cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-pink-600 dark:group-hover:text-pink-400">
                    Products & SKUs CSV
                  </div>
                  <span className="text-[10px] text-slate-400">{products.length} records with prices & stock</span>
                </div>
              </div>
              <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-pink-500" />
            </button>

            {/* Suppliers CSV */}
            <button
              onClick={handleExportSuppliersCSV}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left flex items-center justify-between transition cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-pink-600 dark:group-hover:text-pink-400">
                    Suppliers & Parties CSV
                  </div>
                  <span className="text-[10px] text-slate-400">{suppliers.length} parties with balances</span>
                </div>
              </div>
              <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-pink-500" />
            </button>

            {/* Transactions CSV */}
            <button
              onClick={handleExportTransactionsCSV}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left flex items-center justify-between transition cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-amber-500" />
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-pink-600 dark:group-hover:text-pink-400">
                    Supplier Ledger CSV
                  </div>
                  <span className="text-[10px] text-slate-400">{transactions.length} debit/credit entries</span>
                </div>
              </div>
              <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-pink-500" />
            </button>

            {/* Sales Invoices CSV */}
            <button
              onClick={handleExportSalesCSV}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left flex items-center justify-between transition cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-rose-500" />
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-pink-600 dark:group-hover:text-pink-400">
                    Sales & Invoices CSV
                  </div>
                  <span className="text-[10px] text-slate-400">{sales.length} customer sales bills</span>
                </div>
              </div>
              <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-pink-500" />
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
