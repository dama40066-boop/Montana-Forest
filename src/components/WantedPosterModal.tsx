import React from 'react';
import { BountyContract } from '../types/game';
import { Shield, Skull, Award, CheckCircle, X, MapPin, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  contracts: BountyContract[];
  onClose: () => void;
  onClaimReward: (contract: BountyContract) => void;
}

export const WantedPosterModal: React.FC<Props> = ({ contracts, onClose, onClaimReward }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] max-h-[92dvh] bg-gradient-to-b from-stone-900 via-stone-920 to-stone-950 border border-amber-800/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-stone-200 ring-1 ring-amber-500/20">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-stone-950/90 border-b border-amber-900/40">
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-amber-800/80 to-stone-900 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-inner shrink-0">
              <Skull className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-bold tracking-wider text-amber-300 font-serif">
                VANISHING PINES BOUNTY BOARD
              </h2>
              <p className="text-[10px] sm:text-xs text-stone-400">
                Frontier Writs Sanctioned by Town Constabulary
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-stone-400 hover:text-white rounded-xl hover:bg-stone-800 transition active:scale-95"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Poster Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5">
          {contracts.map((c) => (
            <div
              key={c.id}
              className={`relative flex flex-col justify-between p-3.5 sm:p-5 rounded-2xl border transition-all duration-200 shadow-lg ${
                c.completed
                  ? 'bg-gradient-to-br from-emerald-950/40 to-stone-950/80 border-emerald-600/50 ring-1 ring-emerald-500/20'
                  : 'bg-gradient-to-br from-stone-900/90 to-stone-950/90 border-stone-800/80 hover:border-amber-600/60 hover:shadow-amber-950/20'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                  <span
                    className={`px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold rounded-full uppercase tracking-wider shadow-sm ${
                      c.dangerLevel === 'DEADLY'
                        ? 'bg-red-950 text-red-300 border border-red-800/80'
                        : c.dangerLevel === 'HIGH'
                        ? 'bg-amber-950 text-amber-300 border border-amber-700/80'
                        : 'bg-stone-800 text-stone-300 border border-stone-700'
                    }`}
                  >
                    {c.dangerLevel} Threat
                  </span>
                  <span className="text-[10px] sm:text-xs text-stone-400 flex items-center gap-1 font-mono bg-stone-950/60 px-2 py-0.5 rounded-lg border border-stone-800">
                    <MapPin className="w-3 h-3 text-amber-500" /> {c.locationName}
                  </span>
                </div>

                <h3 className="text-sm sm:text-base font-bold text-amber-200 font-serif mb-1 tracking-wide">{c.title}</h3>
                <p className="text-[11px] sm:text-xs text-stone-300 mb-3 leading-relaxed font-sans opacity-90">{c.description}</p>
              </div>

              <div className="pt-3 border-t border-stone-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-mono">
                  <span className="text-amber-300 font-bold bg-stone-950/80 px-2 py-0.5 rounded-lg border border-amber-900/30">
                    🪙 {c.rewardGold}g
                  </span>
                  <span className="text-emerald-400 font-medium bg-stone-950/80 px-2 py-0.5 rounded-lg border border-emerald-900/30">
                    +{c.rewardReputation} Rep
                  </span>
                </div>

                {c.completed ? (
                  c.claimed ? (
                    <span className="flex items-center gap-1 text-[11px] sm:text-xs text-emerald-400 font-semibold px-2.5 py-1 bg-emerald-950/70 rounded-xl border border-emerald-700/60 shadow-sm">
                      <CheckCircle className="w-3.5 h-3.5" /> Claimed
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
                        onClaimReward(c);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-[11px] sm:text-xs rounded-xl shadow-lg transition active:scale-95 border border-amber-300"
                    >
                      <Award className="w-3.5 h-3.5 text-stone-950" /> Claim Reward
                    </button>
                  )
                ) : (
                  <span className="text-[11px] text-amber-400/90 font-mono italic flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    In Wilds
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
