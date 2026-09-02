// #SETTINGS - Comprehensive Graphics, Controls, Audio & Gameplay Preferences with Persistence
import React from 'react';
import { QualityLevel } from '../engine/render/BabylonBackend';
import {
  Settings,
  Monitor,
  Gamepad2,
  Volume2,
  Sliders,
  X,
  RotateCcw,
  Check
} from 'lucide-react';

export interface GameSettings {
  // Graphics
  quality: QualityLevel;
  fov: number;
  shadows: boolean;
  fog: boolean;

  // Controls
  mouseSensitivity: number;
  touchSensitivity: number;
  invertY: boolean;
  autoSprint: boolean;
  vibration: boolean;

  // Audio
  masterVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  musicVolume: number;

  // Gameplay / UI
  minimapTilt: boolean;
  minimapZoom: number;
  showSubtitles: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  quality: 'HIGH',
  fov: 75,
  shadows: true,
  fog: true,

  mouseSensitivity: 1.0,
  touchSensitivity: 1.0,
  invertY: false,
  autoSprint: true,
  vibration: true,

  masterVolume: 0.8,
  sfxVolume: 0.9,
  ambientVolume: 0.7,
  musicVolume: 0.6,

  minimapTilt: false,
  minimapZoom: 1.2,
  showSubtitles: true
};

const SETTINGS_KEY = 'vanishing_pines_settings_v1';

export function loadSavedSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // Fallback to default
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettingsToStorage(s: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Ignore storage quota
  }
}

