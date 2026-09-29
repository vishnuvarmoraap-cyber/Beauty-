import React, { useState } from 'react';
import { usePWAInstall } from '../usePWAInstall';
import { Smartphone, Download, Share, PlusSquare, Check, X, Laptop, Monitor, Sparkles } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [guidePlatform, setGuidePlatform] = useState<'ios' | 'android' | 'desktop'>('ios');

  if (isInstalled) {
    return null;
  }

  const openGuide = (platform: 'ios' | 'android' | 'desktop') => {
    setGuidePlatform(platform);
    setShowGuideModal(true);
  };

  return (
    <>
      {/* Install Button in UI */}
      {isInstallable ? (
        <button
          type="button"
          onClick={install}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-indigo-600 hover:brightness-110 text-white text-xs font-bold shadow-md transition cursor-pointer"
          title="Install BEAUTY BRANDS App on your device (iOS, Android, or Desktop)"
        >
          <Download className="w-3.5 h-3.5 animate-bounce" />
          <span>Install App</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => openGuide(isIOS ? 'ios' : isAndroid ? 'android' : 'desktop')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-indigo-600 hover:brightness-110 text-white text-xs font-bold shadow-sm transition cursor-pointer"
          title="Install app on iOS / Android / PC"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Install (iOS & OS)</span>
        </button>
      )}

      {/* Guide Modal for iOS & Desktop OS */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-pink-100 dark:bg-pink-950 text-pink-600 dark:text-pink-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">BEAUTY BRANDS App</h3>
                  <p className="text-xs text-slate-500">Run as standalone native app without browser URL bar</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Platform Selector Tabs */}
            <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl my-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setGuidePlatform('ios')}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  guidePlatform === 'ios'
                    ? 'bg-white dark:bg-slate-900 text-pink-600 dark:text-pink-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Apple iOS (iPhone/iPad)
              </button>
              <button
                type="button"
                onClick={() => setGuidePlatform('android')}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  guidePlatform === 'android'
                    ? 'bg-white dark:bg-slate-900 text-pink-600 dark:text-pink-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Android OS
              </button>
              <button
                type="button"
                onClick={() => setGuidePlatform('desktop')}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  guidePlatform === 'desktop'
                    ? 'bg-white dark:bg-slate-900 text-pink-600 dark:text-pink-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Windows / Mac PC
              </button>
            </div>

            {/* iOS Instructions */}
            {guidePlatform === 'ios' && (
              <div className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="p-3 rounded-xl bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-900/50 flex items-start gap-2.5">
                  <div className="p-1 rounded bg-pink-500 text-white font-bold text-[10px] shrink-0">1</div>
                  <div>
                    <span className="font-semibold block text-slate-900 dark:text-white">Safari Browser me kholein</span>
                    <p className="text-[11px] text-slate-500">iPhone ya iPad par website ko Safari me open karein.</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
                  <div className="p-1 rounded bg-slate-700 text-white font-bold text-[10px] shrink-0">2</div>
                  <div>
                    <span className="font-semibold block text-slate-900 dark:text-white flex items-center gap-1.5">
                      Tap <Share className="w-3.5 h-3.5 text-indigo-500 inline" /> Share button
                    </span>
                    <p className="text-[11px] text-slate-500">Safari toolbar ke neeche Share icon par tap karein.</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
                  <div className="p-1 rounded bg-slate-700 text-white font-bold text-[10px] shrink-0">3</div>
                  <div>
                    <span className="font-semibold block text-slate-900 dark:text-white flex items-center gap-1.5">
                      Select <PlusSquare className="w-3.5 h-3.5 text-pink-500 inline" /> "Add to Home Screen"
                    </span>
                    <p className="text-[11px] text-slate-500">Menu me scroll karein aur "Add to Home Screen" chunein.</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>Yeh aapke iPhone par Real Native App ki tarah save ho jayega!</span>
                </div>
              </div>
            )}

            {/* Android Instructions */}
            {guidePlatform === 'android' && (
              <div className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 flex items-start gap-2.5">
                  <div className="p-1 rounded bg-indigo-600 text-white font-bold text-[10px] shrink-0">1</div>
                  <div>
                    <span className="font-semibold block text-slate-900 dark:text-white">Google Chrome me kholein</span>
                    <p className="text-[11px] text-slate-500">Android phone par Chrome browser use karein.</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
                  <div className="p-1 rounded bg-slate-700 text-white font-bold text-[10px] shrink-0">2</div>
                  <div>
                    <span className="font-semibold block text-slate-900 dark:text-white">
                      Chrome 3-Dots menu (⋮) tap karein
                    </span>
                    <p className="text-[11px] text-slate-500">Top-right corner me 3 dots par tap karein.</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
                  <div className="p-1 rounded bg-slate-700 text-white font-bold text-[10px] shrink-0">3</div>
                  <div>
                    <span className="font-semibold block text-slate-900 dark:text-white">
                      "Install app" ya "Add to Home screen" par tap karein
                    </span>
                    <p className="text-[11px] text-slate-500">App home screen par install ho jayegi aur full screen me chalegi.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Desktop OS Instructions */}
            {guidePlatform === 'desktop' && (
              <div className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
                  <Laptop className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-slate-900 dark:text-white">
                      Chrome / Edge URL bar me Install Icon
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Address bar ke right side me computer screen/download icon (⊕) par click karein aur <strong>Install</strong> select karein.
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Yeh aapke Windows Desktop ya Mac Launchpad me separate standalone application ban jayega.
                </p>
              </div>
            )}

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer"
              >
                Theek hai (Done)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
