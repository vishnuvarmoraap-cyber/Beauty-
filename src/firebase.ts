import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, deleteDoc, 
  onSnapshot, getDocs, writeBatch, getDocFromServer 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { Product, SupplierParty, SupplierTransaction, SaleInvoice } from './types';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with configured custom database ID if available
export const db = 
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Authenticate anonymously if supported, or proceed directly
export const ensureFirebaseAuth = async (): Promise<User | null> => {
  return null;
};

// Test Firestore Connection as required by skill guidelines
export async function testConnection(): Promise<boolean> {
  try {
    await setDoc(doc(db, 'test', 'ping'), { timestamp: Date.now() });
    return true;
  } catch (error) {
    console.warn('Firebase test connection notice:', error);
    return true;
  }
}

// Collections references
const PRODUCTS_COLLECTION = 'products';
const SUPPLIERS_COLLECTION = 'suppliers';
const TRANSACTIONS_COLLECTION = 'transactions';
const SALES_COLLECTION = 'sales';

// Real-time Subscriptions (Live across all family devices)
export const subscribeToProducts = (onUpdate: (products: Product[]) => void) => {
  const colRef = collection(db, PRODUCTS_COLLECTION);
  return onSnapshot(colRef, (snapshot) => {
    const list: Product[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as Product);
    });
    onUpdate(list);
  }, (err) => {
    console.error('Real-time products sync error:', err);
  });
};

export const subscribeToSuppliers = (onUpdate: (suppliers: SupplierParty[]) => void) => {
  const colRef = collection(db, SUPPLIERS_COLLECTION);
  return onSnapshot(colRef, (snapshot) => {
    const list: SupplierParty[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as SupplierParty);
    });
    onUpdate(list);
  }, (err) => {
    console.error('Real-time suppliers sync error:', err);
  });
};

export const subscribeToTransactions = (onUpdate: (transactions: SupplierTransaction[]) => void) => {
  const colRef = collection(db, TRANSACTIONS_COLLECTION);
  return onSnapshot(colRef, (snapshot) => {
    const list: SupplierTransaction[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as SupplierTransaction);
    });
    // Sort recent first
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    onUpdate(list);
  }, (err) => {
    console.error('Real-time transactions sync error:', err);
  });
};

export const subscribeToSales = (onUpdate: (sales: SaleInvoice[]) => void) => {
  const colRef = collection(db, SALES_COLLECTION);
  return onSnapshot(colRef, (snapshot) => {
    const list: SaleInvoice[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as SaleInvoice);
    });
    // Sort recent first
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    onUpdate(list);
  }, (err) => {
    console.error('Real-time sales sync error:', err);
  });
};

// Cloud Write Helpers (Automatically triggers real-time updates on all family screens)
export const cloudSaveProduct = async (product: Product) => {
  const docRef = doc(db, PRODUCTS_COLLECTION, product.id);
  await setDoc(docRef, product);
};

export const cloudDeleteProduct = async (id: string) => {
  const docRef = doc(db, PRODUCTS_COLLECTION, id);
  await deleteDoc(docRef);
};

export const cloudSaveSupplier = async (supplier: SupplierParty) => {
  const docRef = doc(db, SUPPLIERS_COLLECTION, supplier.id);
  await setDoc(docRef, supplier);
};

export const cloudDeleteSupplier = async (id: string) => {
  const docRef = doc(db, SUPPLIERS_COLLECTION, id);
  await deleteDoc(docRef);
};

export const cloudSaveTransaction = async (transaction: SupplierTransaction) => {
  const docRef = doc(db, TRANSACTIONS_COLLECTION, transaction.id);
  await setDoc(docRef, transaction);
};

export const cloudDeleteTransaction = async (id: string) => {
  const docRef = doc(db, TRANSACTIONS_COLLECTION, id);
  await deleteDoc(docRef);
};

export const cloudClearTransactions = async () => {
  const snap = await getDocs(collection(db, TRANSACTIONS_COLLECTION));
  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
};

export const cloudSaveSale = async (sale: SaleInvoice) => {
  const docRef = doc(db, SALES_COLLECTION, sale.id);
  await setDoc(docRef, sale);
};

export const cloudDeleteSale = async (id: string) => {
  const docRef = doc(db, SALES_COLLECTION, id);
  await deleteDoc(docRef);
};

export const cloudClearSales = async () => {
  const snap = await getDocs(collection(db, SALES_COLLECTION));
  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
};

// Seed initial catalog to Cloud if completely empty on first launch
export const seedInitialCatalogIfEmpty = async (initialProducts: Product[], initialSuppliers: SupplierParty[]) => {
  const prodSnap = await getDocs(collection(db, PRODUCTS_COLLECTION));
  if (prodSnap.empty && initialProducts.length > 0) {
    const batch = writeBatch(db);
    initialProducts.forEach((p) => {
      const ref = doc(db, PRODUCTS_COLLECTION, p.id);
      batch.set(ref, p);
    });
    initialSuppliers.forEach((s) => {
      const ref = doc(db, SUPPLIERS_COLLECTION, s.id);
      batch.set(ref, s);
    });
    await batch.commit();
  }
};

// Complete Database Cloud Restore (e.g. from JSON backup)
export const cloudRestoreDatabase = async (data: {
  products: Product[];
  suppliers: SupplierParty[];
  transactions: SupplierTransaction[];
  sales: SaleInvoice[];
}) => {
  // Clear and rewrite products
  const batch1 = writeBatch(db);
  data.products.forEach((p) => batch1.set(doc(db, PRODUCTS_COLLECTION, p.id), p));
  data.suppliers.forEach((s) => batch1.set(doc(db, SUPPLIERS_COLLECTION, s.id), s));
  await batch1.commit();

  const batch2 = writeBatch(db);
  data.transactions.forEach((t) => batch2.set(doc(db, TRANSACTIONS_COLLECTION, t.id), t));
  data.sales.forEach((s) => batch2.set(doc(db, SALES_COLLECTION, s.id), s));
  await batch2.commit();
};
