import React, { useState } from 'react';
import { Product, SupplierParty, SupplierTransaction } from '../types';
import { 
  Plus, Search, Filter, Scan, Edit3, Trash2, AlertTriangle, TrendingUp, 
  Sparkles, Download, Layers, Image as ImageIcon, Upload, FileSpreadsheet,
  PackageX, DollarSign, Percent, ArrowUpRight, ShoppingBag, CheckCircle, RefreshCw, Truck
} from 'lucide-react';
import { formatINR, exportStockInventoryPDF } from '../pdfUtils';
import { CsvImportModal } from './CsvImportModal';

interface StockMasterProps {
  products: Product[];
  suppliers: SupplierParty[];
  onAddProduct: (prod: Omit<Product, 'id' | 'lastUpdated'>) => void;
  onImportBulkProducts?: (prods: Omit<Product, 'id' | 'lastUpdated'>[]) => void;
  onUpdateProduct: (prod: Product) => void;
  onDeleteProduct: (id: string) => void;
  onOpenScanner: () => void;
  onAddTransaction?: (txn: Omit<SupplierTransaction, 'id'>) => void;
  onNavigateToTab?: (tab: 'stock' | 'suppliers' | 'pos' | 'analytics') => void;
  globalSearch?: string;
  onUpdateGlobalSearch?: (term: string) => void;
}

