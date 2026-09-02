import React, { useState } from 'react';
import { Smartphone, RotateCw, Maximize2, Sparkles, Compass } from 'lucide-react';

interface Props {
  onRequestLandscape: () => Promise<boolean>;
  onBypass?: () => void;
}

export const OrientationLockPrompt: React.FC<Props> = ({ onRequestLandscape, onBypass }) => {
  const [isAttempting, setIsAttempting] = useState(false);

  const handleRotateClick = async () => {
    setIsAttempting(true);
    try {
      await onRequestLandscape();
    } finally {
      setIsAttempting(false);
    }
  };

  return (
    <div
      id="orientation-lock-overlay"
      className="fixed inset-0 z-50 bg-stone-950 flex flex-col items-center justify-center p-6 text-center text-stone-100 select-none overflow-hidden"
      style={{
        backgroundImage: 'radial-gradient(circle at center, rgba(38, 28, 20, 0.95) 0%, rgba(12, 10, 9, 0.99) 100%)'
      }}
    >
      {/* Western Border Accents */}
      <div className="absolute inset-4 border border-amber-800/40 rounded-3xl pointer-events-none" />
      <div className="absolute inset-6 border border-amber-600/20 rounded-2xl pointer-events-none" />

      {/* Decorative Corner Ornaments */}
      <div className="absolute top-8 left-8 text-amber-500/40 text-xs font-mono">✦ VANISHING PINES ✦</div>
      <div className="absolute top-8 right-8 text-amber-500/40 text-xs font-mono">1885 FRONTIER</div>

      {/* Main Animated Icon Container */}
      <div className="relative mb-6 flex items-center justify-center">
        {/* Glowing Background Radial */}
        <div className="absolute w-40 h-40 bg-amber-500/10 rounded-full blur-2xl animate-pulse" />

        {/* Rotating Phone Animation */}
        <div className="relative flex items-center justify-center w-28 h-28 rounded-2xl bg-stone-900/90 border-2 border-amber-500/60 shadow-[0_0_30px_rgba(217,119,6,0.25)]">
          <div className="animate-[spin_4s_ease-in-out_infinite] origin-center">
            <Smartphone className="w-14 h-14 text-amber-400 stroke-[1.5]" />
          </div>
          <RotateCw className="absolute -bottom-2 -right-2 w-7 h-7 text-amber-300 bg-stone-950 rounded-full p-1 border border-amber-500/80 animate-spin" />
        </div>
      </div>

      {/* Western Badge Header */}
      <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-950/80 border border-amber-600/60 text-amber-300 text-xs font-mono tracking-widest uppercase mb-3 shadow-md">
        <Compass className="w-3.5 h-3.5 text-amber-400" />
        وضع اللعب الإجباري • Mandatory Landscape
      </div>

      {/* Bilingual Headings */}
      <h1 className="text-2xl xs:text-3xl font-serif font-black text-amber-100 mb-1 tracking-wide drop-shadow-md">
        يُرجى تدوير الهاتف بالعرض
      </h1>
      <h2 className="text-sm xs:text-base font-mono font-bold text-amber-400/90 mb-4 tracking-wider uppercase">
        Please Rotate Your Device to Landscape
      </h2>

      {/* Explanatory Context */}
      <p className="max-w-xs text-xs xs:text-sm text-stone-300 font-sans leading-relaxed mb-6">
        تم تصميم عالم <strong className="text-amber-300">Vanishing Pines</strong> ليعمل في الوضع الأفقي العريض لمنحك مجال رؤية سينمائي كامل وأزرار تحكم باللمس سلسة في كلا الجانبين.
      </p>

      {/* Action CTA Buttons */}
      <div className="flex flex-col gap-3 w-full max-w-xs z-10">
        <button
          id="btn-auto-rotate-landscape"
          onClick={handleRotateClick}
          disabled={isAttempting}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 active:scale-95 text-stone-950 font-bold font-mono text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(217,119,6,0.4)] border border-amber-300 transition"
        >
          <Maximize2 className="w-4 h-4 text-stone-950" />
          <span>{isAttempting ? 'جاري التحويل...' : 'تدوير وملء الشاشة 📱'}</span>
        </button>

        {onBypass && (
          <button
            id="btn-bypass-orientation"
            onClick={onBypass}
            className="text-stone-400 hover:text-amber-300 text-xs font-mono underline underline-offset-4 py-1 transition opacity-75 hover:opacity-100"
          >
            المتابعة في هذا الوضع (للمعاينة والتجربة)
          </button>
        )}
      </div>

      {/* Ambient Footer */}
      <div className="absolute bottom-6 text-[10px] text-stone-300/90 font-mono flex items-center gap-1.5">
        <Sparkles className="w-3 h-3 text-amber-400" />
        <span>تدوير الجهاز تلقائياً سيزيل هذه الشاشة فوراً</span>
      </div>
    </div>
  );
};
