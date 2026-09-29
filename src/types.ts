export interface Product {
  id: string;
  barcode: string;
  name: string;
  brand: string; // e.g. MAC, Maybelline, L'Oréal, Huda Beauty, Fenty, Nykaa, Estée Lauder, Rare Beauty, Lakmé
  category: 'Skincare' | 'Makeup' | 'Haircare' | 'Fragrance' | 'Bath & Body' | 'Tools & Brushes' | 'Nail Care';
  purchasePrice: number; // Cost / Buy price
  sellingPrice: number; // MRP / Retail price
  currentStock: number;
  minStockLevel: number;
  batchNumber?: string;
  expiryDate?: string;
  supplierId: string;
  location?: string;
  notes?: string;
  imageUrl?: string;
  lastUpdated: string;
}

export interface SupplierParty {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  gstNumber?: string;
  brandsSupplied: string[];
  paymentTermsDays: number;
  openingBalance: number; // positive = we owe them (credit), negative = they owe us (advance/debit)
  balance: number; // current balance
  createdAt: string;
}

export type TransactionType = 'PURCHASE_BILL' | 'PAYMENT_PAID' | 'PURCHASE_RETURN' | 'DEBIT_NOTE' | 'CREDIT_NOTE' | 'DISCOUNT_RECEIVED';

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  supplierName: string;
  date: string;
  type: TransactionType;
  referenceInvoiceNo?: string;
  amount: number; // numeric amount
  direction: 'CREDIT' | 'DEBIT'; // CREDIT = increases what we owe (purchase bill), DEBIT = decreases what we owe (we paid cash/bank or return)
  paymentMode?: 'Bank Transfer' | 'Cheque' | 'UPI / NetBanking' | 'Cash' | 'Credit Note';
  notes?: string;
  items?: {
    productId: string;
    productName: string;
    brand: string;
    qty: number;
    unitPrice: number;
    total: number;
  }[];
  pdfGenerated?: boolean;
}

export interface SaleItem {
  productId: string;
  barcode: string;
  productName: string;
  brand: string;
  unitCostPrice: number;
  unitSellingPrice: number;
  qty: number;
  discountPercent: number;
  total: number;
  profit: number;
}

export interface SaleInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Credit';
  items: SaleItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  totalCost: number;
  netProfit: number;
  profitMarginPercent: number;
  notes?: string;
  amountPaid?: number; // amount settled
  balanceDue?: number; // pending balance (debit)
  paymentHistory?: {
    id: string;
    date: string;
    amount: number;
    mode: string;
    notes?: string;
  }[];
}

export interface MonthlyFinancialReport {
  month: string; // YYYY-MM
  monthName: string;
  totalSales: number;
  totalCostOfGoodsSold: number;
  grossProfit: number;
  grossProfitMarginPercent: number;
  totalPurchases: number;
  totalPaidToSuppliers: number;
  supplierPayableOutstanding: number;
  inventoryValuationCost: number;
  inventoryValuationRetail: number;
  potentialProfitLocked: number;
  salesCount: number;
}