export const StockMaster: React.FC<StockMasterProps> = ({
  products,
  suppliers,
  onAddProduct,
  onImportBulkProducts,
  onUpdateProduct,
  onDeleteProduct,
  onOpenScanner,
  onAddTransaction,
  onNavigateToTab,
  globalSearch = '',
  onUpdateGlobalSearch,
}) => {
  const [localSearch, setLocalSearch] = useState('');
  const search = globalSearch !== '' ? globalSearch : localSearch;
  const setSearch = (val: string) => {
    setLocalSearch(val);
    if (onUpdateGlobalSearch) {
      onUpdateGlobalSearch(val);
    }
  };
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'healthy' | 'out'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Quick Reorder Confirmation Modal / Draft State
  const [reorderProduct, setReorderProduct] = useState<Product | null>(null);
  const [reorderQty, setReorderQty] = useState<number>(10);
  const [reorderSuccessMsg, setReorderSuccessMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    barcode: '',
    name: '',
    brand: '',
    category: 'Makeup' as Product['category'],
    purchasePrice: 0,
    sellingPrice: 0,
    currentStock: 0,
    minStockLevel: 5,
    supplierId: suppliers[0]?.id || '',
    batchNumber: '',
    expiryDate: '',
    location: '',
    imageUrl: '',
    notes: '',
  });

  // Extract unique brands
  const brands = ['All', ...Array.from(new Set(products.map((p) => p.brand).filter(Boolean)))];
  const categories = ['All', 'Makeup', 'Skincare', 'Haircare', 'Fragrance', 'Bath & Body', 'Tools & Brushes', 'Nail Care'];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase());
    const matchesBrand = selectedBrand === 'All' || p.brand === selectedBrand;
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesStock =
      stockFilter === 'all'
        ? true
        : stockFilter === 'out'
        ? p.currentStock <= 0
        : stockFilter === 'low'
        ? p.currentStock > 0 && p.currentStock <= p.minStockLevel
        : p.currentStock > p.minStockLevel;

    return matchesSearch && matchesBrand && matchesCategory && matchesStock;
  });

  // Margin metrics calculations
  const totalCostValuation = filteredProducts.reduce((acc, p) => acc + p.purchasePrice * p.currentStock, 0);
  const totalRetailValuation = filteredProducts.reduce((acc, p) => acc + p.sellingPrice * p.currentStock, 0);
  const totalPotentialProfit = totalRetailValuation - totalCostValuation;
  const overallMarginPercent =
    totalRetailValuation > 0 ? (totalPotentialProfit / totalRetailValuation) * 100 : 0;
  
  // Calculate Average Margin % across distinct SKUs
  const validMarginProducts = filteredProducts.filter((p) => p.sellingPrice > 0);
  const averageMarginPercent = validMarginProducts.length > 0
    ? validMarginProducts.reduce((acc, p) => acc + (((p.sellingPrice - p.purchasePrice) / p.sellingPrice) * 100), 0) / validMarginProducts.length
    : 0;

  // Out of Stock (stock === 0) and Low Stock (stock <= minStockLevel)
  const outOfStockCount = products.filter((p) => p.currentStock <= 0).length;
  const lowStockCount = products.filter((p) => p.currentStock > 0 && p.currentStock <= p.minStockLevel).length;

  // Filter low stock and out-of-stock items for dedicated reorder alert section
  const lowStockItems = products.filter((p) => p.currentStock <= p.minStockLevel);

  // Quick Reorder Handlers
  const handleInitiateQuickReorder = (prod: Product) => {
    // Recommend reorder quantity: replenish to minStockLevel * 3, or at least 15 units
    const suggestedQty = Math.max(15, (prod.minStockLevel * 3) - prod.currentStock);
    setReorderProduct(prod);
    setReorderQty(suggestedQty);
  };

  const handleConfirmQuickReorder = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!reorderProduct) return;

    const supplier = suppliers.find((s) => s.id === reorderProduct.supplierId) || suppliers[0];
    if (!supplier) {
      alert('Please add a supplier before generating a purchase order draft.');
      return;
    }

    const qty = Number(reorderQty) || 10;
    const unitPrice = reorderProduct.purchasePrice;
    const totalAmount = unitPrice * qty;
    const invoiceNo = `PO-DRAFT-${Math.floor(1000 + Math.random() * 9000)}`;

    if (onAddTransaction) {
      onAddTransaction({
        supplierId: supplier.id,
        supplierName: supplier.name,
        date: new Date().toISOString().slice(0, 10),
        type: 'PURCHASE_BILL',
        referenceInvoiceNo: invoiceNo,
        amount: totalAmount,
        direction: 'CREDIT', // We owe supplier for the new stock bill
        notes: `Auto-generated Quick Reorder Draft for low-stock SKU: ${reorderProduct.name} (${qty} units @ ₹${unitPrice})`,
        items: [
          {
            productId: reorderProduct.id,
            productName: reorderProduct.name,
            brand: reorderProduct.brand,
            qty,
            unitPrice,
            total: totalAmount,
          },
        ],
      });

      // Update product in-stock by the ordered quantity so inventory reflects the replenishment
      onUpdateProduct({
        ...reorderProduct,
        currentStock: reorderProduct.currentStock + qty,
        lastUpdated: new Date().toISOString().slice(0, 10),
      });

      setReorderSuccessMsg(
        `Purchase bill draft "${invoiceNo}" generated for ${supplier.name} (+${qty} units of ${reorderProduct.name}).`
      );
      setTimeout(() => setReorderSuccessMsg(null), 5000);
    }

    setReorderProduct(null);
  };

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormData({
      barcode: `890${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      name: '',
      brand: brands[1] || 'L\'Oréal Paris',
      category: 'Makeup',
      purchasePrice: 250,
      sellingPrice: 499,
      currentStock: 20,
      minStockLevel: 8,
      supplierId: suppliers[0]?.id || '',
      batchNumber: `BAT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      expiryDate: '2027-12-31',
      location: 'Rack A1',
      imageUrl: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=150&auto=format&fit=crop&q=80',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setFormData({
      barcode: prod.barcode,
      name: prod.name,
      brand: prod.brand,
      category: prod.category,
      purchasePrice: prod.purchasePrice,
      sellingPrice: prod.sellingPrice,
      currentStock: prod.currentStock,
      minStockLevel: prod.minStockLevel,
      supplierId: prod.supplierId,
      batchNumber: prod.batchNumber || '',
      expiryDate: prod.expiryDate || '',
      location: prod.location || '',
      imageUrl: prod.imageUrl || '',
      notes: prod.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.barcode.trim()) return;

    if (editingProduct) {
      onUpdateProduct({
        ...editingProduct,
        ...formData,
        lastUpdated: new Date().toISOString().slice(0, 10),
      });
    } else {
      onAddProduct(formData);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Business Overview Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Inventory Value (Cost & Retail MRP Breakdown) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-pink-500/40 transition">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Inventory Value
              </span>
              <div className="p-1.5 rounded-lg bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatINR(totalCostValuation)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-500">Retail Value (MRP):</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {formatINR(totalRetailValuation)}
            </span>
          </div>
        </div>

        {/* 2. Average Margin % */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-pink-500/10 via-rose-500/5 to-transparent border border-pink-500/30 shadow-xs flex flex-col justify-between hover:border-pink-500/60 transition">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-pink-900 dark:text-pink-300">
                Average Margin %
              </span>
              <div className="p-1.5 rounded-lg bg-pink-200/60 dark:bg-pink-900/60 text-pink-700 dark:text-pink-300">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-pink-600 dark:text-pink-400 flex items-baseline gap-1.5">
              <span>{averageMarginPercent.toFixed(1)}%</span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                (Overall: {overallMarginPercent.toFixed(1)}%)
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-pink-200/40 dark:border-pink-900/40 flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400">Locked Potential Profit:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              +{formatINR(totalPotentialProfit)}
            </span>
          </div>
        </div>

        {/* 3. Total Out-of-Stock Items */}
        <div 
          onClick={() => setStockFilter(stockFilter === 'out' ? 'all' : 'out')}
          className={`p-5 rounded-2xl border shadow-xs flex flex-col justify-between transition cursor-pointer group ${
            stockFilter === 'out'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-400'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Out-of-Stock Items
              </span>
              <div className={`p-1.5 rounded-lg ${outOfStockCount > 0 ? 'bg-rose-100 dark:bg-rose-950 text-rose-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                <PackageX className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${outOfStockCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                {outOfStockCount}
              </span>
              <span className="text-xs text-slate-500">
                {outOfStockCount === 1 ? 'item depleted' : 'items depleted'}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-500">Zero quantity SKUs</span>
            <span className="font-medium text-rose-600 dark:text-rose-400 group-hover:underline">
              {stockFilter === 'out' ? 'Clear filter' : 'Filter out-of-stock'}
            </span>
          </div>
        </div>

        {/* 4. Active Stock Health & Low Stock Alerts */}
        <div 
          onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
          className={`p-5 rounded-2xl border shadow-xs flex flex-col justify-between transition cursor-pointer group ${
            stockFilter === 'low'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-400'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Low Stock Threshold
              </span>
              {lowStockCount > 0 ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 animate-pulse">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {lowStockCount} Low
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700">
                  Healthy
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {products.reduce((acc, p) => acc + p.currentStock, 0)}{' '}
              <span className="text-sm font-normal text-slate-400">Units Total</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-500">{filteredProducts.length} visible SKUs</span>
            <span className="font-medium text-pink-600 dark:text-pink-400 group-hover:underline">
              {stockFilter === 'low' ? 'Show all items' : 'Filter low stock'}
            </span>
          </div>
        </div>
      </div>

      {/* Success Notification for Reorder Generation */}
      {reorderSuccessMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{reorderSuccessMsg}</span>
          </div>
          {onNavigateToTab && (
            <button
              onClick={() => onNavigateToTab('suppliers')}
              className="text-xs font-bold text-emerald-700 dark:text-emerald-300 underline hover:no-underline cursor-pointer"
            >
              View in Supplier Ledger →
            </button>
          )}
        </div>
      )}

      {/* Low-Stock & Out-of-Stock Quick Reorder Command Section */}
      {lowStockItems.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-transparent border border-amber-400/40 dark:border-amber-500/30 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Low Stock & Reorder Center ({lowStockItems.length} SKUs Need Attention)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                    Action Required
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generate instant purchase order bill drafts with default cosmetic suppliers.
                </p>
              </div>
            </div>
            <button
              onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
              className="text-xs font-semibold text-pink-600 dark:text-pink-400 hover:underline self-start sm:self-auto cursor-pointer"
            >
              {stockFilter === 'low' ? 'View all products' : 'Focus low stock table'}
            </button>
          </div>

          {/* Quick Reorder Cards Horizontal Scroll */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockItems.slice(0, 6).map((item) => {
              const supplier = suppliers.find((s) => s.id === item.supplierId) || suppliers[0];
              const suggested = Math.max(15, (item.minStockLevel * 3) - item.currentStock);
              const estCost = item.purchasePrice * suggested;

              return (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-xs text-pink-600 dark:text-pink-400">
                          {item.brand}
                        </span>
                        <h4 className="font-semibold text-xs text-slate-900 dark:text-white line-clamp-1">
                          {item.name}
                        </h4>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          item.currentStock <= 0
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-600'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-700'
                        }`}
                      >
                        {item.currentStock <= 0 ? 'Out of Stock' : `${item.currentStock} left (Min: ${item.minStockLevel})`}
                      </span>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                      <span>Supplier: <strong className="text-slate-700 dark:text-slate-300">{supplier?.name.slice(0, 16) || 'None'}</strong></span>
                      <span>Buy: <strong className="text-slate-700 dark:text-slate-300">{formatINR(item.purchasePrice)}</strong></span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">
                      Reorder: <strong>+{suggested} units</strong> ({formatINR(estCost)})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleInitiateQuickReorder(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                    >
                      <ShoppingBag className="w-3 h-3" />
                      <span>Quick Reorder</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Header & Filters */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search cosmetic name, brand (M.A.C, Huda, Maybelline) or scan barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-pink-500"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenScanner}
              type="button"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm font-medium transition cursor-pointer border border-slate-300 dark:border-slate-700"
            >
              <Scan className="w-4 h-4 text-pink-500" />
              <span>Scan Barcode</span>
            </button>

            <button
              onClick={() => setIsCsvModalOpen(true)}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-pink-50 dark:bg-pink-950/40 hover:bg-pink-100 dark:hover:bg-pink-900/40 text-pink-700 dark:text-pink-300 text-sm font-medium transition cursor-pointer border border-pink-200 dark:border-pink-800/80"
              title="Bulk import products from CSV spreadsheet"
            >
              <FileSpreadsheet className="w-4 h-4 text-pink-500" />
              <span>Import CSV</span>
            </button>

            <button
              onClick={() => exportStockInventoryPDF(filteredProducts, selectedBrand)}
              type="button"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-sm font-medium transition cursor-pointer border border-indigo-200 dark:border-indigo-800/80"
            >
              <Download className="w-4 h-4" />
              <span>Stock PDF Report</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white text-sm font-semibold shadow-md hover:brightness-110 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Cosmetic SKU</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="text-slate-500 font-medium flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter Brand:
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
            {brands.map((b) => (
              <button
                key={b}
                onClick={() => setSelectedBrand(b)}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  selectedBrand === b
                    ? 'bg-pink-600 text-white font-medium'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-2 hidden sm:block" />

          <span className="text-slate-500 font-medium">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border-none text-slate-700 dark:text-slate-300 text-xs focus:ring-1 focus:ring-pink-500"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-2 hidden sm:block" />

          <span className="text-slate-500 font-medium">Stock Status:</span>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border-none text-slate-700 dark:text-slate-300 text-xs focus:ring-1 focus:ring-pink-500 font-medium"
          >
            <option value="all">All Inventory</option>
            <option value="out">Out of Stock ({outOfStockCount})</option>
            <option value="low">Low Stock Alerts ({lowStockCount})</option>
            <option value="healthy">Healthy Stock</option>
          </select>
        </div>
      </div>

      {/* Stock Master Table with Profit & Loss Margin Breakdown */}
      <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-3 py-3.5 text-center w-12">Photo</th>
                <th className="px-4 py-3.5">Product & Brand</th>
                <th className="px-4 py-3.5">Barcode / EAN</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5 text-right">Cost Price (Buy)</th>
                <th className="px-4 py-3.5 text-right">Selling Price (MRP)</th>
                <th className="px-4 py-3.5 text-right">Unit Profit</th>
                <th className="px-4 py-3.5 text-center">Margin %</th>
                <th className="px-4 py-3.5 text-center">In Stock</th>
                <th className="px-4 py-3.5 text-right">Stock Cost Value</th>
                <th className="px-4 py-3.5 text-right">Potential Profit</th>
                <th className="px-4 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                    No cosmetic products match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const unitProfit = p.sellingPrice - p.purchasePrice;
                  const marginPct = p.sellingPrice > 0 ? (unitProfit / p.sellingPrice) * 100 : 0;
                  const isLow = p.currentStock <= p.minStockLevel;
                  const totalProfitLocked = unitProfit * p.currentStock;
                  const supplier = suppliers.find((s) => s.id === p.supplierId);

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition group"
                    >
                      {/* Product Thumbnail Photo */}
                      <td className="px-3 py-2.5 text-center">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto shadow-2xs group-hover:scale-105 transition">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Fallback icon on image load failure
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </td>

                      {/* Product Name & Brand */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {p.name}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span className="font-medium text-pink-600 dark:text-pink-400">{p.brand}</span>
                          {supplier && <span>• Supp: {supplier.name.slice(0, 18)}...</span>}
                          {p.location && <span className="text-slate-400">[{p.location}]</span>}
                        </div>
                      </td>

                      {/* Barcode */}
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {p.barcode}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          {p.category}
                        </span>
                      </td>

                      {/* Cost Price */}
                      <td className="px-4 py-3 text-right font-medium text-slate-800 dark:text-slate-200">
                        {formatINR(p.purchasePrice)}
                      </td>

                      {/* Selling Price */}
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                        {formatINR(p.sellingPrice)}
                      </td>

                      {/* Unit Profit */}
                      <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        +{formatINR(unitProfit)}
                      </td>

                      {/* Margin % */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full font-bold text-[11px] ${
                            marginPct >= 40
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400'
                              : marginPct >= 25
                              ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400'
                              : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {marginPct.toFixed(1)}%
                        </span>
                      </td>

                      {/* Current Stock */}
                      <td className="px-4 py-3 text-center">
                        <div
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-bold text-xs ${
                            isLow
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-900'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {isLow && <AlertTriangle className="w-3 h-3 text-rose-500" />}
                          {p.currentStock} units
                        </div>
                        {isLow && (
                          <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5">
                            Min: {p.minStockLevel}
                          </div>
                        )}
                      </td>

                      {/* Stock Cost Value */}
                      <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                        {formatINR(p.purchasePrice * p.currentStock)}
                      </td>

                      {/* Total Potential Profit */}
                      <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatINR(totalProfitLocked)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isLow && (
                            <button
                              onClick={() => handleInitiateQuickReorder(p)}
                              title="Quick Reorder from Supplier"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-pink-50 dark:bg-pink-950/60 hover:bg-pink-100 dark:hover:bg-pink-900/60 text-pink-700 dark:text-pink-300 font-semibold text-[11px] border border-pink-200 dark:border-pink-800 transition cursor-pointer"
                            >
                              <ShoppingBag className="w-3 h-3 text-pink-500" />
                              <span className="hidden sm:inline">Reorder</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditModal(p)}
                            title="Edit Product"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setProductToDelete(p)}
                            title="Delete SKU"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <h3 className="text-lg font-bold">
              {editingProduct ? 'Edit Cosmetic SKU & Pricing' : 'Add New Cosmetic Stock Item'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter product details, barcode, purchase cost, and selling price for margin tracking.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Barcode */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Barcode / EAN-13 Code *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      placeholder="e.g. 8901030784912"
                      className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-mono focus:border-pink-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          barcode: `890${Math.floor(1000000000 + Math.random() * 9000000000)}`,
                        })
                      }
                      className="px-2.5 py-1 text-[11px] font-medium rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition"
                    >
                      Gen Code
                    </button>
                  </div>
                </div>

                {/* Brand Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Beauty Brand *
                  </label>
                  <input
                    type="text"
                    required
                    list="brand-suggestions"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="e.g. Maybelline, M.A.C, Huda Beauty"
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden"
                  />
                  <datalist id="brand-suggestions">
                    <option value="Maybelline New York" />
                    <option value="M.A.C" />
                    <option value="L'Oréal Paris" />
                    <option value="Huda Beauty" />
                    <option value="Rare Beauty" />
                    <option value="COSRX" />
                    <option value="Laneige" />
                    <option value="Lakmé" />
                    <option value="Forest Essentials" />
                    <option value="Fenty Beauty" />
                    <option value="Nykaa" />
                  </datalist>
                </div>

                {/* Product Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Product Title / Shade / Volume *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. SuperStay Matte Ink Liquid Lipstick (Pioneer 20 - 5ml)"
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as Product['category'] })
                    }
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden"
                  >
                    <option value="Makeup">Makeup</option>
                    <option value="Skincare">Skincare</option>
                    <option value="Haircare">Haircare</option>
                    <option value="Fragrance">Fragrance</option>
                    <option value="Bath & Body">Bath & Body</option>
                    <option value="Tools & Brushes">Tools & Brushes</option>
                    <option value="Nail Care">Nail Care</option>
                  </select>
                </div>

                {/* Supplier Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Supplier / Source Party
                  </label>
                  <select
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Purchase Cost (Buy Price) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Purchase Price / Buy Cost (₹) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.purchasePrice}
                    onChange={(e) =>
                      setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden font-mono"
                  />
                </div>

                {/* Selling Price (MRP) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Selling Price / MRP (₹) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.sellingPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden font-mono"
                  />
                </div>

                {/* Real-time Margin Preview */}
                <div className="sm:col-span-2 p-3 rounded-xl bg-pink-50 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-900/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                    <span className="text-xs font-semibold text-pink-950 dark:text-pink-200">
                      Margin Real-Time Calculator:
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span>
                      Unit Profit:{' '}
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        {formatINR(formData.sellingPrice - formData.purchasePrice)}
                      </strong>
                    </span>
                    <span>
                      Profit Margin:{' '}
                      <strong className="text-pink-600 dark:text-pink-400">
                        {formData.sellingPrice > 0
                          ? `${(
                              ((formData.sellingPrice - formData.purchasePrice) /
                                formData.sellingPrice) *
                              100
                            ).toFixed(1)}%`
                          : '0%'}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Current Stock */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Current Stock Quantity *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.currentStock}
                    onChange={(e) =>
                      setFormData({ ...formData, currentStock: parseInt(e.target.value) || 0 })
                    }
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden"
                  />
                </div>

                {/* Minimum Stock Alert Level */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Min Stock Threshold Alert
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.minStockLevel}
                    onChange={(e) =>
                      setFormData({ ...formData, minStockLevel: parseInt(e.target.value) || 1 })
                    }
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden"
                  />
                </div>

                {/* Batch & Expiry */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Batch Number
                  </label>
                  <input
                    type="text"
                    value={formData.batchNumber}
                    onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                    placeholder="e.g. MB-2025-08"
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden"
                  />
                </div>

                {/* Cosmetic Product Thumbnail Image */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Product Image (Photo URL or Upload File)
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                      {formData.imageUrl ? (
                        <img
                          src={formData.imageUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      <input
                        type="url"
                        value={formData.imageUrl}
                        onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                        placeholder="Paste image URL (https://...)"
                        className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs focus:border-pink-500 focus:outline-hidden"
                      />
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium cursor-pointer transition">
                          <Upload className="w-3.5 h-3.5 text-pink-500" />
                          <span>Upload Local Photo (Base64)</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  if (event.target?.result) {
                                    setFormData({ ...formData, imageUrl: event.target.result as string });
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        {formData.imageUrl && (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, imageUrl: '' })}
                            className="text-xs text-rose-500 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white text-xs font-semibold shadow-md hover:brightness-110 transition cursor-pointer"
                >
                  {editingProduct ? 'Save Changes' : 'Add to Stock Master'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Quick Reorder Purchase Order Draft Confirmation Modal */}
      {reorderProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-pink-100 dark:bg-pink-950 text-pink-600 dark:text-pink-400">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Quick Reorder Draft</h3>
                  <p className="text-xs text-slate-500">Generate Supplier Purchase Bill</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReorderProduct(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmQuickReorder} className="space-y-4 mt-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-pink-600 dark:text-pink-400">{reorderProduct.brand}</span>
                  <span className="text-[11px] text-slate-500">Barcode: {reorderProduct.barcode}</span>
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{reorderProduct.name}</h4>
                <div className="flex items-center justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-200/60 dark:border-slate-800">
                  <span>Current In-Stock: <strong className={reorderProduct.currentStock <= 0 ? 'text-rose-600' : 'text-amber-600'}>{reorderProduct.currentStock} units</strong></span>
                  <span>Min Threshold: <strong>{reorderProduct.minStockLevel} units</strong></span>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">
                  Default Assigned Supplier
                </label>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium">
                  {suppliers.find((s) => s.id === reorderProduct.supplierId)?.name || suppliers[0]?.name || 'Unknown Supplier'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">
                    Reorder Quantity (Units)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={reorderQty}
                    onChange={(e) => setReorderQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">
                    Unit Purchase Price (Cost)
                  </label>
                  <div className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-sm">
                    {formatINR(reorderProduct.purchasePrice)}
                  </div>
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 block">
                    Total Purchase Bill Amount:
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    Will be recorded under supplier ledger
                  </span>
                </div>
                <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                  {formatINR(reorderProduct.purchasePrice * (Number(reorderQty) || 0))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReorderProduct(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-bold shadow-md hover:brightness-110"
                >
                  Confirm & Post Draft Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base">Remove Cosmetic Product?</h3>
                <p className="text-xs text-slate-500">Confirm product removal from inventory</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
              Are you sure you want to remove <span className="font-bold text-slate-900 dark:text-white">"{productToDelete.name}"</span> ({productToDelete.brand} - {productToDelete.barcode})?
              {productToDelete.currentStock > 0 && (
                <span className="block mt-1 font-semibold text-rose-600">
                  Note: You currently have {productToDelete.currentStock} units in stock.
                </span>
              )}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteProduct(productToDelete.id);
                  setProductToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md transition cursor-pointer"
              >
                Yes, Delete Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk CSV Import Modal */}
      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        suppliers={suppliers}
        onImportProducts={(importedProducts) => {
          if (onImportBulkProducts) {
            onImportBulkProducts(importedProducts);
          } else {
            importedProducts.forEach((p) => onAddProduct(p));
          }
        }}
      />
    </div>
  );
};
