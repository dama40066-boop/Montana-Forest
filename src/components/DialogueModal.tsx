import React from 'react';
import { NPCAgentData } from '../engine/ai/NPCBrain';
import { DialogueNode } from '../engine/gameplay/InventoryEconomy';
import { MessageSquare, Heart, Shield, AlertTriangle, X, Target, Compass, CheckCircle2, Coins } from 'lucide-react';

interface Props {
  agent: NPCAgentData;
  dialogueNode: DialogueNode;
  onOptionSelect: (option: DialogueNode['options'][0]) => void;
  onClose: () => void;
}

export const DialogueModal: React.FC<Props> = ({ agent, dialogueNode, onOptionSelect, onClose }) => {
  const rel = agent.relationships.get('player');
  const agenda = agent.agenda;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-stone-900 via-stone-920 to-stone-950 border border-amber-800/40 rounded-2xl shadow-2xl overflow-hidden text-stone-200 ring-1 ring-amber-500/20">
        
        {/* Decorative corner trims */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-amber-500/50 rounded-tl-2xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-amber-500/50 rounded-tr-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-amber-500/50 rounded-bl-2xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-amber-500/50 rounded-br-2xl pointer-events-none" />

        {/* Speaker Info Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-stone-950/90 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-800/60 to-stone-900 border border-amber-600/50 flex items-center justify-center text-amber-300 font-bold text-xl font-serif shadow-inner">
                {agent.name.charAt(0)}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-stone-950" title="Active NPC" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-amber-300 font-serif tracking-wide">{agent.name}</h3>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-amber-900/40 border border-amber-700/50 text-amber-300">
                  {agent.occupation}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Age {agent.age} • Personality: {agent.personality.split(',')[0]} • Status: <span className="text-amber-200 font-medium">{agent.emotions.label}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-800 text-amber-300 font-mono">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>{agent.gold}g</span>
            </div>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 font-mono text-xs">
              <Heart className="w-3.5 h-3.5" /> Trust: {((rel?.trust || 0) * 100).toFixed(0)}%
            </span>
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NPC Personal Agenda & Objective Card */}
        {agenda && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-stone-950/70 border border-amber-900/30 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-medium">
                <Target className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-serif">Personal Goal:</span>
                <span className="text-stone-300 font-sans">{agenda.primaryGoal}</span>
              </div>
              <span className="text-[10px] font-mono text-stone-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> {agenda.completedObjectivesCount} Done
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-400 flex items-center gap-1.5">
                  <Compass className="w-3 h-3 text-amber-500 animate-spin-slow" />
                  <span>Objective: <strong className="text-amber-200">{agenda.currentObjective}</strong></span>
                </span>
                <span className="font-mono text-amber-400">
                  {Math.round(agenda.objectiveProgress * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(5, agenda.objectiveProgress * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Dialogue Body */}
        <div className="p-6 pt-4">
          <div className="mb-6 p-4 rounded-xl bg-stone-950/80 border border-amber-900/40 text-stone-100 text-base leading-relaxed font-serif italic flex gap-3.5 shadow-inner">
            <MessageSquare className="w-5 h-5 text-amber-400 shrink-0 mt-1" />
            <span className="text-amber-100/95">"{dialogueNode.speakerText}"</span>
          </div>

          {/* Response Choices */}
          <div className="space-y-2.5">
            {dialogueNode.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => onOptionSelect(opt)}
                className="w-full text-left px-5 py-3.5 rounded-xl bg-stone-900/90 hover:bg-amber-950/50 border border-stone-700/80 hover:border-amber-500/60 text-sm text-stone-200 hover:text-amber-200 transition-all duration-200 flex items-center justify-between group shadow-sm active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-md bg-stone-800 border border-stone-700 flex items-center justify-center font-mono text-xs text-amber-400 group-hover:border-amber-500">
                    {idx + 1}
                  </span>
                  <span className="font-medium">{opt.label}</span>
                </div>
                <span className="text-xs text-stone-400 group-hover:text-amber-300 font-mono tracking-wider">
                  [Select]
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
