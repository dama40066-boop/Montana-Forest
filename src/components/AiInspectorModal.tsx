import React, { useState } from 'react';
import { NPCAgentData } from '../engine/ai/NPCBrain';
import { Brain, Heart, Eye, Shield, Activity, X } from 'lucide-react';

interface Props {
  agents: NPCAgentData[];
  onClose: () => void;
}

export const AiInspectorModal: React.FC<Props> = ({ agents, onClose }) => {
  const [selectedAgent, setSelectedAgent] = useState<NPCAgentData>(agents[0]);

  if (!selectedAgent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-stone-900 border border-stone-700 rounded-xl shadow-2xl flex flex-col overflow-hidden text-stone-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-stone-950/90 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-cyan-400" />
            <div>
              <h2 className="text-lg font-bold text-cyan-300 font-serif">
                CUSTOM ENGINE AI INSPECTOR & DECISION MATRIX
              </h2>
              <p className="text-xs text-stone-400">
                100+ Goal Utility Matrix, Episodic Memory, Needs & Relationships Real-time Engine State
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-white rounded">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Agent Selector Bar */}
        <div className="px-6 py-2 bg-stone-950/60 border-b border-stone-800 flex gap-2 overflow-x-auto">
          {agents.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedAgent(a)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                selectedAgent.id === a.id
                  ? 'bg-cyan-600 text-stone-950 shadow'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              {a.name} ({a.occupation})
            </button>
          ))}
        </div>

        {/* Details Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Core Bio & Needs & Personal Agenda */}
          <div className="space-y-6">
            {/* Autonomous Personal Agenda Card */}
            {selectedAgent.agenda && (
              <div className="p-4 rounded-xl bg-stone-950/80 border border-amber-900/50 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-amber-300 font-serif flex items-center gap-1.5">
                    <Brain className="w-4 h-4 text-amber-400" /> Autonomous Agenda
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 font-bold">
                    {selectedAgent.agenda.completedObjectivesCount} Completed
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-mono">Primary Ambition:</span>
                    <span className="text-amber-200 font-medium font-serif">{selectedAgent.agenda.primaryGoal}</span>
                  </div>

                  <div className="pt-1 border-t border-stone-800">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-stone-400">Active Task:</span>
                      <span className="text-amber-400 font-mono font-bold">
                        {Math.round(selectedAgent.agenda.objectiveProgress * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-stone-900 rounded-full overflow-hidden border border-stone-800">
                      <div
                        className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-200"
                        style={{ width: `${Math.max(5, selectedAgent.agenda.objectiveProgress * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-stone-300 italic block mt-1">
                      "{selectedAgent.agenda.currentObjective}"
                    </span>
                  </div>

                  <div className="pt-1 text-[11px] text-stone-400 font-mono">
                    Base: <span className="text-stone-200">{selectedAgent.agenda.targetWorkLocationName}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 rounded-lg bg-stone-950/70 border border-stone-800">
              <h3 className="text-sm font-bold text-amber-300 mb-2 font-serif">Agent Profile</h3>
              <div className="text-xs space-y-1 font-mono text-stone-300">
                <div>Name: <span className="text-white">{selectedAgent.name}</span></div>
                <div>Occupation: <span className="text-cyan-300">{selectedAgent.occupation}</span></div>
                <div>Personality: <span className="text-stone-400">{selectedAgent.personality}</span></div>
                <div>Current State: <span className="text-emerald-400 font-bold">{selectedAgent.state}</span></div>
                <div>Emotion: <span className="text-amber-400">{selectedAgent.emotions.label}</span></div>
                <div>Health: <span className="text-red-400">{selectedAgent.hp} / {selectedAgent.maxHp} HP</span></div>
                <div>Gold: <span className="text-yellow-400">{selectedAgent.gold} g</span></div>
              </div>
            </div>

            {/* Needs Bars */}
            <div className="p-4 rounded-lg bg-stone-950/70 border border-stone-800">
              <h3 className="text-sm font-bold text-amber-300 mb-3 font-serif">Biological Needs</h3>
              <div className="space-y-2.5 text-xs">
                {(['hunger', 'thirst', 'sleepiness', 'social', 'safety'] as const).map((need) => {
                  const val = selectedAgent.needs[need];
                  return (
                    <div key={need}>
                      <div className="flex justify-between mb-1 font-mono text-[11px] capitalize">
                        <span className="text-stone-400">{need}</span>
                        <span className="text-stone-200">{(val * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            val > 0.7 ? 'bg-red-500' : val > 0.4 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${val * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Column 2: 100+ Goal Decision Scores */}
          <div className="p-4 rounded-lg bg-stone-950/70 border border-stone-800 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-cyan-300 font-serif">Goal Utility Matrix</h3>
              <span className="px-2 py-0.5 text-[11px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800 rounded">
                Active: {selectedAgent.currentGoal}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 text-xs font-mono">
              {Object.entries(selectedAgent.goalScores).map(([goal, score]) => (
                <div
                  key={goal}
                  className={`p-2 rounded flex items-center justify-between ${
                    selectedAgent.currentGoal === goal
                      ? 'bg-cyan-950/70 border border-cyan-500 text-cyan-200 font-bold'
                      : 'bg-stone-900 text-stone-400'
                  }`}
                >
                  <span className="text-[11px] truncate">{goal}</span>
                  <span className="text-stone-300 text-[11px]">{(score as number).toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: Episodic Memories & Relationships */}
          <div className="space-y-6">
            {/* Relationships */}
            <div className="p-4 rounded-lg bg-stone-950/70 border border-stone-800">
              <h3 className="text-sm font-bold text-amber-300 mb-2 font-serif">Relationships</h3>
              <div className="space-y-2 text-xs font-mono">
                {Array.from(selectedAgent.relationships.values()).map((rel) => {
                  const r = rel as { targetId: string; targetName: string; trust: number; fear: number; respect: number; anger: number };
                  return (
                    <div key={r.targetId} className="p-2 bg-stone-900 rounded border border-stone-800">
                      <div className="text-amber-200 font-semibold mb-1">{r.targetName}</div>
                      <div className="grid grid-cols-2 gap-1 text-[11px] text-stone-400">
                        <div>Trust: <span className="text-emerald-400">{(r.trust * 100).toFixed(0)}%</span></div>
                        <div>Fear: <span className="text-red-400">{(r.fear * 100).toFixed(0)}%</span></div>
                        <div>Respect: <span className="text-cyan-400">{(r.respect * 100).toFixed(0)}%</span></div>
                        <div>Anger: <span className="text-amber-400">{(r.anger * 100).toFixed(0)}%</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Memories */}
            <div className="p-4 rounded-lg bg-stone-950/70 border border-stone-800">
              <h3 className="text-sm font-bold text-amber-300 mb-2 font-serif">Episodic Memories</h3>
              <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs font-mono text-stone-300">
                {selectedAgent.memories.map((m) => (
                  <div key={m.id} className="p-2 bg-stone-900 rounded border border-stone-800/80">
                    <div className="text-cyan-300 font-semibold text-[11px]">{m.event}</div>
                    <div className="text-[10px] text-stone-500">
                      Confidence: {(m.confidence * 100).toFixed(0)}% • Participants: {m.participants.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
