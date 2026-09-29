/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Package, Building2, ShoppingCart, BarChart3, Scan, Plus,
  Menu, X, Sparkles, RefreshCw, Sun, Moon, CheckCircle2, ChevronRight,
  TrendingUp, Download, Smartphone, Layers, Search, Database, FileSpreadsheet
} from 'lucide-react';

import { Product, SupplierParty, SupplierTransaction, SaleInvoice } from './types';
import { INITIAL_PRODUCTS, INITIAL_SUPPLIERS, INITIAL_TRANSACTIONS, INITIAL_SALES } from './mockData';
import { 
  ensureFirebaseAuth, 
  subscribeToProducts, 
  subscribeToSuppliers, 
  subscribeToTransactions, 
  subscribeToSales,
  cloudSaveProduct,
  cloudDeleteProduct,
  cloudSaveSupplier,
  cloudDeleteSupplier,
  cloudSaveTransaction,
  cloudDeleteTransaction,
  cloudClearTransactions,
  cloudSaveSale,
  cloudDeleteSale,
  cloudClearSales,
  seedInitialCatalogIfEmpty,
  cloudRestoreDatabase,
  testConnection
} from './firebase';
import { StockMaster } from './components/StockMaster';
import { SupplierLedger } from './components/SupplierLedger';
import { BillingPOS } from './components/BillingPOS';
import { AnalyticsReporting } from './components/AnalyticsReporting';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { SyncDeviceModal } from './components/SyncDeviceModal';
import { DataBackupExportModal } from './components/DataBackupExportModal';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { OfflineIndicator } from './components/OfflineIndicator';
import { formatINR } from './pdfUtils';

