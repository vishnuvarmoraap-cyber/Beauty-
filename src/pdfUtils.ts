import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SupplierParty, SupplierTransaction, SaleInvoice, Product } from './types';

// Format Indian Rupee currency nicely
export const formatINR = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
};

// 1. Export Supplier Statement / Ledger PDF (Party Wise Debit/Credit Tracking)
export const exportSupplierLedgerPDF = (
  supplier: SupplierParty,
  transactions: SupplierTransaction[],
  dateRangeLabel = 'All Time'
) => {
  const doc = new jsPDF();

  // Header Background Banner
  doc.setFillColor(30, 27, 75); // Deep Indigo
  doc.rect(0, 0, 210, 38, 'F');

  // Title & Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('BEAUTY BRANDS - STOCK MASTER', 14, 16);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(224, 231, 255);
  doc.text('SUPPLIER ACCOUNT STATEMENT (PARTY-WISE LEDGER)', 14, 24);
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')} | Period: ${dateRangeLabel}`, 14, 31);

  // Supplier Details Card
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Party / Supplier Details:', 14, 48);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Supplier Name: ${supplier.name}`, 14, 55);
  doc.text(`Contact Person: ${supplier.contactPerson} (${supplier.phone})`, 14, 61);
  doc.text(`Email: ${supplier.email}`, 14, 67);
  doc.text(`Address: ${supplier.address}`, 14, 73);
  if (supplier.gstNumber) {
    doc.text(`GSTIN: ${supplier.gstNumber}`, 14, 79);
  }

  // Balance Summary Box on right
  const isPayable = supplier.balance > 0;
  doc.setFillColor(isPayable ? 254 : 240, isPayable ? 242 : 253, isPayable ? 242 : 244);
  doc.setDrawColor(isPayable ? 239 : 34, isPayable ? 68 : 197, isPayable ? 68 : 94);
  doc.roundedRect(125, 45, 72, 35, 3, 3, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(isPayable ? 153 : 21, isPayable ? 27 : 128, isPayable ? 27 : 61);
  doc.text('OUTSTANDING LEDGER BALANCE', 130, 53);

  doc.setFontSize(14);
  doc.text(formatINR(Math.abs(supplier.balance)), 130, 64);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    isPayable ? 'Status: We owe supplier (Payable)' : 'Status: Advance paid (Credit with Party)',
    130,
    72
  );

  // Transactions Table
  let runningBalance = supplier.openingBalance || 0;
  const tableRows = transactions.map((tx) => {
    if (tx.direction === 'CREDIT') {
      runningBalance += tx.amount; // Purchase Bill adds to payable
    } else {
      runningBalance -= tx.amount; // Payment paid subtracts from payable
    }

    return [
      tx.date,
      tx.referenceInvoiceNo || 'N/A',
      tx.type === 'PURCHASE_BILL' ? 'Purchase Bill' : tx.type === 'PAYMENT_PAID' ? 'Payment Paid' : tx.type,
      tx.notes || (tx.paymentMode ? `Mode: ${tx.paymentMode}` : '-'),
      tx.direction === 'DEBIT' ? formatINR(tx.amount) : '-', // We paid
      tx.direction === 'CREDIT' ? formatINR(tx.amount) : '-', // Billed to us
      formatINR(runningBalance)
    ];
  });

  // Opening Balance Row
  tableRows.unshift([
    supplier.createdAt || '-',
    'OPENING',
    'Opening Balance',
    'Initial Ledger Balance',
    '-',
    formatINR(supplier.openingBalance || 0),
    formatINR(supplier.openingBalance || 0)
  ]);

  autoTable(doc, {
    startY: 88,
    head: [['Date', 'Ref / Inv No', 'Txn Type', 'Details / Mode', 'Debit (Paid)', 'Credit (Billed)', 'Balance']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 27, 75],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 3,
    },
    columnStyles: {
      4: { halign: 'right', textColor: [22, 101, 52] }, // Debit = Green (reduces debt)
      5: { halign: 'right', textColor: [153, 27, 27] }, // Credit = Red (debt created)
      6: { halign: 'right', fontStyle: 'bold' },
    },
    foot: [
      [
        'Total Summary',
        '',
        '',
        '',
        formatINR(transactions.filter(t => t.direction === 'DEBIT').reduce((acc, t) => acc + t.amount, 0)),
        formatINR(transactions.filter(t => t.direction === 'CREDIT').reduce((acc, t) => acc + t.amount, 0) + (supplier.openingBalance || 0)),
        formatINR(supplier.balance)
      ]
    ],
    footStyles: {
      fillColor: [243, 244, 246],
      textColor: [17, 24, 39],
      fontStyle: 'bold',
      fontSize: 8,
    }
  });

  // Footer / Signature Section
  const finalY = (doc as any).lastAutoTable?.finalY || 200;
  if (finalY < 250) {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('This is a computer-generated ledger statement and does not require a physical signature.', 14, finalY + 15);
    doc.text('Authorized Signatory: ________________________', 130, finalY + 15);
  }

  doc.save(`Ledger_${supplier.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// 2. Export Sale Invoice / Bill PDF
export const exportSaleBillPDF = (sale: SaleInvoice) => {
  const doc = new jsPDF();

  // Header banner
  doc.setFillColor(236, 72, 153); // Luxury Pink / Rose
  doc.rect(0, 0, 210, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('BEAUTY BRANDS', 14, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Retail & Wholesale Cosmetic Stock Master | Tax Invoice / Bill', 14, 24);
  doc.text(`Invoice No: ${sale.invoiceNumber} | Date: ${sale.date} | Payment: ${sale.paymentMethod}`, 14, 30);

  // Customer info
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Billed To (Customer):', 14, 46);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Customer Name: ${sale.customerName}`, 14, 52);
  if (sale.customerPhone) {
    doc.text(`Mobile / Contact: ${sale.customerPhone}`, 14, 58);
  }

  // Table of Items
  const tableRows = sale.items.map((item, idx) => [
    (idx + 1).toString(),
    `${item.productName}\nBrand: ${item.brand} | Barcode: ${item.barcode}`,
    item.qty.toString(),
    formatINR(item.unitSellingPrice),
    item.discountPercent > 0 ? `${item.discountPercent}%` : '0%',
    formatINR(item.total)
  ]);

  autoTable(doc, {
    startY: 65,
    head: [['#', 'Item Description & Brand', 'Qty', 'MRP / Rate', 'Disc%', 'Total']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [219, 39, 119],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 3,
    },
    columnStyles: {
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'center' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 140;

  // Invoice Summary Calculations on right
  const summaryX = 120;
  let currentY = finalY + 8;

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal:', summaryX, currentY);
  doc.text(formatINR(sale.subtotal), 195, currentY, { align: 'right' });

  if (sale.discountAmount > 0) {
    currentY += 6;
    doc.text('Discount Applied:', summaryX, currentY);
    doc.setTextColor(220, 38, 38);
    doc.text(`- ${formatINR(sale.discountAmount)}`, 195, currentY, { align: 'right' });
  }

  currentY += 8;
  doc.setFillColor(244, 244, 245);
  doc.rect(summaryX - 4, currentY - 5, 80, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text('Grand Total:', summaryX, currentY + 2);
  doc.text(formatINR(sale.grandTotal), 195, currentY + 2, { align: 'right' });

  // Profit Margins (Stock Master info)
  currentY += 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Estimated Profit on Bill: ${formatINR(sale.netProfit)} (${sale.profitMarginPercent.toFixed(1)}% margin)`, 14, currentY);
  doc.text('Thank you for shopping with us! Return policy: 7 days with intact cosmetic seal.', 14, currentY + 6);

  doc.save(`Bill_${sale.invoiceNumber}_${sale.customerName.replace(/\s+/g, '_')}.pdf`);
};

// 3. Export Stock Master Inventory Valuation & Margin Report PDF
export const exportStockInventoryPDF = (
  products: any[],
  filterBrand = 'All Brands'
) => {
  const doc = new jsPDF('landscape');

  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, 297, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('BEAUTY BRANDS - STOCK MASTER & MARGIN ANALYSIS REPORT', 14, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(`Filter: ${filterBrand} | Generated: ${new Date().toLocaleString('en-IN')} | Total SKUs: ${products.length}`, 14, 22);

  const tableRows = products.map((p, idx) => {
    const profitUnit = p.sellingPrice - p.purchasePrice;
    const marginPct = p.sellingPrice > 0 ? (profitUnit / p.sellingPrice) * 100 : 0;
    const totalCostValue = p.purchasePrice * p.currentStock;
    const totalRetailValue = p.sellingPrice * p.currentStock;
    const totalPotentialProfit = totalRetailValue - totalCostValue;

    return [
      (idx + 1).toString(),
      p.barcode,
      p.name,
      p.brand,
      p.category,
      p.currentStock.toString(),
      formatINR(p.purchasePrice),
      formatINR(p.sellingPrice),
      formatINR(profitUnit),
      `${marginPct.toFixed(1)}%`,
      formatINR(totalCostValue),
      formatINR(totalRetailValue),
      formatINR(totalPotentialProfit),
    ];
  });

  const totalCost = products.reduce((acc, p) => acc + (p.purchasePrice * p.currentStock), 0);
  const totalRetail = products.reduce((acc, p) => acc + (p.sellingPrice * p.currentStock), 0);
  const totalProfitLocked = totalRetail - totalCost;

  autoTable(doc, {
    startY: 36,
    head: [[
      '#', 'Barcode', 'Product Name', 'Brand', 'Category', 'Stock', 'Buy (₹)', 'Sell (₹)',
      'Unit P/L', 'Margin %', 'Cost Val (₹)', 'Retail Val (₹)', 'Potential P/L'
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      5: { halign: 'center', fontStyle: 'bold' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right', textColor: [22, 101, 52] },
      9: { halign: 'center', fontStyle: 'bold' },
      10: { halign: 'right' },
      11: { halign: 'right' },
      12: { halign: 'right', textColor: [22, 101, 52], fontStyle: 'bold' },
    },
    foot: [[
      'TOTALS', '', '', '', '',
      products.reduce((acc, p) => acc + p.currentStock, 0).toString(),
      '', '', '', '',
      formatINR(totalCost),
      formatINR(totalRetail),
      formatINR(totalProfitLocked)
    ]],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 8,
      fontStyle: 'bold'
    }
  });

  doc.save(`Stock_Master_Valuation_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// 4. Export Monthly Financial & Analytics P&L Report PDF
export const exportAnalyticsReportPDF = ({
  reportingCycle = `Till Date (${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})`,
  products,
  suppliers,
  transactions,
  sales,
  brandAnalyticsList,
  highMarginSKUs,
}: {
  reportingCycle?: string;
  products: Product[];
  suppliers: SupplierParty[];
  transactions: SupplierTransaction[];
  sales: SaleInvoice[];
  brandAnalyticsList: { brand: string; stockCount: number; costVal: number; retailVal: number; profit: number }[];
  highMarginSKUs: (Product & { margin: number; unitProfit: number })[];
}) => {
  const doc = new jsPDF();

  // Top Dark Banner
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, 210, 42, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('BEAUTY BRANDS - FINANCIAL & P&L REPORT', 14, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(`Reporting Period: ${reportingCycle} | Generated: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')}`, 14, 27);
  doc.text('Executive Summary: Monthly Sales, Brand Margins & Supplier Credit Ledger', 14, 34);

  // Financial KPI Cards (2x2 Grid)
  const totalSalesRevenue = sales.reduce((acc, s) => acc + s.grandTotal, 0);
  const totalCostOfGoodsSold = sales.reduce((acc, s) => acc + s.totalCost, 0);
  const realizedNetProfit = sales.reduce((acc, s) => acc + s.netProfit, 0);
  const realizedMargin = totalSalesRevenue > 0 ? (realizedNetProfit / totalSalesRevenue) * 100 : 0;

  const totalCostValuation = products.reduce((acc, p) => acc + p.purchasePrice * p.currentStock, 0);
  const totalRetailValuation = products.reduce((acc, p) => acc + p.sellingPrice * p.currentStock, 0);
  const totalSupplierPayables = suppliers.reduce((acc, s) => acc + (s.balance > 0 ? s.balance : 0), 0);

  // Box 1: Sales Revenue
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 48, 43, 22, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('REALIZED SALES', 18, 55);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatINR(totalSalesRevenue), 18, 64);

  // Box 2: Net Gross Profit
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(61, 48, 43, 22, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(22, 101, 52);
  doc.text('NET PROFIT (P&L)', 65, 55);
  doc.setFontSize(11);
  doc.text(formatINR(realizedNetProfit), 65, 64);

  // Box 3: Realized Margin %
  doc.setFillColor(253, 242, 248);
  doc.setDrawColor(251, 207, 232);
  doc.roundedRect(108, 48, 43, 22, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(157, 23, 77);
  doc.text('SALES MARGIN %', 112, 55);
  doc.setFontSize(11);
  doc.text(`${realizedMargin.toFixed(1)}%`, 112, 64);

  // Box 4: Supplier Payables Due
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(155, 48, 41, 22, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(153, 27, 27);
  doc.text('SUPPLIER DUE', 159, 55);
  doc.setFontSize(11);
  doc.text(formatINR(totalSupplierPayables), 159, 64);

  // Section 1: Top Performing Beauty Brands Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('1. Brand-Wise Margin & Valuation Breakdown', 14, 80);

  const brandRows = brandAnalyticsList.map((item) => {
    const marginPct = item.retailVal > 0 ? (item.profit / item.retailVal) * 100 : 0;
    return [
      item.brand,
      item.stockCount.toString(),
      formatINR(item.costVal),
      formatINR(item.retailVal),
      formatINR(item.profit),
      `${marginPct.toFixed(1)}%`,
    ];
  });

  autoTable(doc, {
    startY: 84,
    head: [['Brand Name', 'In Stock', 'Cost Valuation', 'Retail (MRP)', 'Locked Profit', 'Margin %']],
    body: brandRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2.5,
    },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right', textColor: [22, 101, 52], fontStyle: 'bold' },
      5: { halign: 'center', fontStyle: 'bold' },
    },
  });

  let currentY = (doc as any).lastAutoTable?.finalY || 160;

  // Section 2: Recent Sales Invoices Summary
  if (currentY > 210) {
    doc.addPage();
    currentY = 20;
  } else {
    currentY += 10;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('2. Monthly Sales Invoices & Realized Margin', 14, currentY);

  const salesRows = sales.map((s) => [
    s.invoiceNumber,
    s.date,
    s.customerName,
    s.paymentMethod,
    formatINR(s.grandTotal),
    formatINR(s.totalCost),
    formatINR(s.netProfit),
    `${s.profitMarginPercent.toFixed(1)}%`,
  ]);

  autoTable(doc, {
    startY: currentY + 4,
    head: [['Invoice #', 'Date', 'Customer', 'Payment', 'Bill Total', 'Cost Total', 'Net Profit', 'Margin %']],
    body: salesRows,
    theme: 'striped',
    headStyles: {
      fillColor: [219, 39, 119], // Pink 600
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2.5,
    },
    columnStyles: {
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'right' },
      6: { halign: 'right', textColor: [22, 101, 52], fontStyle: 'bold' },
      7: { halign: 'center', fontStyle: 'bold' },
    },
    foot: [
      [
        'Total',
        '',
        '',
        '',
        formatINR(totalSalesRevenue),
        formatINR(totalCostOfGoodsSold),
        formatINR(realizedNetProfit),
        `${realizedMargin.toFixed(1)}%`,
      ]
    ],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 8,
      fontStyle: 'bold',
    }
  });

  const finalPageY = (doc as any).lastAutoTable?.finalY || 240;
  if (finalPageY < 275) {
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('BEAUTY BRANDS Inventory & Ledger Management System • Confidential Financial Report', 14, finalPageY + 12);
  }

  doc.save(`Financial_Report_${reportingCycle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
