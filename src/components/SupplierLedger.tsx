import React, { useState } from 'react';
import { SupplierParty, SupplierTransaction, Product } from '../types';
import { formatINR, exportSupplierLedgerPDF } from '../pdfUtils';
import { 
  Building2, Plus, ArrowUpRight, ArrowDownLeft, FileText, Phone, 
  Mail, MapPin, Receipt, Search, Download, DollarSign, Calendar, 
  CheckCircle2, Trash2, Edit3, AlertTriangle, X 
} from 'lucide-react';

interface SupplierLedgerProps {
  suppliers: SupplierParty[];
  transactions: SupplierTransaction[];
  products: Product[];
  onAddSupplier: (supplier: Omit<SupplierParty, 'id' | 'balance' | 'createdAt'>) => void;
  onUpdateSupplier?: (supplier: SupplierParty) => void;
  onDeleteSupplier?: (id: string) => void;
  onAddTransaction: (txn: Omit<SupplierTransaction, 'id'>) => void;
  onDeleteTransaction?: (id: string) => void;
  onClearAllTransactions?: () => void;
  globalSearch?: string;
  onUpdateGlobalSearch?: (term: string) => void;
}

export const SupplierLedger: React.FC<SupplierLedgerProps> = ({
  suppliers,
  transactions,
  products,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onAddTransaction,
  onDeleteTransaction,
  onClearAllTransactions,
  globalSearch = '',
  onUpdateGlobalSearch,
}) => {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const searchTerm = globalSearch !== '' ? globalSearch : localSearchTerm;
  const setSearchTerm = (val: string) => {
    setLocalSearchTerm(val);
    if (onUpdateGlobalSearch) {
      onUpdateGlobalSearch(val);
    }
  };

  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierParty | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<SupplierParty | null>(null);
  const [confirmClearBills, setConfirmClearBills] = useState(false);

  const [isRecordTxnOpen, setIsRecordTxnOpen] = useState(false);
  const [txnType, setTxnType] = useState<'PURCHASE_BILL' | 'PAYMENT_PAID'>('PURCHASE_BILL');

  // Supplier Form State
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    gstNumber: '',
    brandsSupplied: '',
    paymentTermsDays: 30,
    openingBalance: 0,
  });

  // Transaction Form State
  const [newTxn, setNewTxn] = useState({
    supplierId: selectedSupplierId,
    date: new Date().toISOString().slice(0, 10),
    type: 'PURCHASE_BILL' as 'PURCHASE_BILL' | 'PAYMENT_PAID',
    referenceInvoiceNo: '',
    amount: 0,
    paymentMode: 'Bank Transfer' as 'Bank Transfer' | 'Cheque' | 'UPI / NetBanking' | 'Cash',
    notes: '',
  });

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId) || suppliers[0];

  // Filter supplier list
  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.brandsSupplied.some((b) => b.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Supplier specific transactions
  const supplierTransactions = transactions
    .filter((t) => t.supplierId === selectedSupplier?.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Aggregate metrics
  const totalPayableOverall = suppliers.reduce((acc, s) => acc + (s.balance > 0 ? s.balance : 0), 0);
  const totalAdvancePaidOverall = suppliers.reduce((acc, s) => acc + (s.balance < 0 ? Math.abs(s.balance) : 0), 0);
  const totalBilledThisPeriod = supplierTransactions
    .filter((t) => t.direction === 'CREDIT')
    .reduce((acc, t) => acc + t.amount, 0);
  const totalPaidThisPeriod = supplierTransactions
    .filter((t) => t.direction === 'DEBIT')
    .reduce((acc, t) => acc + t.amount, 0);

  const openAddModal = () => {
    setEditingSupplier(null);
    setSupplierForm({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      gstNumber: '',
      brandsSupplied: '',
      paymentTermsDays: 30,
      openingBalance: 0,
    });
    setIsAddSupplierOpen(true);
  };

  const openEditModal = (sup: SupplierParty) => {
    setEditingSupplier(sup);
    setSupplierForm({
      name: sup.name,
      contactPerson: sup.contactPerson,
      phone: sup.phone,
      email: sup.email,
      address: sup.address,
      gstNumber: sup.gstNumber || '',
      brandsSupplied: sup.brandsSupplied.join(', '),
      paymentTermsDays: sup.paymentTermsDays,
      openingBalance: sup.openingBalance || 0,
    });
    setIsAddSupplierOpen(true);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) return;

    const brands = supplierForm.brandsSupplied.split(',').map((b) => b.trim()).filter(Boolean);

    if (editingSupplier && onUpdateSupplier) {
      onUpdateSupplier({
        ...editingSupplier,
        name: supplierForm.name,
        contactPerson: supplierForm.contactPerson,
        phone: supplierForm.phone,
        email: supplierForm.email,
        address: supplierForm.address,
        gstNumber: supplierForm.gstNumber,
        brandsSupplied: brands,
        paymentTermsDays: Number(supplierForm.paymentTermsDays) || 30,
      });
    } else {
      onAddSupplier({
        name: supplierForm.name,
        contactPerson: supplierForm.contactPerson,
        phone: supplierForm.phone,
        email: supplierForm.email,
        address: supplierForm.address,
        gstNumber: supplierForm.gstNumber,
        brandsSupplied: brands,
        paymentTermsDays: Number(supplierForm.paymentTermsDays) || 30,
        openingBalance: Number(supplierForm.openingBalance) || 0,
      });
    }

    setIsAddSupplierOpen(false);
  };

  const handleConfirmDeleteSupplier = () => {
    if (!supplierToDelete || !onDeleteSupplier) return;
    onDeleteSupplier(supplierToDelete.id);
    if (selectedSupplierId === supplierToDelete.id) {
      const remaining = suppliers.filter((s) => s.id !== supplierToDelete.id);
      setSelectedSupplierId(remaining[0]?.id || '');
    }
    setSupplierToDelete(null);
  };

  const handleRecordTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTxn.amount || !selectedSupplier) return;

    const isBill = txnType === 'PURCHASE_BILL';

    onAddTransaction({
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      date: newTxn.date,
      type: txnType,
      referenceInvoiceNo: newTxn.referenceInvoiceNo || (isBill ? `BILL-${Math.floor(1000 + Math.random() * 9000)}` : `PAY-${Math.floor(1000 + Math.random() * 9000)}`),
      amount: Number(newTxn.amount),
      direction: isBill ? 'CREDIT' : 'DEBIT', // Credit = supplier billed us (we owe more); Debit = we paid supplier
      paymentMode: isBill ? undefined : newTxn.paymentMode,
      notes: newTxn.notes,
    });

    setIsRecordTxnOpen(false);
    setNewTxn({
      supplierId: selectedSupplier.id,
      date: new Date().toISOString().slice(0, 10),
      type: 'PURCHASE_BILL',
      referenceInvoiceNo: '',
      amount: 0,
      paymentMode: 'Bank Transfer',
      notes: '',
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outstanding Payables */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Supplier Payables (We Owe)
          </span>
          <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
            {formatINR(totalPayableOverall)}
          </div>
          <p className="mt-2 text-xs text-slate-500">Across {suppliers.length} cosmetics distributors</p>
        </div>

        {/* Total Advance / Credit with Suppliers */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Advance Balances (Credit with Party)
          </span>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatINR(totalAdvancePaidOverall)}
          </div>
          <p className="mt-2 text-xs text-slate-500">Pre-paid orders & return credits</p>
        </div>

        {/* Selected Supplier Current Balance */}
        <div className="p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              Active Party Balance
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 font-bold">
              {selectedSupplier?.name ? selectedSupplier.name.split(' ')[0] : 'Party'}
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {formatINR(Math.abs(selectedSupplier?.balance || 0))}
          </div>
          <p className="mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">
            {(selectedSupplier?.balance || 0) > 0 ? '⚠️ Outstanding Payable' : '✅ Advance Cleared'}
          </p>
        </div>

        {/* Actions Fast-Track */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-center gap-2">
          <button
            onClick={() => {
              setTxnType('PURCHASE_BILL');
              setIsRecordTxnOpen(true);
            }}
            className="w-full py-2 px-3 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Receipt className="w-3.5 h-3.5" /> + Enter Supplier Purchase Bill
          </button>
          <button
            onClick={() => {
              setTxnType('PAYMENT_PAID');
              setIsRecordTxnOpen(true);
            }}
            className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <DollarSign className="w-3.5 h-3.5" /> + Record Payment Paid (Debit)
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout: Left (Party List) / Right (Party Ledger & Bill Export) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Supplier Party Directory */}
        <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-pink-500" /> Supplier Parties ({suppliers.length})
            </h3>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white text-xs font-semibold hover:brightness-110 transition cursor-pointer shadow-xs"
              title="Add New Supplier Party"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Supplier</span>
            </button>
          </div>

          {/* Search Supplier */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search party or brand..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs focus:border-pink-500 focus:outline-hidden"
            />
          </div>

          {/* List of Suppliers */}
          <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
            {filteredSuppliers.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No supplier parties found matching your search.
              </div>
            ) : (
              filteredSuppliers.map((sup) => {
                const isSelected = sup.id === selectedSupplier?.id;
                const hasDebt = sup.balance > 0;

                return (
                  <div
                    key={sup.id}
                    onClick={() => setSelectedSupplierId(sup.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer group relative ${
                      isSelected
                        ? 'bg-pink-50/60 dark:bg-pink-950/20 border-pink-400 dark:border-pink-700 shadow-xs'
                        : 'bg-slate-50/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="pr-12">
                        <h4 className="font-semibold text-xs text-slate-900 dark:text-white">
                          {sup.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {sup.contactPerson} • {sup.phone}
                        </p>
                      </div>

                      {/* Balance Badge */}
                      <span
                        className={`text-xs font-bold ${
                          hasDebt ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {formatINR(Math.abs(sup.balance))}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {sup.brandsSupplied.map((b) => (
                        <span
                          key={b}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                          {b}
                        </span>
                      ))}
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
                      <span>Terms: {sup.paymentTermsDays} Days</span>
                      
                      {/* Action buttons (Edit & Remove) */}
                      <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(sup);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition"
                          title="Edit Supplier"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        {onDeleteSupplier && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSupplierToDelete(sup);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition"
                            title="Remove Supplier Party"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                        <span className={`ml-1 font-semibold ${hasDebt ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {hasDebt ? 'Payable' : 'Advance'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed Party Statement / Debit-Credit Ledger & PDF Export */}
        <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
          {selectedSupplier ? (
            <>
              {/* Selected Party Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {selectedSupplier.name}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300">
                      Party Ledger
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> {selectedSupplier.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> {selectedSupplier.email}
                    </span>
                    {selectedSupplier.gstNumber && (
                      <span className="font-mono text-slate-600 dark:text-slate-400">
                        GSTIN: {selectedSupplier.gstNumber}
                      </span>
                    )}
                  </div>
                </div>

                {/* PDF Export & Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() =>
                      exportSupplierLedgerPDF(selectedSupplier, supplierTransactions)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export PDF</span>
                  </button>
                  <button
                    onClick={() => openEditModal(selectedSupplier)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Party</span>
                  </button>
                  {onDeleteSupplier && (
                    <button
                      onClick={() => setSupplierToDelete(selectedSupplier)}
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 text-xs font-semibold transition cursor-pointer"
                      title="Remove Supplier Party"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                  {onClearAllTransactions && transactions.length > 0 && (
                    <button
                      onClick={() => setConfirmClearBills(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:border-rose-900 text-xs font-semibold transition cursor-pointer"
                      title="Delete all purchase entries"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear All Purchases ({transactions.length})</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setTxnType('PURCHASE_BILL');
                      setIsRecordTxnOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Bill / Voucher</span>
                  </button>
                </div>
              </div>

              {/* Ledger Summary Stats for this Party */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block">Total Credit (Bills Received)</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white mt-1 block">
                    {formatINR(totalBilledThisPeriod + (selectedSupplier.openingBalance || 0))}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Debit (Payments Settled)</span>
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {formatINR(totalPaidThisPeriod)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Net Balance Payable</span>
                  <span className="text-base font-bold text-rose-600 dark:text-rose-400 mt-1 block">
                    {formatINR(selectedSupplier.balance)}
                  </span>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="px-3.5 py-3">Date</th>
                      <th className="px-3.5 py-3">Reference / Bill #</th>
                      <th className="px-3.5 py-3">Type & Particulars</th>
                      <th className="px-3.5 py-3 text-right">Debit (Payment)</th>
                      <th className="px-3.5 py-3 text-right">Credit (Bill)</th>
                      <th className="px-3.5 py-3 text-right">Running Due</th>
                      <th className="px-3.5 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {/* Opening Balance Row */}
                    <tr className="bg-slate-50/50 dark:bg-slate-900/40 font-medium">
                      <td className="px-3.5 py-2.5 text-slate-500">{selectedSupplier.createdAt}</td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-400">OPENING</td>
                      <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-300">
                        Opening Ledger Balance
                      </td>
                      <td className="px-3.5 py-2.5 text-right">-</td>
                      <td className="px-3.5 py-2.5 text-right text-rose-600 dark:text-rose-400 font-semibold">
                        {formatINR(selectedSupplier.openingBalance || 0)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-bold text-slate-800 dark:text-slate-200">
                        {formatINR(selectedSupplier.openingBalance || 0)}
                      </td>
                      <td className="px-3.5 py-2.5 text-center text-slate-400">-</td>
                    </tr>

                    {supplierTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No transactions recorded yet for this supplier party.
                        </td>
                      </tr>
                    ) : (
                      supplierTransactions.map((tx) => {
                        const isDebit = tx.direction === 'DEBIT'; // Payment paid
                        return (
                          <tr
                            key={tx.id}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                          >
                            <td className="px-3.5 py-3 text-slate-600 dark:text-slate-400">
                              {tx.date}
                            </td>
                            <td className="px-3.5 py-3 font-mono font-medium text-slate-800 dark:text-slate-200">
                              {tx.referenceInvoiceNo || '-'}
                            </td>
                            <td className="px-3.5 py-3">
                              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                {isDebit ? (
                                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
                                )}
                                {tx.type === 'PURCHASE_BILL'
                                  ? 'Purchase Bill'
                                  : tx.type === 'PAYMENT_PAID'
                                  ? 'Payment Paid'
                                  : tx.type}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {tx.notes || (tx.paymentMode ? `Mode: ${tx.paymentMode}` : '')}
                              </div>
                            </td>
                            {/* Debit column: We paid cash/bank to supplier */}
                            <td className="px-3.5 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              {isDebit ? formatINR(tx.amount) : '-'}
                            </td>
                            {/* Credit column: Supplier billed us */}
                            <td className="px-3.5 py-3 text-right font-bold text-rose-600 dark:text-rose-400">
                              {!isDebit ? formatINR(tx.amount) : '-'}
                            </td>
                            <td className="px-3.5 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                              {formatINR(selectedSupplier.balance)}
                            </td>
                            <td className="px-3.5 py-3 text-center">
                              {onDeleteTransaction && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteTransaction(tx.id)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition cursor-pointer"
                                  title="Delete this purchase entry"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="py-20 text-center text-slate-400">
              <Building2 className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
              <p>No supplier party selected. Click "+ Add Supplier" to create your first vendor party.</p>
            </div>
          )}
        </div>
      </div>

      {/* Record Transaction Modal */}
      {isRecordTxnOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <h3 className="text-lg font-bold">
              {txnType === 'PURCHASE_BILL'
                ? 'Record Supplier Purchase Bill (Credit)'
                : 'Record Payment to Supplier (Debit)'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {txnType === 'PURCHASE_BILL'
                ? 'Increases accounts payable balance for this party.'
                : 'Reduces accounts payable balance via bank/cash transfer.'}
            </p>

            <form onSubmit={handleRecordTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier Party *
                </label>
                <input
                  type="text"
                  disabled
                  value={selectedSupplier?.name || ''}
                  className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Transaction Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newTxn.date}
                    onChange={(e) => setNewTxn({ ...newTxn, date: e.target.value })}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Invoice / Voucher # *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTxn.referenceInvoiceNo}
                    onChange={(e) => setNewTxn({ ...newTxn, referenceInvoiceNo: e.target.value })}
                    placeholder="e.g. INV-2026-904"
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={newTxn.amount || ''}
                    onChange={(e) => setNewTxn({ ...newTxn, amount: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g. 25000"
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden font-mono font-bold"
                  />
                </div>

                {txnType === 'PAYMENT_PAID' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={newTxn.paymentMode}
                      onChange={(e) =>
                        setNewTxn({
                          ...newTxn,
                          paymentMode: e.target.value as any,
                        })
                      }
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden"
                    >
                      <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                      <option value="UPI / NetBanking">UPI / NetBanking</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Particulars / Description / Batch Notes
                </label>
                <textarea
                  rows={2}
                  value={newTxn.notes}
                  onChange={(e) => setNewTxn({ ...newTxn, notes: e.target.value })}
                  placeholder="Notes regarding purchase consignment or transaction reference..."
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRecordTxnOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold shadow-md transition cursor-pointer"
                >
                  Confirm & Post to Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Supplier Modal */}
      {isAddSupplierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold">
                {editingSupplier ? 'Edit Supplier / Party' : 'Register New Supplier / Distributor'}
              </h3>
              <button
                onClick={() => setIsAddSupplierOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Add or update vendor party for tracking stock purchase orders, bills, and payments.
            </p>

            <form onSubmit={handleSaveSupplier} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Company / Distributor Name *
                </label>
                <input
                  type="text"
                  required
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  placeholder="e.g. Prestige Beauty & Fragrance Wholesale"
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Person *
                  </label>
                  <input
                    type="text"
                    required
                    value={supplierForm.contactPerson}
                    onChange={(e) =>
                      setSupplierForm({ ...supplierForm, contactPerson: e.target.value })
                    }
                    placeholder="e.g. Rajesh Sharma"
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone / Mobile *
                  </label>
                  <input
                    type="tel"
                    required
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    placeholder="+91 98201 44521"
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    placeholder="accounts@glamour.in"
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    value={supplierForm.gstNumber}
                    onChange={(e) => setSupplierForm({ ...supplierForm, gstNumber: e.target.value })}
                    placeholder="27AAACG9812M1Z4"
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs uppercase focus:border-pink-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Brands Supplied (comma separated)
                </label>
                <input
                  type="text"
                  value={supplierForm.brandsSupplied}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, brandsSupplied: e.target.value })
                  }
                  placeholder="e.g. Maybelline, L'Oréal, Lakmé"
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Terms (Days)
                  </label>
                  <input
                    type="number"
                    value={supplierForm.paymentTermsDays}
                    onChange={(e) =>
                      setSupplierForm({
                        ...supplierForm,
                        paymentTermsDays: parseInt(e.target.value) || 30,
                      })
                    }
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden"
                  />
                </div>

                {!editingSupplier && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Opening Due Balance (₹)
                    </label>
                    <input
                      type="number"
                      value={supplierForm.openingBalance}
                      onChange={(e) =>
                        setSupplierForm({
                          ...supplierForm,
                          openingBalance: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs focus:border-pink-500 focus:outline-hidden font-mono"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddSupplierOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white text-xs font-semibold shadow-md transition cursor-pointer"
                >
                  {editingSupplier ? 'Update Supplier' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {supplierToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base">Remove Supplier Party?</h3>
                <p className="text-xs text-slate-500">Supplier delete confirmation</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
              Are you sure you want to remove <span className="font-bold text-slate-900 dark:text-white">"{supplierToDelete.name}"</span>?
              {supplierToDelete.balance !== 0 && (
                <span className="block mt-1 font-semibold text-rose-600">
                  Note: This party has an outstanding balance of {formatINR(Math.abs(supplierToDelete.balance))}.
                </span>
              )}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSupplierToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSupplier}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md transition cursor-pointer"
              >
                Yes, Delete Party
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Purchase Bills Modal */}
      {confirmClearBills && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base">Delete All Purchase Entries?</h3>
                <p className="text-xs text-slate-500">Reset purchase bills & payments</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
              Are you sure you want to delete all <span className="font-bold text-slate-900 dark:text-white">{transactions.length} purchase bills & payment vouchers</span>?
              All supplier balances will be reset to 0. This cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearBills(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onClearAllTransactions) onClearAllTransactions();
                  setConfirmClearBills(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md transition cursor-pointer"
              >
                Yes, Delete All Purchases
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
