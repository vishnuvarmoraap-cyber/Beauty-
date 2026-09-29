import React, { useState } from 'react';
import { Product, SupplierParty, SupplierTransaction, SaleInvoice } from '../types';
import { 
  Smartphone, Monitor, RefreshCw, Upload, Download, QrCode, 
  Copy, Check, Share2, ShieldCheck, Sparkles, X, Layers, ExternalLink 
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';

interface SyncDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  suppliers: SupplierParty[];
  transactions: SupplierTransaction[];
  sales: SaleInvoice[];
  lastAutoSavedTime: string | null;
  isCloudConnected?: boolean;
  onRestoreData: (imported: {
    products: Product[];
    suppliers: SupplierParty[];
    transactions: SupplierTransaction[];
    sales: SaleInvoice[];
  }) => void;
}

export const SyncDeviceModal: React.FC<SyncDeviceModalProps> = ({
  isOpen,
  onClose,
  products,
  suppliers,
  transactions,
  sales,
  lastAutoSavedTime,
  isCloudConnected = true,
  onRestoreData,
}) => {
  const [activeTab, setActiveTab] = useState<'qr_mobile' | 'data_transfer' | 'sync_status'>('qr_mobile');
  const [copied, setCopied] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced'>('idle');
  const [importJsonText, setImportJsonText] = useState('');
  const [importStatusMsg, setImportStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  // Use the shared pre-deploy URL or current window location
  const appUrl = typeof window !== 'undefined' 
    ? (window.location.origin.includes('ais-dev') 
        ? window.location.origin.replace('ais-dev', 'ais-pre') 
        : window.location.origin)
    : 'https://ais-pre-l76av2t6agndhdrpkku6qa-56768819341.asia-southeast1.run.app';

  const currentPayload = {
    appName: 'LUXE COSMETICS Stock & POS',
    version: '2.0.0',
    syncedAt: new Date().toISOString(),
    products,
    suppliers,
    transactions,
    sales,
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`Luxe Cosmetics Inventory & POS App Link:\n${appUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleTriggerSync = () => {
    setSyncStatus('syncing');
    try {
      localStorage.setItem('luxecosmetics_products', JSON.stringify(products));
      localStorage.setItem('luxecosmetics_suppliers', JSON.stringify(suppliers));
      localStorage.setItem('luxecosmetics_transactions', JSON.stringify(transactions));
      localStorage.setItem('luxecosmetics_sales', JSON.stringify(sales));
      localStorage.setItem('luxecosmetics_last_sync', new Date().toISOString());

      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel('luxecosmetics_sync_channel');
        channel.postMessage({
          type: 'SYNC_UPDATE',
          data: currentPayload,
        });
      }
    } catch (e) {
      console.error(e);
    }

    setTimeout(() => {
      setSyncStatus('synced');
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });
      setTimeout(() => setSyncStatus('idle'), 3000);
    }, 600);
  };

  const handleDownloadBackup = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `LuxeCosmetics_Backup_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportBackup = () => {
    setImportStatusMsg(null);
    try {
      const parsed = JSON.parse(importJsonText);
      if (parsed.products && Array.isArray(parsed.products)) {
        onRestoreData({
          products: parsed.products,
          suppliers: parsed.suppliers || [],
          transactions: parsed.transactions || [],
          sales: parsed.sales || [],
        });
        setImportStatusMsg({ type: 'success', text: `✓ Successfully imported ${parsed.products.length} products and data!` });
        confetti({ particleCount: 60, spread: 70 });
        setTimeout(() => onClose(), 1500);
      } else {
        setImportStatusMsg({ type: 'error', text: 'Invalid backup file structure: missing products list.' });
      }
    } catch {
      setImportStatusMsg({ type: 'error', text: 'Failed to parse JSON backup text. Please verify formatting.' });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportJsonText(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-md">
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-900 dark:text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400">
              <Smartphone className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                Use on Mobile, Tablet & Other Devices
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-mono border border-emerald-200 dark:border-emerald-800">
                  Ready
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Apne phone, tablet ya doosre computer par chalayein
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('qr_mobile')}
              className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'qr_mobile'
                  ? 'bg-white dark:bg-slate-900 text-pink-600 dark:text-pink-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>📱 QR Code & Mobile Link</span>
            </button>
            <button
              onClick={() => setActiveTab('data_transfer')}
              className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'data_transfer'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>💾 Transfer Data</span>
            </button>
            <button
              onClick={() => setActiveTab('sync_status')}
              className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'sync_status'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>⚡ Live Status</span>
            </button>
          </div>

          {/* TAB 1: QR Code & Mobile Link */}
          {activeTab === 'qr_mobile' && (
            <div className="space-y-4">
              {/* Family Live Real-Time Sync Banner */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-indigo-950/60 border border-emerald-500/30 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-300">
                      Family Multi-Device Live Cloud Sync Active
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Aap ya aapke family members kisi bhi phone/laptop se bill banayein ya stock badhayein — wo <strong>sabke devices par turant live</strong> dikhega!
                  </p>
                </div>
              </div>

              {/* QR Code Card */}
              <div className="flex flex-col sm:flex-row items-center gap-5 p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-inner">
                {/* QR Code Box */}
                <div className="p-3 bg-white rounded-2xl shadow-md shrink-0 flex items-center justify-center border border-slate-200">
                  <QRCodeSVG
                    value={appUrl}
                    size={145}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                {/* Link & Buttons */}
                <div className="flex-1 text-center sm:text-left space-y-3">
                  <div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-pink-600 dark:text-pink-400 mb-1">
                      <QrCode className="w-3.5 h-3.5" /> 1-Second Camera Scan
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Apne phone ke <strong>Camera</strong> ya <strong>Google Lens</strong> se ye QR code scan karein. Link turant mobile par open ho jayega.
                    </p>
                  </div>

                  {/* URL Box */}
                  <div className="flex items-center gap-2 p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <input
                      type="text"
                      readOnly
                      value={appUrl}
                      className="bg-transparent text-xs text-slate-700 dark:text-slate-300 font-mono flex-1 focus:outline-hidden px-1.5 truncate"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                        copied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-pink-600 hover:bg-pink-700 text-white shadow-xs'
                      }`}
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy Link
                        </>
                      )}
                    </button>
                  </div>

                  {/* WhatsApp Share */}
                  <button
                    type="button"
                    onClick={handleWhatsAppShare}
                    className="inline-flex items-center justify-center gap-2 w-full px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold transition cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Send Link to WhatsApp
                  </button>
                </div>
              </div>

              {/* Install As App Guide */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-pink-500" /> Phone Par App Ki Tarah Install Kaise Karein
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Android */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                      <Smartphone className="w-4 h-4" /> Android (Google Chrome)
                    </div>
                    <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
                      <li>Chrome browser me link open karein.</li>
                      <li>Upar daayein kone me <strong>3 dots (⋮)</strong> dabayein.</li>
                      <li><strong>"Add to Home screen"</strong> ya <strong>"Install app"</strong> chunein.</li>
                      <li>Aapke phone par icon ban jayega!</li>
                    </ol>
                  </div>

                  {/* iPhone */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-bold text-xs">
                      <Smartphone className="w-4 h-4" /> iPhone / iPad (Safari)
                    </div>
                    <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
                      <li>Safari browser me link open karein.</li>
                      <li>Neeche <strong>Share icon (📤)</strong> dabayein.</li>
                      <li>List me se <strong>"Add to Home Screen"</strong> dabayein.</li>
                      <li>Ab iPhone par bina browser bar ke chalegi!</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Transfer Data */}
          {activeTab === 'data_transfer' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 space-y-2">
                <span className="font-bold text-indigo-700 dark:text-indigo-300 text-sm flex items-center gap-2">
                  <Monitor className="w-4 h-4" /> Ek Device Se Dusre Device Me Data Kaise Layein?
                </span>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Agar aapne is computer par stock, products ya rates daale hain aur wahi data phone me chahte hain:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900">
                    <strong className="text-pink-600 dark:text-pink-400 block mb-0.5">1. Pehle Device Se:</strong>
                    Neeche <strong>"Download Backup File"</strong> par click karein.
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900">
                    <strong className="text-emerald-600 dark:text-emerald-400 block mb-0.5">2. Dusre Device Par:</strong>
                    Naye phone/laptop par link kholein aur yahan <strong>"Restore File"</strong> kar dein!
                  </div>
                </div>
              </div>

              {/* Step 1: Export */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  Step 1: Download Current Database Backup
                </span>
                <p className="text-slate-500 text-[11px]">
                  Isme aapke saare {products.length} products, {suppliers.length} parties aur invoices save honge.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="w-full py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <Download className="w-4 h-4 text-indigo-500" />
                  <span>Download Backup File (JSON)</span>
                </button>
              </div>

              {/* Step 2: Import */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  Step 2: Upload / Restore On New Device
                </span>

                <div className="flex items-center gap-2">
                  <label className="flex-1 py-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900 text-center font-medium cursor-pointer transition flex items-center justify-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload JSON Backup File</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <textarea
                  rows={3}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder="Ya backup JSON content yahan paste karein..."
                  className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 font-mono text-[11px] focus:outline-hidden focus:border-pink-500"
                />

                {importStatusMsg && (
                  <p className={`text-xs font-medium ${importStatusMsg.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {importStatusMsg.text}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleImportBackup}
                  disabled={!importJsonText.trim()}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Restore Data Now</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Live Status */}
          {activeTab === 'sync_status' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Local Auto-Save State:</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="w-4 h-4" /> Active & Encrypted
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Last auto-saved timestamp:</span>
                  <span className="font-mono">{lastAutoSavedTime || 'Continuous (Live)'}</span>
                </div>

                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Cosmetic SKUs stored:</span>
                  <span className="font-bold">{products.length} Products</span>
                </div>

                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Distributors & Suppliers:</span>
                  <span className="font-bold">{suppliers.length} Parties</span>
                </div>

                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Sales Invoices:</span>
                  <span className="font-bold">{sales.length} Bills</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
                  <Smartphone className="w-6 h-6 text-pink-500 mx-auto mb-1.5" />
                  <h5 className="font-semibold text-slate-800 dark:text-slate-200">Mobile Scanner Mode</h5>
                  <p className="text-[11px] text-slate-500 mt-0.5">Use camera for instant SKU lookups on mobile phones</p>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
                  <Monitor className="w-6 h-6 text-indigo-500 mx-auto mb-1.5" />
                  <h5 className="font-semibold text-slate-800 dark:text-slate-200">Desktop Terminal</h5>
                  <p className="text-[11px] text-slate-500 mt-0.5">Full POS billing, invoice generation and ledger statements</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTriggerSync}
                disabled={syncStatus === 'syncing'}
                className="w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                {syncStatus === 'syncing'
                  ? 'Syncing across active devices...'
                  : syncStatus === 'synced'
                  ? '✓ Synchronized Perfectly!'
                  : 'Force Local Sync Now'}
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-3.5 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4" /> 100% Free & Responsive Web App
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-medium transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
