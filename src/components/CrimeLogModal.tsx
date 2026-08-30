import React from 'react';
import { PlayerStats } from '../types/game';
import { ShieldAlert, Users, Award, X } from 'lucide-react';

interface Props {
  player: PlayerStats;
  onClose: () => void;
  onPayBounty: () => void;
}

export const CrimeLogModal: React.FC<Props> = ({ player, onClose, onPayBounty }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-stone-900 border border-red-900/60 rounded-xl shadow-2xl flex flex-col overflow-hidden text-stone-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-stone-950/90 border-b border-red-950">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-red-500" />
            <div>
              <h2 className="text-lg font-bold text-red-400 font-serif">
                CRIMINAL RECORD & FACTION REPUTATION
              </h2>
              <p className="text-xs text-stone-400">
                Witnessed Offenses, Active Bounties, and Regional Faction Standing
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-white rounded">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Wanted Status Banner */}
          <div className="p-4 rounded-lg bg-stone-950/80 border border-stone-800 flex items-center justify-between">
            <div>
              <div className="text-xs text-stone-400 uppercase tracking-wider font-mono">Current Standing</div>
              <div className="text-xl font-bold text-red-400 font-serif flex items-center gap-2 mt-0.5">
                <span>Wanted Level:</span>
                <span className="text-amber-400">
                  {'★'.repeat(player.wantedLevel) + '☆'.repeat(5 - player.wantedLevel)}
                </span>
              </div>
              <div className="text-xs text-stone-300 font-mono mt-1">
                Active Bounty on Head: <span className="text-amber-400 font-bold">{player.bountyOnHead} Gold</span>
              </div>
            </div>

            {player.bountyOnHead > 0 && (
              <button
                onClick={onPayBounty}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded transition shadow"
              >
                Pay Bounty ({player.bountyOnHead}g)
              </button>
            )}
          </div>

          {/* Faction Reputations */}
          <div>
            <h3 className="text-sm font-bold text-amber-300 mb-3 font-serif flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" /> Regional Faction Reputations
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              {Object.entries(player.reputation).map(([faction, rep]) => {
                const val = rep as number;
                return (
                  <div key={faction} className="p-3 bg-stone-950/60 rounded-lg border border-stone-800">
                    <div className="text-stone-400 capitalize mb-1">{faction.replace(/([A-Z])/g, ' $1')}</div>
                    <div
                      className={`text-base font-bold ${
                        val > 20 ? 'text-emerald-400' : val < 0 ? 'text-red-400' : 'text-stone-200'
                      }`}
                    >
                      {val > 0 ? `+${val}` : val}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Crimes Committed Log */}
          <div>
            <h3 className="text-sm font-bold text-amber-300 mb-3 font-serif flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500" /> Recorded Crime History
            </h3>
            {player.crimesCommitted.length === 0 ? (
              <div className="p-4 bg-stone-950/40 rounded-lg border border-stone-800 text-xs text-stone-500 italic">
                No recorded criminal offenses in Vanishing Pines. You are in good legal standing.
              </div>
            ) : (
              <div className="space-y-2">
                {player.crimesCommitted.map((crime) => (
                  <div
                    key={crime.id}
                    className="p-3 bg-stone-950/60 rounded-lg border border-red-900/40 flex items-center justify-between text-xs font-mono"
                  >
                    <div>
                      <span className="text-red-400 font-bold uppercase">{crime.type}</span>
                      {crime.victim && <span className="text-stone-400"> against {crime.victim}</span>}
                      <div className="text-[11px] text-stone-500 mt-0.5">
                        Witnesses: {crime.witnesses.length > 0 ? crime.witnesses.join(', ') : 'None'}
                      </div>
                    </div>
                    <span className="text-amber-400 font-bold">+{crime.bountyIncrease}g Bounty</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
