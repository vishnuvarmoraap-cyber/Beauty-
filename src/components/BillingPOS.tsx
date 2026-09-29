import React, { useState } from 'react';
import { Product, SaleInvoice, SaleItem } from '../types';
import { formatINR, exportSaleBillPDF } from '../pdfUtils';
import { 
  ShoppingCart, Scan, Plus, Trash2, Printer, Search, 
  CheckCircle, ArrowRight, User, Phone, Sparkles, Tag, DollarSign,
  AlertCircle, CreditCard, Clock, Check, ArrowDownLeft, X
} from 'lucide-react';

interface BillingPOSProps {
  products: Product[];
  sales: SaleInvoice[];
  onCompleteSale: (sale: SaleInvoice) => void;
  onUpdateSale?: (sale: SaleInvoice) => void;
  onDeleteSale?: (id: string) => void;
  onClearAllSales?: () => void;
  onOpenScanner: () => void;
  globalSearch?: string;
  onUpdateGlobalSearch?: (term: string) => void;
}

export const BillingPOS: React.FC<BillingPOSProps> = ({
  products,
  sales,
  onCompleteSale,
  onUpdateSale,
  onDeleteSale,
  onClearAllSales,
  onOpenScanner,
  globalSearch = '',
  onUpdateGlobalSearch,
}) => {
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Credit'>('UPI');
  const [cartItems, setCartItems] = useState<SaleItem[]>([]);
  const [localSearchSKU, setLocalSearchSKU] = useState('');
  const searchSKU = globalSearch !== '' ? globalSearch : localSearchSKU;
  const setSearchSKU = (val: string) => {
    setLocalSearchSKU(val);
    if (onUpdateGlobalSearch) {
      onUpdateGlobalSearch(val);
    }
  };
  const [discountOverall, setDiscountOverall] = useState(0); // discount amount in ₹
  const [activeTab, setActiveTab] = useState<'new_bill' | 'recent_invoices' | 'customer_pending'>('new_bill');
  const [bannerNotice, setBannerNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [confirmClearSales, setConfirmClearSales] = useState(false);

  // Receive Payment Modal for Customer Udhar
  const [paymentModalSale, setPaymentModalSale] = useState<SaleInvoice | null>(null);
  const [receiveAmount, setReceiveAmount] = useState<number>(0);
  const [receiveMode, setReceiveMode] = useState<string>('Cash');
  const [receiveNotes, setReceiveNotes] = useState<string>('');

  const showNotice = (text: string, type: 'error' | 'success' = 'error') => {
    setBannerNotice({ type, text });
    setTimeout(() => setBannerNotice(null), 3500);
  };

  // Filter products for quick add list
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchSKU.toLowerCase()) ||
      p.barcode.includes(searchSKU) ||
      p.brand.toLowerCase().includes(searchSKU.toLowerCase())
  );

  const addItemToCart = (prod: Product) => {
    if (prod.currentStock <= 0) {
      showNotice(`"${prod.name}" is currently OUT OF STOCK!`, 'error');
      return;
    }

    setCartItems((prev) => {
      const existing = prev.find((item) => item.productId === prod.id);
      if (existing) {
        if (existing.qty + 1 > prod.currentStock) {
          showNotice(`Cannot exceed available stock of ${prod.currentStock} units.`, 'error');
          return prev;
        }
        const updatedQty = existing.qty + 1;
        const total = updatedQty * existing.unitSellingPrice * (1 - existing.discountPercent / 100);
        const costTotal = updatedQty * existing.unitCostPrice;
        const profit = total - costTotal;

        return prev.map((item) =>
          item.productId === prod.id
            ? { ...item, qty: updatedQty, total, profit }
            : item
        );
      } else {
        const total = prod.sellingPrice;
        const profit = prod.sellingPrice - prod.purchasePrice;
        return [
          ...prev,
          {
            productId: prod.id,
            barcode: prod.barcode,
            productName: prod.name,
            brand: prod.brand,
            unitCostPrice: prod.purchasePrice,
            unitSellingPrice: prod.sellingPrice,
            qty: 1,
            discountPercent: 0,
            total,
            profit,
          },
        ];
      }
    });
  };

  const updateCartItemQty = (productId: string, newQty: number) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    if (newQty <= 0) {
      removeCartItem(productId);
      return;
    }

    if (newQty > prod.currentStock) {
      showNotice(`Available stock is only ${prod.currentStock} units.`, 'error');
      newQty = prod.currentStock;
    }

    setCartItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const total = newQty * item.unitSellingPrice * (1 - item.discountPercent / 100);
          const costTotal = newQty * item.unitCostPrice;
          const profit = total - costTotal;
          return { ...item, qty: newQty, total, profit };
        }
        return item;
      })
    );
  };

  const updateCartItemDiscount = (productId: string, discountPercent: number) => {
    const validDiscount = Math.min(100, Math.max(0, discountPercent));
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const total = item.qty * item.unitSellingPrice * (1 - validDiscount / 100);
          const costTotal = item.qty * item.unitCostPrice;
          const profit = total - costTotal;
          return { ...item, discountPercent: validDiscount, total, profit };
        }
        return item;
      })
    );
  };

  const removeCartItem = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Totals calculations
  const subtotal = cartItems.reduce((acc, item) => acc + item.unitSellingPrice * item.qty, 0);
  const itemsDiscount = cartItems.reduce(
    (acc, item) => acc + (item.unitSellingPrice * item.qty * item.discountPercent) / 100,
    0
  );
  const totalDiscount = itemsDiscount + discountOverall;
  const grandTotal = Math.max(0, subtotal - totalDiscount);
  const totalCost = cartItems.reduce((acc, item) => acc + item.unitCostPrice * item.qty, 0);
  const netProfit = grandTotal - totalCost;
  const marginPercent = grandTotal > 0 ? (netProfit / grandTotal) * 100 : 0;

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      showNotice('Cart is empty. Please add cosmetic products first.', 'error');
      return;
    }

    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const isCredit = paymentMethod === 'Credit';

    const newInvoice: SaleInvoice = {
      id: `sale-${Date.now()}`,
      invoiceNumber,
      date: new Date().toISOString().slice(0, 10),
      customerName: customerName || 'Walk-in Customer',
      customerPhone,
      paymentMethod,
      items: cartItems,
      subtotal,
      discountAmount: totalDiscount,
      taxAmount: 0,
      grandTotal,
      totalCost,
      netProfit,
      profitMarginPercent: marginPercent,
      amountPaid: isCredit ? 0 : grandTotal,
      balanceDue: isCredit ? grandTotal : 0,
      paymentHistory: isCredit ? [] : [
        {
          id: `pay-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          amount: grandTotal,
          mode: paymentMethod,
          notes: 'Full payment on bill checkout',
        }
      ],
    };

    onCompleteSale(newInvoice);

    // Prompt immediate PDF export
    exportSaleBillPDF(newInvoice);

    // Reset Cart
    setCartItems([]);
    setCustomerName('Walk-in Customer');
    setCustomerPhone('');
    setDiscountOverall(0);

    showNotice(`✓ Bill ${invoiceNumber} created successfully!`, 'success');
  };

  // Customer pending udhar list
  const pendingCustomerSales = sales.filter((s) => {
    const due = s.balanceDue !== undefined ? s.balanceDue : (s.paymentMethod === 'Credit' ? s.grandTotal : 0);
    return due > 0;
  });

  const totalCustomerPendingUdhar = pendingCustomerSales.reduce((acc, s) => {
    const due = s.balanceDue !== undefined ? s.balanceDue : (s.paymentMethod === 'Credit' ? s.grandTotal : 0);
    return acc + due;
  }, 0);

  const handleOpenReceivePayment = (sale: SaleInvoice) => {
    const currentDue = sale.balanceDue !== undefined ? sale.balanceDue : (sale.paymentMethod === 'Credit' ? sale.grandTotal : 0);
    setPaymentModalSale(sale);
    setReceiveAmount(currentDue);
    setReceiveMode('Cash');
    setReceiveNotes('');
  };

  const handleConfirmReceivePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalSale || !onUpdateSale || receiveAmount <= 0) return;

    const currentDue = paymentModalSale.balanceDue !== undefined ? paymentModalSale.balanceDue : (paymentModalSale.paymentMethod === 'Credit' ? paymentModalSale.grandTotal : 0);
    const paidSoFar = paymentModalSale.amountPaid || 0;
    const amountToApply = Math.min(receiveAmount, currentDue);
    const newPaid = paidSoFar + amountToApply;
    const newDue = Math.max(0, currentDue - amountToApply);

    const newPaymentRecord = {
      id: `cpay-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      amount: amountToApply,
      mode: receiveMode,
      notes: receiveNotes || `Payment received from customer via ${receiveMode}`,
    };

    const updatedSale: SaleInvoice = {
      ...paymentModalSale,
      amountPaid: newPaid,
      balanceDue: newDue,
      paymentHistory: [...(paymentModalSale.paymentHistory || []), newPaymentRecord],
    };

    onUpdateSale(updatedSale);
    setPaymentModalSale(null);
    showNotice(`✓ Received payment of ${formatINR(amountToApply)} from ${updatedSale.customerName}!`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* In-App Notice Banner */}
      {bannerNotice && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-xs transition-all ${
            bannerNotice.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerNotice.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{bannerNotice.text}</span>
          </div>
          <button
            onClick={() => setBannerNotice(null)}
            className="p-1 rounded-md hover:bg-black/10 transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('new_bill')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'new_bill'
              ? 'bg-pink-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShoppingCart className="w-4 h-4" /> Point of Sale (New Bill)
        </button>
        <button
          onClick={() => setActiveTab('recent_invoices')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'recent_invoices'
              ? 'bg-pink-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Printer className="w-4 h-4" /> Party Invoices & PDF ({sales.length})
        </button>
        <button
          onClick={() => setActiveTab('customer_pending')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'customer_pending'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4 text-rose-500" />
          <span>Customer Pending Udhar (Debit/Credit)</span>
          {pendingCustomerSales.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 font-bold">
              {pendingCustomerSales.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'new_bill' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Product Catalog & Quick Add */}
          <div className="lg:col-span-7 space-y-4">
            {/* Search & Barcode Scan Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Type product name, brand, or barcode..."
                  value={searchSKU}
                  onChange={(e) => setSearchSKU(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-pink-500 shadow-xs"
                />
              </div>
              <button
                onClick={onOpenScanner}
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-900 text-xs font-semibold hover:bg-pink-100 transition cursor-pointer"
              >
                <Scan className="w-4 h-4" /> Scan Camera
              </button>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[580px] overflow-y-auto pr-1">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.currentStock <= 0;
                const unitMargin = p.sellingPrice > 0 ? ((p.sellingPrice - p.purchasePrice) / p.sellingPrice) * 100 : 0;

                return (
                  <div
                    key={p.id}
                    onClick={() => !isOutOfStock && addItemToCart(p)}
                    className={`p-3 rounded-xl border transition flex flex-col justify-between ${
                      isOutOfStock
                        ? 'opacity-50 bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-pink-500 hover:shadow-xs cursor-pointer'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400">
                          {p.brand}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            isOutOfStock
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-600'
                              : p.currentStock <= p.minStockLevel
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700'
                              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700'
                          }`}
                        >
                          {p.currentStock} in stock
                        </span>
                      </div>
                      <h4 className="font-semibold text-xs text-slate-900 dark:text-white mt-1 line-clamp-1">
                        {p.name}
                      </h4>
                      <p className="font-mono text-[10px] text-slate-400 mt-0.5">{p.barcode}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white">
                          {formatINR(p.sellingPrice)}
                        </div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          {unitMargin.toFixed(0)}% margin
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isOutOfStock}
                        className="p-1.5 rounded-lg bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 hover:bg-pink-600 hover:text-white transition disabled:opacity-30 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Customer Details, Cart, Totals & Checkout */}
          <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              {/* Customer Info Header */}
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                    <User className="w-4 h-4 text-pink-500" /> Customer & Billing Info
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date().toLocaleDateString('en-IN')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs focus:border-pink-500 focus:outline-hidden"
                  />
                  <input
                    type="tel"
                    placeholder="Mobile / Phone (Optional)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs focus:border-pink-500 focus:outline-hidden"
                  />
                </div>

                {/* Payment Mode Selector including Credit / Pending Payment */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Payment Mode / Terms
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 text-xs">
                    {(['UPI', 'Cash', 'Card', 'Credit'] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`py-1.5 px-2 rounded-lg font-semibold text-center transition cursor-pointer ${
                          paymentMethod === method
                            ? method === 'Credit'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-pink-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {method === 'Credit' ? 'Udhar / Credit' : method}
                      </button>
                    ))}
                  </div>
                  {paymentMethod === 'Credit' && (
                    <p className="text-[11px] text-rose-500 font-medium mt-1">
                      ⚠️ Note: Will be logged as Customer Pending Udhar (Debit balance to collect).
                    </p>
                  )}
                </div>
              </div>

              {/* Cart Items List */}
              <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1">
                {cartItems.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                    Cart is empty. Tap cosmetic products from left or scan barcode.
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div
                      key={item.productId}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex-1 pr-2">
                        <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                          {item.productName}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {item.brand} • {formatINR(item.unitSellingPrice)} each
                        </div>
                      </div>

                      {/* Qty Controls */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateCartItemQty(item.productId, item.qty - 1)}
                          className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-7 text-center font-bold font-mono">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateCartItemQty(item.productId, item.qty + 1)}
                          className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      {/* Price & Delete */}
                      <div className="text-right pl-3">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {formatINR(item.total)}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.productId)}
                          className="text-rose-500 hover:text-rose-600 text-[10px] mt-0.5 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bill Summary & Complete Checkout Button */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span>Subtotal ({cartItems.reduce((acc, i) => acc + i.qty, 0)} items):</span>
                <span className="font-medium text-slate-900 dark:text-white">{formatINR(subtotal)}</span>
              </div>

              {/* Extra overall discount */}
              <div className="flex items-center justify-between text-slate-500">
                <span>Cash Discount (₹):</span>
                <input
                  type="number"
                  min="0"
                  value={discountOverall || ''}
                  onChange={(e) => setDiscountOverall(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-24 px-2 py-1 text-right rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs focus:border-pink-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-between text-slate-500">
                <span>Estimated Net Profit on this Bill:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  +{formatINR(netProfit)} ({marginPercent.toFixed(0)}%)
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-baseline justify-between">
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold">Grand Total:</span>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {formatINR(grandTotal)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={cartItems.length === 0}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-bold text-sm shadow-md hover:brightness-110 disabled:opacity-40 transition flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Generate Bill & PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Recent Invoices */}
      {activeTab === 'recent_invoices' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Cosmetic Sales Invoices ({sales.length})
            </h3>
            <div className="flex items-center gap-2">
              {onClearAllSales && sales.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmClearSales(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-900 text-xs font-semibold hover:bg-rose-100 transition cursor-pointer"
                  title="Delete all sales invoices"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete All Sales ({sales.length})</span>
                </button>
              )}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search invoice or customer..."
                  value={searchSKU}
                  onChange={(e) => setSearchSKU(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs focus:border-pink-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Party / Customer</th>
                  <th className="px-4 py-3">Items Sold</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3 text-right">Bill Total</th>
                  <th className="px-4 py-3 text-right">Net Profit</th>
                  <th className="px-4 py-3 text-center">Margin %</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No invoices recorded yet. Create a bill from POS tab.
                    </td>
                  </tr>
                ) : (
                  sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono font-semibold text-pink-600 dark:text-pink-400">
                        {sale.invoiceNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{sale.date}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {sale.customerName}
                        {sale.customerPhone && (
                          <div className="text-[10px] text-slate-400">{sale.customerPhone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {sale.items.length} items (
                        {sale.items.map((i) => `${i.productName.slice(0, 10)}.. x${i.qty}`).join(', ')}
                        )
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-md font-medium text-[11px] ${
                          sale.paymentMethod === 'Credit' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}>
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                        {formatINR(sale.grandTotal)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        +{formatINR(sale.netProfit)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                          {sale.profitMarginPercent.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => exportSaleBillPDF(sale)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-pink-50 dark:bg-pink-950/40 hover:bg-pink-100 text-pink-600 dark:text-pink-400 text-xs font-medium transition cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                          {onDeleteSale && (
                            <button
                              type="button"
                              onClick={() => onDeleteSale(sale.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition cursor-pointer"
                              title="Delete Sales Invoice"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Customer Pending Udhar / Debit & Credit Ledger */}
      {activeTab === 'customer_pending' && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                Total Customer Pending Udhar (Debit)
              </span>
              <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
                {formatINR(totalCustomerPendingUdhar)}
              </div>
              <p className="mt-1 text-xs text-slate-500">Across {pendingCustomerSales.length} customer credit accounts</p>
            </div>

            <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Payment Collected from Customers
              </span>
              <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatINR(
                  sales.reduce((acc, s) => acc + (s.amountPaid || (s.paymentMethod !== 'Credit' ? s.grandTotal : 0)), 0)
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">Settled via Cash, UPI & Card</p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Udhar Khata Actions
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Record customer payments when they pay back pending credit amount.
              </p>
            </div>
          </div>

          {/* Pending Table */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-500" /> Pending Customer Accounts / Udhar Ledger
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Bill Date</th>
                    <th className="px-4 py-3">Invoice #</th>
                    <th className="px-4 py-3">Customer Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3 text-right">Bill Total</th>
                    <th className="px-4 py-3 text-right">Received (Cr)</th>
                    <th className="px-4 py-3 text-right">Balance Due (Dr)</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pendingCustomerSales.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        No pending customer credit! All customer bills are fully paid.
                      </td>
                    </tr>
                  ) : (
                    pendingCustomerSales.map((sale) => {
                      const due = sale.balanceDue !== undefined ? sale.balanceDue : (sale.paymentMethod === 'Credit' ? sale.grandTotal : 0);
                      const paid = sale.amountPaid || 0;

                      return (
                        <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 text-slate-500">{sale.date}</td>
                          <td className="px-4 py-3 font-mono font-semibold text-pink-600 dark:text-pink-400">
                            {sale.invoiceNumber}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            {sale.customerName}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{sale.customerPhone || 'N/A'}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                            {formatINR(sale.grandTotal)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {formatINR(paid)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-rose-600 dark:text-rose-400">
                            {formatINR(due)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleOpenReceivePayment(sale)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                            >
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              <span>+ Receive Payment</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Receive Payment Modal */}
      {paymentModalSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Receive Customer Payment (Credit Entry)
              </h3>
              <button
                onClick={() => setPaymentModalSale(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Recording payment for {paymentModalSale.customerName} ({paymentModalSale.invoiceNumber})
            </p>

            <form onSubmit={handleConfirmReceivePayment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Amount Received (₹) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={receiveAmount || ''}
                  onChange={(e) => setReceiveAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-sm font-bold font-mono focus:border-pink-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Mode *
                </label>
                <select
                  value={receiveMode}
                  onChange={(e) => setReceiveMode(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="Card">Debit / Credit Card</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Transaction ID (Optional)
                </label>
                <input
                  type="text"
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  placeholder="e.g. Received via GPay UPI transaction"
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPaymentModalSale(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md transition cursor-pointer"
                >
                  Confirm & Update Khata
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Clear All Sales Invoices Modal */}
      {confirmClearSales && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base">Delete All Sales Invoices?</h3>
                <p className="text-xs text-slate-500">Reset bills and customer credit</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
              Are you sure you want to delete all <span className="font-bold text-slate-900 dark:text-white">{sales.length} sales invoices</span>?
              All customer sales history and pending customer credit records will be cleared. This cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearSales(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onClearAllSales) onClearAllSales();
                  setConfirmClearSales(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md transition cursor-pointer"
              >
                Yes, Delete All Sales
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
