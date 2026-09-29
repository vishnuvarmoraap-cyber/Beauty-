import React, { useState, useMemo } from 'react';
import { Product, SupplierParty, SupplierTransaction, SaleInvoice } from '../types';
import { formatINR, exportAnalyticsReportPDF } from '../pdfUtils';
import { 
  TrendingUp, TrendingDown, DollarSign, PackageCheck, AlertCircle, 
  BarChart3, PieChart as PieChartIcon, Calendar, Award, ArrowUpRight, ArrowDownRight, Layers, Download,
  RotateCcw, ArrowRight, Clock
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface AnalyticsReportingProps {
  products: Product[];
  suppliers: SupplierParty[];
  transactions: SupplierTransaction[];
  sales: SaleInvoice[];
  globalSearch?: string;
  onUpdateGlobalSearch?: (term: string) => void;
}

export const AnalyticsReporting: React.FC<AnalyticsReportingProps> = ({
  products,
  suppliers,
  transactions,
  sales,
  globalSearch = '',
}) => {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Manual Date Range State (Defaults to Till Date / All Time up to today)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [activePreset, setActivePreset] = useState<string>('till_date');

  const applyPreset = (preset: string) => {
    setActivePreset(preset);
    const curr = new Date();
    const currStr = curr.toISOString().slice(0, 10);

    if (preset === 'till_date') {
      setStartDate('');
      setEndDate(currStr);
    } else if (preset === 'today') {
      setStartDate(currStr);
      setEndDate(currStr);
    } else if (preset === 'yesterday') {
      const yest = new Date(curr);
      yest.setDate(yest.getDate() - 1);
      const yestStr = yest.toISOString().slice(0, 10);
      setStartDate(yestStr);
      setEndDate(yestStr);
    } else if (preset === 'this_week') {
      const weekStart = new Date(curr);
      weekStart.setDate(weekStart.getDate() - 6);
      setStartDate(weekStart.toISOString().slice(0, 10));
      setEndDate(currStr);
    } else if (preset === 'this_month') {
      const monthStart = new Date(curr.getFullYear(), curr.getMonth(), 1);
      const mStr = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-01`;
      setStartDate(mStr);
      setEndDate(currStr);
    } else if (preset === 'last_month') {
      const lastMonthYear = curr.getMonth() === 0 ? curr.getFullYear() - 1 : curr.getFullYear();
      const lastMonthNum = curr.getMonth() === 0 ? 12 : curr.getMonth();
      const lastDay = new Date(curr.getFullYear(), curr.getMonth(), 0).getDate();
      setStartDate(`${lastMonthYear}-${String(lastMonthNum).padStart(2, '0')}-01`);
      setEndDate(`${lastMonthYear}-${String(lastMonthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'fy_till_date') {
      const m = curr.getMonth();
      const fyStartYear = m >= 3 ? curr.getFullYear() : curr.getFullYear() - 1;
      setStartDate(`${fyStartYear}-04-01`);
      setEndDate(currStr);
    }
  };

  const handleManualDateChange = (type: 'start' | 'end', val: string) => {
    setActivePreset('custom');
    if (type === 'start') {
      setStartDate(val);
    } else {
      setEndDate(val);
    }
  };

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dObj = new Date(y, m - 1, d);
      return dObj.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const activeCycleLabel = useMemo(() => {
    const endDisplay = formatDateLabel(endDate) || formatDateLabel(todayStr);
    if (!startDate && (!endDate || endDate === todayStr)) {
      return `Till Date (${endDisplay})`;
    }
    if (startDate && endDate && startDate === endDate) {
      return `Single Day: ${formatDateLabel(startDate)}`;
    }
    if (startDate && endDate) {
      return `${formatDateLabel(startDate)} to ${formatDateLabel(endDate)}`;
    }
    if (startDate && !endDate) {
      return `From ${formatDateLabel(startDate)} onwards`;
    }
    return `Up to ${endDisplay}`;
  }, [startDate, endDate, todayStr]);

  // Filter sales by manual date range
  const cycleFilteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (!s.date) return true;
      if (startDate && s.date < startDate) return false;
      if (endDate && s.date > endDate) return false;
      return true;
    });
  }, [sales, startDate, endDate]);

  // Filter transactions by manual date range
  const cycleFilteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (!t.date) return true;
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      return true;
    });
  }, [transactions, startDate, endDate]);

  // Filter products by globalSearch if provided
  const visibleProducts = globalSearch
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(globalSearch.toLowerCase()) ||
          p.brand.toLowerCase().includes(globalSearch.toLowerCase()) ||
          p.category.toLowerCase().includes(globalSearch.toLowerCase()) ||
          p.barcode.includes(globalSearch)
      )
    : products;

  // Inventory Totals
  const totalStockUnits = visibleProducts.reduce((acc, p) => acc + p.currentStock, 0);
  const totalCostValuation = visibleProducts.reduce((acc, p) => acc + p.purchasePrice * p.currentStock, 0);
  const totalRetailValuation = visibleProducts.reduce((acc, p) => acc + p.sellingPrice * p.currentStock, 0);
  const totalPotentialProfit = totalRetailValuation - totalCostValuation;
  const overallInventoryMargin =
    totalRetailValuation > 0 ? (totalPotentialProfit / totalRetailValuation) * 100 : 0;

  // Realized Sales & Profit Metrics
  const visibleSales = globalSearch
    ? cycleFilteredSales.filter(
        (s) =>
          s.invoiceNumber.toLowerCase().includes(globalSearch.toLowerCase()) ||
          s.customerName.toLowerCase().includes(globalSearch.toLowerCase()) ||
          s.items.some(
            (i) =>
              i.productName.toLowerCase().includes(globalSearch.toLowerCase()) ||
              i.brand.toLowerCase().includes(globalSearch.toLowerCase())
          )
      )
    : cycleFilteredSales;

  const totalSalesRevenue = visibleSales.reduce((acc, s) => acc + s.grandTotal, 0);
  const totalCostOfGoodsSold = visibleSales.reduce((acc, s) => acc + s.totalCost, 0);
  const realizedNetProfit = visibleSales.reduce((acc, s) => acc + s.netProfit, 0);
  const realizedMargin =
    totalSalesRevenue > 0 ? (realizedNetProfit / totalSalesRevenue) * 100 : 0;

  // Supplier Accounts
  const totalSupplierPayables = suppliers.reduce(
    (acc, s) => acc + (s.balance > 0 ? s.balance : 0),
    0
  );
  const totalSupplierPurchases = cycleFilteredTransactions
    .filter((t) => t.direction === 'CREDIT')
    .reduce((acc, t) => acc + t.amount, 0);
  const totalSupplierSettlements = cycleFilteredTransactions
    .filter((t) => t.direction === 'DEBIT')
    .reduce((acc, t) => acc + t.amount, 0);

  // Brand-wise Profitability and Stock Analytics
  const brandAnalyticsMap: Record<
    string,
    { brand: string; stockCount: number; costVal: number; retailVal: number; profit: number }
  > = {};

  visibleProducts.forEach((p) => {
    if (!brandAnalyticsMap[p.brand]) {
      brandAnalyticsMap[p.brand] = {
        brand: p.brand,
        stockCount: 0,
        costVal: 0,
        retailVal: 0,
        profit: 0,
      };
    }
    const cost = p.purchasePrice * p.currentStock;
    const retail = p.sellingPrice * p.currentStock;
    brandAnalyticsMap[p.brand].stockCount += p.currentStock;
    brandAnalyticsMap[p.brand].costVal += cost;
    brandAnalyticsMap[p.brand].retailVal += retail;
    brandAnalyticsMap[p.brand].profit += retail - cost;
  });

  const brandAnalyticsList = Object.values(brandAnalyticsMap).sort(
    (a, b) => b.retailVal - a.retailVal
  );

  // Top Performing Brands Sales Contribution (from actual sales invoices or retail stock potential)
  const brandSalesMap: Record<string, { brand: string; salesRevenue: number; unitsSold: number; profit: number }> = {};
  
  visibleSales.forEach((sale) => {
    sale.items.forEach((item) => {
      const brand = item.brand || 'Other';
      if (!brandSalesMap[brand]) {
        brandSalesMap[brand] = { brand, salesRevenue: 0, unitsSold: 0, profit: 0 };
      }
      brandSalesMap[brand].salesRevenue += item.total;
      brandSalesMap[brand].unitsSold += item.qty;
      brandSalesMap[brand].profit += item.profit;
    });
  });

  // If there are recorded sales, use realized brand sales; otherwise fall back to inventory retail valuation
  const hasRealizedSales = Object.keys(brandSalesMap).length > 0 && Object.values(brandSalesMap).some(b => b.salesRevenue > 0);

  const brandChartData = hasRealizedSales
    ? Object.values(brandSalesMap)
        .filter((b) => b.salesRevenue > 0)
        .sort((a, b) => b.salesRevenue - a.salesRevenue)
        .map((b) => ({
          name: b.brand,
          value: Math.round(b.salesRevenue),
          units: b.unitsSold,
          profit: Math.round(b.profit),
          type: 'Realized Sales'
        }))
    : Object.values(brandAnalyticsMap)
        .filter((b) => b.retailVal > 0)
        .sort((a, b) => b.retailVal - a.retailVal)
        .map((b) => ({
          name: b.brand,
          value: Math.round(b.retailVal),
          units: b.stockCount,
          profit: Math.round(b.profit),
          type: 'Retail Valuation'
        }));

  // Palette of vivid cosmetic brand colors
  const BRAND_COLORS = [
    '#ec4899', // Pink 500 (M.A.C)
    '#6366f1', // Indigo 500 (Huda Beauty)
    '#06b6d4', // Cyan 500 (COSRX)
    '#f59e0b', // Amber 500 (Rare Beauty)
    '#10b981', // Emerald 500 (Maybelline)
    '#8b5cf6', // Purple 500 (Laneige)
    '#f43f5e', // Rose 500 (L'Oréal Paris)
    '#64748b', // Slate 500 (Other)
  ];

  const totalBrandChartValue = brandChartData.reduce((acc, curr) => acc + curr.value, 0);

  // Top 5 High Margin SKUs
  const highMarginSKUs = [...visibleProducts]
    .map((p) => ({
      ...p,
      margin: p.sellingPrice > 0 ? ((p.sellingPrice - p.purchasePrice) / p.sellingPrice) * 100 : 0,
      unitProfit: p.sellingPrice - p.purchasePrice,
    }))
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 text-white shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-500/20 text-pink-300 border border-pink-500/30">
              <BarChart3 className="w-3.5 h-3.5" /> Real-Time Financial & P&L Intelligence
            </span>
            <h2 className="text-xl font-bold mt-2">Cosmetics Master Inventory Analytics</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Filter sales, purchases, brand margins, and supplier ledger across any custom date range.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              exportAnalyticsReportPDF({
                reportingCycle: activeCycleLabel,
                products: visibleProducts,
                suppliers,
                transactions: cycleFilteredTransactions,
                sales: visibleSales,
                brandAnalyticsList,
                highMarginSKUs,
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-indigo-600 hover:brightness-110 text-white text-xs font-bold shadow-md transition cursor-pointer self-start md:self-auto"
          >
            <Download className="w-4 h-4" />
            <span>Download Report (PDF)</span>
          </button>
        </div>

        {/* Manual Date Range & Quick Preset Selector Bar */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-medium flex items-center gap-1 mr-1">
              <Clock className="w-3.5 h-3.5 text-pink-400" /> Cycle:
            </span>
            {[
              { id: 'till_date', label: 'Till Date' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'this_week', label: 'Last 7 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'fy_till_date', label: 'FY Till Date' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  activePreset === p.id
                    ? 'bg-pink-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Manual Date Range Inputs (From Date to To Date) */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleManualDateChange('start', e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2 py-1 focus:border-pink-500 focus:outline-hidden"
              />
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleManualDateChange('end', e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2 py-1 focus:border-pink-500 focus:outline-hidden"
              />
            </div>

            {(startDate || (endDate && endDate !== todayStr) || activePreset !== 'till_date') && (
              <button
                type="button"
                onClick={() => applyPreset('till_date')}
                title="Reset to Till Date"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Active Range Confirmation Status */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-400 pt-1">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>Active Range:</span>
            <span className="font-semibold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/60">
              {activeCycleLabel}
            </span>
          </div>
          <span>
            Matched <strong className="text-white">{visibleSales.length}</strong> sales bills & <strong className="text-white">{cycleFilteredTransactions.length}</strong> purchase records
          </span>
        </div>
      </div>

      {/* P&L Margin Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Realized Sales Revenue */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Realized Sales Revenue</span>
            <span className="p-1 rounded-md bg-pink-50 dark:bg-pink-950/40 text-pink-500">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {formatINR(totalSalesRevenue)}
          </div>
          <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" /> From {sales.length} customer
            invoices
          </p>
        </div>

        {/* Realized Gross Profit */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Realized Gross Profit (Net)</span>
            <span className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            +{formatINR(realizedNetProfit)}
          </div>
          <p className="mt-2 text-xs text-emerald-600 font-medium">
            {realizedMargin.toFixed(1)}% Realized Profit Margin
          </p>
        </div>

        {/* Active Inventory Valuation */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Inventory Valuation (Cost)</span>
            <span className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500">
              <PackageCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {formatINR(totalCostValuation)}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Retail potential: {formatINR(totalRetailValuation)}
          </p>
        </div>

        {/* Supplier Outstanding Debt */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Supplier Credit Balance Due</span>
            <span className="p-1 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-500">
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
            {formatINR(totalSupplierPayables)}
          </div>
          <p className="mt-2 text-xs text-rose-500">Across {suppliers.length} active party accounts</p>
        </div>
      </div>

      {/* Visual Charts & Brand Margin Matrix Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Performing Brands Donut Chart Card */}
        <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-pink-500" /> Top Performing Brands
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300">
                {hasRealizedSales ? 'Sales Revenue' : 'Inventory Share'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Sales contribution breakdown across major cosmetic brands.
            </p>
          </div>

          {/* Recharts Donut Chart */}
          <div className="h-64 w-full relative flex items-center justify-center">
            {brandChartData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const percent = totalBrandChartValue > 0 ? ((data.value / totalBrandChartValue) * 100).toFixed(1) : 0;
                          return (
                            <div className="rounded-xl bg-slate-900/95 text-white p-3 text-xs shadow-xl border border-slate-700/80 backdrop-blur-xs">
                              <div className="font-bold text-pink-400 text-sm mb-1">{data.name}</div>
                              <div className="space-y-0.5">
                                <div><span className="text-slate-400">Contribution: </span><span className="font-semibold">{formatINR(data.value)}</span> ({percent}%)</div>
                                <div><span className="text-slate-400">Units: </span><span className="font-semibold">{data.units} units</span></div>
                                <div><span className="text-slate-400">Locked Profit: </span><span className="font-semibold text-emerald-400">+{formatINR(data.profit)}</span></div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Pie
                      data={brandChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="#0f172a"
                      strokeWidth={2}
                    >
                      {brandChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.name}`}
                          fill={BRAND_COLORS[index % BRAND_COLORS.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Donut Center KPI Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    {hasRealizedSales ? 'Total Sales' : 'Total MRP'}
                  </span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {formatINR(totalBrandChartValue)}
                  </span>
                  <span className="text-[10px] text-pink-500 font-semibold">
                    {brandChartData.length} Brands
                  </span>
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-400">No brand data available</div>
            )}
          </div>

          {/* Interactive Legend List */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            {brandChartData.slice(0, 6).map((item, idx) => {
              const pct = totalBrandChartValue > 0 ? ((item.value / totalBrandChartValue) * 100).toFixed(0) : '0';
              return (
                <div key={item.name} className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-1.5 truncate mr-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: BRAND_COLORS[idx % BRAND_COLORS.length] }}
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate text-[11px]">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 shrink-0">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 5 High-Margin Product Highlights */}
        <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Top Profit Margin SKUs
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Prioritize these items for beauty counter upselling & promotional displays.
          </p>

          <div className="space-y-3">
            {highMarginSKUs.map((p, idx) => (
              <div
                key={p.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="mr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-400 font-bold text-[10px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-pink-600 dark:text-pink-400">{p.brand}</span>
                  </div>
                  <h5 className="font-semibold text-slate-900 dark:text-white truncate max-w-[280px] mt-0.5">
                    {p.name}
                  </h5>
                  <div className="text-[11px] text-slate-500">
                    Buy {formatINR(p.purchasePrice)} • Sell {formatINR(p.sellingPrice)}
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block px-2 py-0.5 rounded-full font-bold text-[11px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                    {p.margin.toFixed(1)}%
                  </span>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                    +{formatINR(p.unitProfit)} / unit
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
            <span className="font-bold block">💡 Inventory Strategy Tip:</span>
            <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
              High-margin brands like Rare Beauty, M.A.C, and Huda Beauty deliver superior gross returns. Keep buffer stock to avoid stock-outs.
            </p>
          </div>
        </div>
      </div>

      {/* Brand Margin Breakdown Table Full Width */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-pink-500" /> Beauty Brands Margin & Stock Matrix
            </h3>
            <p className="text-xs text-slate-500">
              Detailed valuation, units in stock, and locked gross margin for each brand partner.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-3.5 py-3">Brand Name</th>
                <th className="px-3.5 py-3 text-center">Stock Units</th>
                <th className="px-3.5 py-3 text-right">Cost Value</th>
                <th className="px-3.5 py-3 text-right">Retail MRP Value</th>
                <th className="px-3.5 py-3 text-right">Gross Profit Locked</th>
                <th className="px-3.5 py-3 text-center">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {brandAnalyticsList.map((item) => {
                const marginPct =
                  item.retailVal > 0 ? (item.profit / item.retailVal) * 100 : 0;

                return (
                  <tr key={item.brand} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3.5 py-3 font-semibold text-slate-900 dark:text-white">
                      {item.brand}
                    </td>
                    <td className="px-3.5 py-3 text-center font-bold text-slate-700 dark:text-slate-300">
                      {item.stockCount}
                    </td>
                    <td className="px-3.5 py-3 text-right text-slate-600 dark:text-slate-400">
                      {formatINR(item.costVal)}
                    </td>
                    <td className="px-3.5 py-3 text-right font-medium text-slate-900 dark:text-white">
                      {formatINR(item.retailVal)}
                    </td>
                    <td className="px-3.5 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatINR(item.profit)}
                    </td>
                    <td className="px-3.5 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          marginPct >= 40
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                            : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400'
                        }`}
                      >
                        {marginPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Financial Health Summary Box */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-500" /> Financial & Cash Flow Health ({activeCycleLabel})
          </h3>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-medium">
            Live Intelligence
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="font-semibold text-slate-500 block uppercase">Purchases & Inflow</span>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {formatINR(totalSupplierPurchases)}
            </div>
            <p className="text-slate-500">
              Total goods invoiced by cosmetic brand distributors in this cycle.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="font-semibold text-slate-500 block uppercase">Supplier Outflow</span>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {formatINR(totalSupplierSettlements)}
            </div>
            <p className="text-slate-500">
              Paid to suppliers via RTGS, Cheques, UPI to maintain healthy credit terms.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="font-semibold text-slate-500 block uppercase">Stock Capital Locked</span>
            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
              {formatINR(totalCostValuation)}
            </div>
            <p className="text-slate-500">
              Current liquid value of cosmetic inventory across {totalStockUnits} total units.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