export default function App() {
  // Navigation View State
  const [activeTab, setActiveTab] = useState<'stock' | 'suppliers' | 'pos' | 'analytics'>('stock');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [lastAutoSavedTime, setLastAutoSavedTime] = useState<string | null>(null);
  const [autoSaveNotification, setAutoSaveNotification] = useState(false);
  const [scannedResult, setScannedResult] = useState<{ code: string; product?: Product } | null>(null);
  const [isCloudConnected, setIsCloudConnected] = useState(false);

  // Application Master Data States (Loaded with Auto-Save from LocalStorage)
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('luxecosmetics_products');
      return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
    } catch {
      return INITIAL_PRODUCTS;
    }
  });

  const [suppliers, setSuppliers] = useState<SupplierParty[]>(() => {
    try {
      const wiped = localStorage.getItem('luxecosmetics_sell_purchase_wiped_v3');
      const saved = localStorage.getItem('luxecosmetics_suppliers');
      const list: SupplierParty[] = saved ? JSON.parse(saved) : INITIAL_SUPPLIERS;
      if (!wiped) {
        return list.map((s) => ({ ...s, balance: 0, openingBalance: 0 }));
      }
      return list;
    } catch {
      return INITIAL_SUPPLIERS;
    }
  });

  const [transactions, setTransactions] = useState<SupplierTransaction[]>(() => {
    try {
      const wiped = localStorage.getItem('luxecosmetics_sell_purchase_wiped_v3');
      if (!wiped) {
        localStorage.setItem('luxecosmetics_transactions', JSON.stringify([]));
        return [];
      }
      const saved = localStorage.getItem('luxecosmetics_transactions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [sales, setSales] = useState<SaleInvoice[]>(() => {
    try {
      const wiped = localStorage.getItem('luxecosmetics_sell_purchase_wiped_v3');
      if (!wiped) {
        localStorage.setItem('luxecosmetics_sales', JSON.stringify([]));
        localStorage.setItem('luxecosmetics_sell_purchase_wiped_v3', 'true');
        return [];
      }
      const saved = localStorage.getItem('luxecosmetics_sales');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Connect to Firebase and listen to Live Real-Time Multi-Device updates across family
  useEffect(() => {
    let un製品: (() => void) | undefined;
    let unSupp: (() => void) | undefined;
    let unTx: (() => void) | undefined;
    let unSale: (() => void) | undefined;

    const setupFirebaseSync = async () => {
      try {
        setIsCloudConnected(true);

        // Real-time live listener for products across all devices
        un製品 = subscribeToProducts((liveProds) => {
          if (liveProds && liveProds.length > 0) {
            setProducts(liveProds);
          }
        });

        // Real-time live listener for suppliers across all devices
        unSupp = subscribeToSuppliers((liveSups) => {
          if (liveSups && liveSups.length > 0) {
            setSuppliers(liveSups);
          }
        });

        // Real-time live listener for transactions across all devices
        unTx = subscribeToTransactions((liveTxns) => {
          setTransactions(liveTxns || []);
        });

        // Real-time live listener for sales invoices across all devices
        unSale = subscribeToSales((liveSales) => {
          setSales(liveSales || []);
        });

        // Ensure cloud is seeded with existing catalog if cloud collection is fresh
        await testConnection();
        await seedInitialCatalogIfEmpty(products, suppliers);
      } catch (err) {
        console.warn('Real-time sync setup warning:', err);
      }
    };

    setupFirebaseSync();

    return () => {
      if (un製品) un製品();
      if (unSupp) unSupp();
      if (unTx) unTx();
      if (unSale) unSale();
    };
  }, []);

  // Real-Time Auto-Save effect across changes
  useEffect(() => {
    try {
      localStorage.setItem('luxecosmetics_products', JSON.stringify(products));
      localStorage.setItem('luxecosmetics_suppliers', JSON.stringify(suppliers));
      localStorage.setItem('luxecosmetics_transactions', JSON.stringify(transactions));
      localStorage.setItem('luxecosmetics_sales', JSON.stringify(sales));

      const timeStr = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastAutoSavedTime(timeStr);

      // Trigger subtle pulse indicator
      setAutoSaveNotification(true);
      const timer = setTimeout(() => setAutoSaveNotification(false), 2000);
      return () => clearTimeout(timer);
    } catch (e) {
      console.warn('Auto save error:', e);
    }
  }, [products, suppliers, transactions, sales]);

  // Sync listener across multi tabs or windows
  useEffect(() => {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('luxecosmetics_sync_channel');
      channel.onmessage = (event) => {
        if (event.data?.type === 'SYNC_UPDATE' && event.data?.data) {
          const payload = event.data.data;
          if (payload.products) setProducts(payload.products);
          if (payload.suppliers) setSuppliers(payload.suppliers);
          if (payload.transactions) setTransactions(payload.transactions);
          if (payload.sales) setSales(payload.sales);
          setLastAutoSavedTime(new Date().toLocaleTimeString());
        }
      };
      return () => channel.close();
    }
  }, []);

  // Stock Master Handlers
  const handleAddProduct = (prodData: Omit<Product, 'id' | 'lastUpdated'>) => {
    const newProduct: Product = {
      ...prodData,
      id: `prod-${Date.now()}`,
      lastUpdated: new Date().toISOString().slice(0, 10),
    };
    setProducts((prev) => [newProduct, ...prev]);
    cloudSaveProduct(newProduct).catch((e) => console.warn('Cloud save product:', e));
  };

  const handleImportBulkProducts = (prodsData: Omit<Product, 'id' | 'lastUpdated'>[]) => {
    const timestamp = Date.now();
    const newProducts: Product[] = prodsData.map((p, idx) => ({
      ...p,
      id: `prod-${timestamp}-${idx}`,
      lastUpdated: new Date().toISOString().slice(0, 10),
    }));
    setProducts((prev) => [...newProducts, ...prev]);
    newProducts.forEach((p) => cloudSaveProduct(p).catch((e) => console.warn('Cloud save bulk:', e)));
  };

  const handleUpdateProduct = (updated: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    cloudSaveProduct(updated).catch((e) => console.warn('Cloud update product:', e));
  };

  const handleDeleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    cloudDeleteProduct(id).catch((e) => console.warn('Cloud delete product:', e));
  };

  // Supplier Party & Ledger Handlers
  const handleAddSupplier = (
    supData: Omit<SupplierParty, 'id' | 'balance' | 'createdAt'>
  ) => {
    const newSup: SupplierParty = {
      ...supData,
      id: `supp-${Date.now()}`,
      balance: supData.openingBalance || 0,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setSuppliers((prev) => [...prev, newSup]);
    cloudSaveSupplier(newSup).catch((e) => console.warn('Cloud save supplier:', e));
  };

  const handleUpdateSupplier = (updated: SupplierParty) => {
    setSuppliers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    cloudSaveSupplier(updated).catch((e) => console.warn('Cloud update supplier:', e));
  };

  const handleDeleteSupplier = (id: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    cloudDeleteSupplier(id).catch((e) => console.warn('Cloud delete supplier:', e));
  };

  const handleAddTransaction = (txnData: Omit<SupplierTransaction, 'id'>) => {
    const newTxn: SupplierTransaction = {
      ...txnData,
      id: `tx-${Date.now()}`,
    };

    setTransactions((prev) => [newTxn, ...prev]);
    cloudSaveTransaction(newTxn).catch((e) => console.warn('Cloud save transaction:', e));

    // Recalculate supplier balance
    setSuppliers((prev) =>
      prev.map((s) => {
        if (s.id === txnData.supplierId) {
          // If CREDIT (Purchase Bill) -> We owe them more (+amount)
          // If DEBIT (Payment Paid) -> We paid them, decreases debt (-amount)
          const delta = txnData.direction === 'CREDIT' ? txnData.amount : -txnData.amount;
          const updated = {
            ...s,
            balance: s.balance + delta,
          };
          cloudSaveSupplier(updated).catch((e) => console.warn('Cloud update supplier balance:', e));
          return updated;
        }
        return s;
      })
    );
  };

  const handleDeleteTransaction = (id: string) => {
    const txnToDelete = transactions.find((t) => t.id === id);
    if (!txnToDelete) return;

    setTransactions((prev) => prev.filter((t) => t.id !== id));
    cloudDeleteTransaction(id).catch((e) => console.warn('Cloud delete transaction:', e));

    setSuppliers((prev) =>
      prev.map((s) => {
        if (s.id === txnToDelete.supplierId) {
          const delta = txnToDelete.direction === 'CREDIT' ? -txnToDelete.amount : txnToDelete.amount;
          const updated = {
            ...s,
            balance: s.balance + delta,
          };
          cloudSaveSupplier(updated).catch((e) => console.warn('Cloud update supplier balance:', e));
          return updated;
        }
        return s;
      })
    );
  };

  const handleClearAllTransactions = () => {
    setTransactions([]);
    cloudClearTransactions().catch((e) => console.warn('Cloud clear transactions:', e));
    setSuppliers((prev) => {
      const resetList = prev.map((s) => ({ ...s, balance: 0, openingBalance: 0 }));
      resetList.forEach((s) => cloudSaveSupplier(s).catch(console.error));
      return resetList;
    });
  };

  // Point of Sale / Customer Bill Complete Handler
  const handleCompleteSale = (sale: SaleInvoice) => {
    setSales((prev) => [sale, ...prev]);
    cloudSaveSale(sale).catch((e) => console.warn('Cloud save sale:', e));

    // Deduct stock quantity in real-time across all family devices
    setProducts((prev) =>
      prev.map((p) => {
        const itemSold = sale.items.find((item) => item.productId === p.id);
        if (itemSold) {
          const updatedStock = Math.max(0, p.currentStock - itemSold.qty);
          const updated = {
            ...p,
            currentStock: updatedStock,
            lastUpdated: new Date().toISOString().slice(0, 10),
          };
          cloudSaveProduct(updated).catch((e) => console.warn('Cloud deduct stock:', e));
          return updated;
        }
        return p;
      })
    );
  };

  const handleUpdateSale = (updatedSale: SaleInvoice) => {
    setSales((prev) => prev.map((s) => (s.id === updatedSale.id ? updatedSale : s)));
    cloudSaveSale(updatedSale).catch((e) => console.warn('Cloud update sale:', e));
  };

  const handleDeleteSale = (id: string) => {
    setSales((prev) => prev.filter((s) => s.id !== id));
    cloudDeleteSale(id).catch((e) => console.warn('Cloud delete sale:', e));
  };

  const handleClearAllSales = () => {
    setSales([]);
    cloudClearSales().catch((e) => console.warn('Cloud clear sales:', e));
  };

  // Barcode Scan Handler
  const handleScanBarcodeSuccess = (scannedCode: string) => {
    const foundProduct = products.find((p) => p.barcode === scannedCode);
    setScannedResult({ code: scannedCode, product: foundProduct });
  };

  const handleRestoreDatabase = (imported: {
    products: Product[];
    suppliers: SupplierParty[];
    transactions: SupplierTransaction[];
    sales: SaleInvoice[];
  }) => {
    setProducts(imported.products);
    setSuppliers(imported.suppliers);
    setTransactions(imported.transactions);
    setSales(imported.sales);
    cloudRestoreDatabase(imported).catch((e) => console.warn('Cloud restore database:', e));
  };

  const totalPayables = suppliers.reduce((acc, s) => acc + (s.balance > 0 ? s.balance : 0), 0);
  const lowStockCount = products.filter((p) => p.currentStock <= p.minStockLevel).length;

  // Navigation Items
  const navItems = [
    {
      id: 'stock' as const,
      label: 'Stock Master',
      subtext: 'P&L Margin & Inventory',
      icon: Package,
      badge: `${products.length} SKUs`,
      alertCount: lowStockCount,
    },
    {
      id: 'suppliers' as const,
      label: 'Party Ledger & Bills',
      subtext: 'Debit/Credit & Supplier Statements',
      icon: Building2,
      badge: `${suppliers.length} Parties`,
    },
    {
      id: 'pos' as const,
      label: 'Billing & POS',
      subtext: 'Party Bills & PDF Export',
      icon: ShoppingCart,
      badge: 'Auto-Bill',
    },
    {
      id: 'analytics' as const,
      label: 'Analytics & Monthly P&L',
      subtext: 'Financial Reporting & Margins',
      icon: BarChart3,
      badge: 'Reports',
    },
  ];

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} flex transition-colors duration-200`}>
      {/* Sidebar Navigation (Desktop) */}
      <aside
        className={`hidden md:flex flex-col border-r transition-all duration-300 z-30 shrink-0 ${
          isSidebarOpen ? 'w-64' : 'w-20'
        } ${isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 via-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-pink-500/20 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            {isSidebarOpen && (
              <div className="truncate">
                <h1 className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
                  BEAUTY BRANDS
                </h1>
                <p className="text-[10px] font-medium text-pink-600 dark:text-pink-400 uppercase tracking-wider">
                  Stock Master & Ledger
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Barcode Scan Button in Sidebar */}
        <div className="p-3">
          <button
            onClick={() => setIsScannerOpen(true)}
            className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-semibold text-xs shadow-md hover:brightness-110 transition cursor-pointer ${
              !isSidebarOpen ? 'px-0' : ''
            }`}
            title="Scan Barcode via Camera"
          >
            <Scan className="w-4 h-4 shrink-0" />
            {isSidebarOpen && <span>Scan Barcode / SKU</span>}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const hasAlert = item.id === 'stock' && lowStockCount > 0;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left cursor-pointer group relative ${
                  isActive
                    ? 'bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 font-bold border border-pink-200 dark:border-pink-900/60 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium'
                }`}
              >
                <div className="relative shrink-0">
                  <div className={`p-1.5 rounded-lg ${
                    isActive ? 'bg-pink-600 text-white' : 'text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {/* Collapsed view alert dot indicator */}
                  {!isSidebarOpen && hasAlert && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border-2 border-white dark:border-slate-900"></span>
                    </span>
                  )}
                </div>

                {isSidebarOpen && (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs truncate">{item.label}</span>
                      <div className="flex items-center gap-1.5">
                        {hasAlert && (
                          <span
                            title={`${lowStockCount} product(s) below minimum stock level`}
                            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 animate-pulse"
                          >
                            {lowStockCount} low
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                          {item.badge}
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal truncate">
                      {item.subtext}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Auto-Save & Synchronization Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          {isSidebarOpen && (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-[11px] space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Auto-Save Active
                </span>
                <span className="font-mono text-[10px]">{lastAutoSavedTime}</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Mobile & desktop cross-session sync enabled
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-1.5">
            <button
              onClick={() => setIsSyncModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-pink-500 shrink-0" />
              {isSidebarOpen && <span>Mobile Sync</span>}
            </button>

            <button
              onClick={() => setIsBackupModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium border border-indigo-200 dark:border-indigo-900/60 transition cursor-pointer"
              title="Export database backup (JSON or CSV)"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              {isSidebarOpen && <span>Export JSON / CSV</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 px-4 sm:px-6 border-b flex items-center justify-between gap-4 sticky top-0 z-20 backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white capitalize flex items-center gap-2">
                {activeTab === 'stock' && 'Cosmetic Stock Master & P/L Margins'}
                {activeTab === 'suppliers' && 'Party-Wise Debit & Credit Ledger'}
                {activeTab === 'pos' && 'Billing Counter & Invoice PDF'}
                {activeTab === 'analytics' && 'Inventory Analytics & Financial Report'}
              </h2>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Beauty brands stock master with profit and loss margin tracking
              </p>
            </div>
          </div>

          {/* Global Header Search Input */}
          <div className="flex-1 max-w-md mx-2 sm:mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder={
                  activeTab === 'stock'
                    ? 'Search SKUs, cosmetics, brands (M.A.C, Huda), barcodes...'
                    : activeTab === 'suppliers'
                    ? 'Search suppliers, distributors, or brands...'
                    : activeTab === 'pos'
                    ? 'Search products, invoices, or customer...'
                    : 'Filter analytics by brand or cosmetic...'
                }
                className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-pink-500 focus:ring-1 focus:ring-pink-500/30 transition shadow-2xs"
              />
              {globalSearch && (
                <button
                  onClick={() => setGlobalSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Header Indicators */}
          <div className="flex items-center gap-3">
            {/* Live Multi-Device Family Sync Status */}
            <div 
              className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${
                isCloudConnected
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
              }`}
              title={isCloudConnected ? "Real-time Cloud Sync active across all family devices" : "Connecting to Cloud..."}
            >
              <span className={`w-2 h-2 rounded-full ${isCloudConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>{isCloudConnected ? 'Family Live Cloud' : 'Connecting...'}</span>
            </div>

            {/* Auto-save notification pulse */}
            {autoSaveNotification && (
              <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3 h-3" /> Auto-saved
              </span>
            )}

            {/* Quick Multi-Device / Mobile QR Code Button */}
            <button
              onClick={() => setIsSyncModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-xs font-semibold border border-indigo-200 dark:border-indigo-900 transition cursor-pointer"
              title="Open on Mobile, Tablet or other PC via QR Code"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open on Mobile</span>
            </button>

            {/* Quick Barcode Scanner button on header for mobile & quick access */}
            <button
              onClick={() => setIsScannerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 hover:bg-pink-100 text-xs font-semibold border border-pink-200 dark:border-pink-900 transition cursor-pointer"
            >
              <Scan className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Scan / Barcode</span>
            </button>

            {/* PWA Install Button for iOS, Android, and Desktop OS */}
            <PWAInstallPrompt />

            {/* Export / Backup Database Button */}
            <button
              onClick={() => setIsBackupModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 transition cursor-pointer"
              title="Export complete application state as JSON or CSV"
            >
              <Download className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden md:inline">Export Data</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const hasAlert = item.id === 'stock' && lowStockCount > 0;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold ${
                    activeTab === item.id
                      ? 'bg-pink-600 text-white'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasAlert && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                        {lowStockCount} low
                      </span>
                    )}
                    <span className="text-[10px] opacity-80">{item.badge}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Dashboard Main Content Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-28 md:pb-8">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'stock' && (
              <StockMaster
                products={products}
                suppliers={suppliers}
                onAddProduct={handleAddProduct}
                onImportBulkProducts={handleImportBulkProducts}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
                onOpenScanner={() => setIsScannerOpen(true)}
                onAddTransaction={handleAddTransaction}
                onNavigateToTab={(tab) => setActiveTab(tab)}
                globalSearch={globalSearch}
                onUpdateGlobalSearch={setGlobalSearch}
              />
            )}

            {activeTab === 'suppliers' && (
              <SupplierLedger
                suppliers={suppliers}
                transactions={transactions}
                products={products}
                onAddSupplier={handleAddSupplier}
                onUpdateSupplier={handleUpdateSupplier}
                onDeleteSupplier={handleDeleteSupplier}
                onAddTransaction={handleAddTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onClearAllTransactions={handleClearAllTransactions}
                globalSearch={globalSearch}
                onUpdateGlobalSearch={setGlobalSearch}
              />
            )}

            {activeTab === 'pos' && (
              <BillingPOS
                products={products}
                sales={sales}
                onCompleteSale={handleCompleteSale}
                onUpdateSale={handleUpdateSale}
                onDeleteSale={handleDeleteSale}
                onClearAllSales={handleClearAllSales}
                onOpenScanner={() => setIsScannerOpen(true)}
                globalSearch={globalSearch}
                onUpdateGlobalSearch={setGlobalSearch}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsReporting
                products={products}
                suppliers={suppliers}
                transactions={transactions}
                sales={sales}
                globalSearch={globalSearch}
                onUpdateGlobalSearch={setGlobalSearch}
              />
            )}
          </div>
        </main>

        {/* Native Mobile Bottom Navigation Dock (iOS & Android) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-around shadow-lg">
          <button
            onClick={() => setActiveTab('stock')}
            className={`flex flex-col items-center gap-1 p-1 rounded-xl text-[10px] font-semibold transition cursor-pointer ${
              activeTab === 'stock' ? 'text-pink-600 dark:text-pink-400 font-bold' : 'text-slate-500'
            }`}
          >
            <Package className="w-5 h-5" />
            <span>Stock</span>
          </button>

          <button
            onClick={() => setActiveTab('suppliers')}
            className={`flex flex-col items-center gap-1 p-1 rounded-xl text-[10px] font-semibold transition cursor-pointer ${
              activeTab === 'suppliers' ? 'text-pink-600 dark:text-pink-400 font-bold' : 'text-slate-500'
            }`}
          >
            <Building2 className="w-5 h-5" />
            <span>Parties</span>
          </button>

          {/* Center Elevated Barcode Scanner Action Button */}
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex flex-col items-center -mt-6 p-3 rounded-full bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-xl hover:scale-105 active:scale-95 transition cursor-pointer ring-4 ring-white dark:ring-slate-900"
            title="Scan Barcode"
          >
            <Scan className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveTab('pos')}
            className={`flex flex-col items-center gap-1 p-1 rounded-xl text-[10px] font-semibold transition cursor-pointer ${
              activeTab === 'pos' ? 'text-pink-600 dark:text-pink-400 font-bold' : 'text-slate-500'
            }`}
          >
            <ShoppingCart className="w-5 h-5" />
            <span>POS Bill</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex flex-col items-center gap-1 p-1 rounded-xl text-[10px] font-semibold transition cursor-pointer ${
              activeTab === 'analytics' ? 'text-pink-600 dark:text-pink-400 font-bold' : 'text-slate-500'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span>Reports</span>
          </button>
        </nav>
      </div>

      {/* Barcode / SKU Scanner Camera Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanBarcodeSuccess}
        knownBarcodes={products.map((p) => ({
          barcode: p.barcode,
          name: p.name,
          brand: p.brand,
        }))}
      />

      {/* Mobile Device Synchronization & Auto-Save Backup Modal */}
      <SyncDeviceModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        products={products}
        suppliers={suppliers}
        transactions={transactions}
        sales={sales}
        lastAutoSavedTime={lastAutoSavedTime}
        isCloudConnected={isCloudConnected}
        onRestoreData={handleRestoreDatabase}
      />

      {/* Complete Application State Export Modal (JSON & CSV) */}
      <DataBackupExportModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        products={products}
        suppliers={suppliers}
        transactions={transactions}
        sales={sales}
      />

      {/* Scanned Barcode Result Popover Modal */}
      {scannedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            {scannedResult.product ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400">
                      {scannedResult.product.brand} • {scannedResult.product.category}
                    </span>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      {scannedResult.product.name}
                    </h3>
                    <p className="font-mono text-xs text-slate-400">
                      Barcode: {scannedResult.product.barcode}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Cost Price</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {formatINR(scannedResult.product.purchasePrice)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Selling MRP</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formatINR(scannedResult.product.sellingPrice)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Current Stock</span>
                    <span className={`font-bold ${
                      scannedResult.product.currentStock <= scannedResult.product.minStockLevel
                        ? 'text-rose-600'
                        : 'text-emerald-600'
                    }`}>
                      {scannedResult.product.currentStock} units
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => {
                      setGlobalSearch(scannedResult.product!.barcode);
                      setActiveTab('pos');
                      setScannedResult(null);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md hover:brightness-110 transition cursor-pointer"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Open in Billing & POS</span>
                  </button>

                  <button
                    onClick={() => {
                      setGlobalSearch(scannedResult.product!.barcode);
                      setActiveTab('stock');
                      setScannedResult(null);
                    }}
                    className="w-full py-2 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Package className="w-4 h-4 text-pink-500" />
                    <span>View in Stock Master</span>
                  </button>

                  <button
                    onClick={() => setScannedResult(null)}
                    className="py-1.5 text-center text-xs text-slate-400 hover:text-slate-600 transition"
                  >
                    Done / Dismiss
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600">
                    <Scan className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      New Barcode Detected
                    </h3>
                    <p className="font-mono text-xs font-bold text-pink-600 dark:text-pink-400">
                      {scannedResult.code}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  This cosmetic SKU barcode is not in your database yet. Would you like to register this product now?
                </p>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => {
                      setGlobalSearch(scannedResult.code);
                      setActiveTab('stock');
                      setScannedResult(null);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md hover:brightness-110 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add New Product to Stock</span>
                  </button>

                  <button
                    onClick={() => setScannedResult(null)}
                    className="py-2 px-4 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Offline Status Connectivity Banner */}
      <OfflineIndicator />
    </div>
  );
}