interface Props {
  settings?: GameSettings;
  currentSettings?: GameSettings;
  onUpdateSettings: (newSettings: GameSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ settings: propSettings, currentSettings, onUpdateSettings, onClose }) => {
  const [tab, setTab] = React.useState<'graphics' | 'controls' | 'audio' | 'gameplay'>('graphics');
  const settings = { ...DEFAULT_SETTINGS, ...(propSettings || currentSettings || {}) };

  const update = <K extends keyof GameSettings>(key: K, val: GameSettings[K]) => {
    const updated = { ...settings, [key]: val };
    onUpdateSettings(updated);
    saveSettingsToStorage(updated);
  };

  const handleReset = () => {
    onUpdateSettings({ ...DEFAULT_SETTINGS });
    saveSettingsToStorage(DEFAULT_SETTINGS);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none">
      <div className="relative w-full max-w-2xl bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-stone-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-stone-950 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-stone-100 font-serif">Game Settings</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-stone-800 hover:bg-stone-700 text-stone-300 rounded border border-stone-700 transition"
              title="Reset to Defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
            <button onClick={onClose} className="p-1 text-stone-400 hover:text-white rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-800 bg-stone-950/60 px-6 pt-2 gap-2 text-xs font-semibold">
          {[
            { id: 'graphics', label: 'Graphics', icon: Monitor },
            { id: 'controls', label: 'Controls', icon: Gamepad2 },
            { id: 'audio', label: 'Audio', icon: Volume2 },
            { id: 'gameplay', label: 'Gameplay', icon: Sliders }
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as typeof tab)}
                className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition ${
                  active
                    ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                    : 'border-transparent text-stone-400 hover:text-stone-200'
                }`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {tab === 'graphics' && (
            <div className="space-y-4">
              {/* Quality Preset */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-stone-400 mb-2">
                  Quality Tier Preset &amp; PBR Shaders
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['LOW', 'MEDIUM', 'HIGH', 'ULTRA'] as QualityLevel[]).map((tier) => (
                    <button
                      key={tier}
                      onClick={() => update('quality', tier)}
                      className={`py-2 text-xs font-bold rounded-lg border transition ${
                        settings.quality === tier
                          ? 'bg-amber-600 border-amber-400 text-stone-950 shadow'
                          : 'bg-stone-800/80 border-stone-700 text-stone-300 hover:bg-stone-700'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-[11px] text-stone-400 flex items-center gap-1.5 bg-stone-950/70 border border-stone-800 p-2.5 rounded-lg">
                  <span className="text-amber-400 font-semibold">Nano Banana Pro:</span> Multi-octave procedural PBR maps (Wood grain, Damascus metal, Stone relief, Anisotropic filtering 16x) with biomechanical character rigs.
                </div>
              </div>

              {/* Field of View */}
              <div>
                <div className="flex justify-between text-xs mb-1 font-mono">
                  <span className="text-stone-300">Camera Field of View (FOV)</span>
                  <span className="text-amber-400 font-bold">{settings.fov}°</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="105"
                  value={settings.fov}
                  onChange={(e) => update('fov', parseInt(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              {/* Shadows & Fog Toggles */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <label className="flex items-center justify-between p-3 bg-stone-950/60 border border-stone-800 rounded-xl cursor-pointer">
                  <span className="text-xs text-stone-300">Dynamic Shadows</span>
                  <input
                    type="checkbox"
                    checked={settings.shadows}
                    onChange={(e) => update('shadows', e.target.checked)}
                    className="accent-amber-500 w-4 h-4"
                  />
                </label>
                <label className="flex items-center justify-between p-3 bg-stone-950/60 border border-stone-800 rounded-xl cursor-pointer">
                  <span className="text-xs text-stone-300">Volumetric Fog</span>
                  <input
                    type="checkbox"
                    checked={settings.fog}
                    onChange={(e) => update('fog', e.target.checked)}
                    className="accent-amber-500 w-4 h-4"
                  />
                </label>
              </div>
            </div>
          )}

          {tab === 'controls' && (
            <div className="space-y-4">
              {/* Mouse Sensitivity */}
              <div>
                <div className="flex justify-between text-xs mb-1 font-mono">
                  <span className="text-stone-300">Mouse Look Sensitivity</span>
                  <span className="text-amber-400 font-bold">{settings.mouseSensitivity.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.05"
                  value={settings.mouseSensitivity}
                  onChange={(e) => update('mouseSensitivity', parseFloat(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              {/* Touch Look Sensitivity */}
              <div>
                <div className="flex justify-between text-xs mb-1 font-mono">
                  <span className="text-stone-300">Touch Aim Sensitivity</span>
                  <span className="text-amber-400 font-bold">{settings.touchSensitivity.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.05"
                  value={settings.touchSensitivity}
                  onChange={(e) => update('touchSensitivity', parseFloat(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-2">
                <label className="flex items-center justify-between p-3 bg-stone-950/60 border border-stone-800 rounded-xl cursor-pointer">
                  <div>
                    <span className="text-xs text-stone-200 block font-semibold">Invert Y-Axis</span>
                    <span className="text-[11px] text-stone-400">Inverts vertical pitch camera movement</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.invertY}
                    onChange={(e) => update('invertY', e.target.checked)}
                    className="accent-amber-500 w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-stone-950/60 border border-stone-800 rounded-xl cursor-pointer">
                  <div>
                    <span className="text-xs text-stone-200 block font-semibold">Auto-Sprint On Extended Push</span>
                    <span className="text-[11px] text-stone-400">Automatically activates sprint on max forward push</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoSprint}
                    onChange={(e) => update('autoSprint', e.target.checked)}
                    className="accent-amber-500 w-4 h-4"
                  />
                </label>
              </div>
            </div>
          )}

          {tab === 'audio' && (
            <div className="space-y-4">
              {[
                { key: 'masterVolume', label: 'Master Volume' },
                { key: 'sfxVolume', label: 'Sound Effects & Footsteps' },
                { key: 'ambientVolume', label: 'Forest Wind & Lake Waves' },
                { key: 'musicVolume', label: 'Atmosphere Synth & Cues' }
              ].map((item) => (
                <div key={item.key}>
                  <div className="flex justify-between text-xs mb-1 font-mono">
                    <span className="text-stone-300">{item.label}</span>
                    <span className="text-amber-400 font-bold">
                      {Math.round((settings[item.key as keyof GameSettings] as number) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings[item.key as keyof GameSettings] as number}
                    onChange={(e) => update(item.key as keyof GameSettings, parseFloat(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
              ))}
            </div>
          )}

          {tab === 'gameplay' && (
            <div className="space-y-4">
              {/* Minimap View Mode */}
              <label className="flex items-center justify-between p-3 bg-stone-950/60 border border-stone-800 rounded-xl cursor-pointer">
                <div>
                  <span className="text-xs text-stone-200 block font-semibold">2.5D Isometric Minimap Tilt</span>
                  <span className="text-[11px] text-stone-400">Tilts the topographic radar into perspective mode</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.minimapTilt}
                  onChange={(e) => update('minimapTilt', e.target.checked)}
                  className="accent-amber-500 w-4 h-4"
                />
              </label>

              {/* Subtitles */}
              <label className="flex items-center justify-between p-3 bg-stone-950/60 border border-stone-800 rounded-xl cursor-pointer">
                <div>
                  <span className="text-xs text-stone-200 block font-semibold">Dialogue Subtitles</span>
                  <span className="text-[11px] text-stone-400">Display full transcriptions for NPC conversations</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showSubtitles}
                  onChange={(e) => update('showSubtitles', e.target.checked)}
                  className="accent-amber-500 w-4 h-4"
                />
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-stone-950 border-t border-stone-800 flex justify-end">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-5 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-lg transition shadow"
          >
            <Check className="w-4 h-4" /> Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
