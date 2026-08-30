// #18 MINIMAP - Realtime 3D & 2.5D Topographic Radar with Contours, Pan, Pinch/Zoom & Entity Blips
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { NPCAgentData } from '../engine/ai/NPCBrain';
import { AnimalEntityData } from '../types/game';
import { VILLAGE_BUILDINGS } from '../engine/world/World';
import { Compass, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, Layers } from 'lucide-react';

interface MinimapProps {
  playerPos: [number, number, number];
  playerYaw: number;
  npcs: NPCAgentData[];
  animals: AnimalEntityData[];
  is3DTilt?: boolean;
}

export const Minimap3D: React.FC<MinimapProps> = ({
  playerPos,
  playerYaw,
  npcs,
  animals,
  is3DTilt = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState<number>(1.2);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [panOffset, setPanOffset] = useState<{ x: number; z: number }>({ x: 0, z: 0 });
  const [isFollowPlayer, setIsFollowPlayer] = useState<boolean>(true);
  const [tiltMode, setTiltMode] = useState<boolean>(is3DTilt);

  // Drag pan tracking
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastTouchDist = useRef<number | null>(null);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerCX = width / 2;
    const centerCY = height / 2;

    const px = isFollowPlayer ? playerPos[0] : playerPos[0] + panOffset.x;
    const pz = isFollowPlayer ? playerPos[2] : playerPos[2] + panOffset.z;

    // Background
    ctx.fillStyle = '#0a100d';
    ctx.fillRect(0, 0, width, height);

    // World to Canvas transform
    const worldToCanvas = (wx: number, wz: number): [number, number] => {
      const dx = (wx - px) * zoom * (width / 130);
      let dz = (wz - pz) * zoom * (height / 130);
      if (tiltMode) {
        dz = dz * 0.65; // Isometric compression
      }
      return [centerCX + dx, centerCY + dz];
    };

    // 1. Draw Topographic Elevation Contours
    ctx.strokeStyle = 'rgba(70, 110, 80, 0.22)';
    ctx.lineWidth = 1;
    const step = 20 / zoom;
    const minWX = px - (65 / zoom);
    const maxWX = px + (65 / zoom);
    const minWZ = pz - (65 / zoom);
    const maxWZ = pz + (65 / zoom);

    for (let cwx = minWX; cwx <= maxWX; cwx += step) {
      const [cx0, cy0] = worldToCanvas(cwx, minWZ);
      const [cx1, cy1] = worldToCanvas(cwx, maxWZ);
      ctx.beginPath();
      ctx.moveTo(cx0, cy0);
      ctx.lineTo(cx1, cy1);
      ctx.stroke();
    }
    for (let cwz = minWZ; cwz <= maxWZ; cwz += step) {
      const [cx0, cy0] = worldToCanvas(minWX, cwz);
      const [cx1, cy1] = worldToCanvas(maxWX, cwz);
      ctx.beginPath();
      ctx.moveTo(cx0, cy0);
      ctx.lineTo(cx1, cy1);
      ctx.stroke();
    }

    // 2. Draw Lake Water Body (Flathead Lake basin NW to SE)
    ctx.save();
    const lakeCenter = worldToCanvas(15, -35);
    ctx.translate(lakeCenter[0], lakeCenter[1]);
    ctx.rotate(Math.PI / 4);
    const rx = 65 * zoom * (width / 130);
    const ry = (32 * zoom * (height / 130)) * (tiltMode ? 0.65 : 1.0);

    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(18, 70, 92, 0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Wooded Island
    const islandPos = worldToCanvas(30, -55);
    ctx.beginPath();
    ctx.arc(islandPos[0], islandPos[1], 9 * zoom * (width / 130), 0, Math.PI * 2);
    ctx.fillStyle = '#1e2920';
    ctx.fill();
    ctx.strokeStyle = '#344e41';
    ctx.stroke();

    // Kings Point Peninsula
    const peninsulaPos = worldToCanvas(-20, -26);
    ctx.beginPath();
    ctx.arc(peninsulaPos[0], peninsulaPos[1], 13 * zoom * (width / 130), 0, Math.PI * 2);
    ctx.fillStyle = '#16231a';
    ctx.fill();

    // 3. Roads & Trails
    ctx.strokeStyle = 'rgba(217, 160, 102, 0.55)';
    ctx.lineWidth = 3.0 * zoom;
    ctx.beginPath();
    for (let rxWorld = -45; rxWorld <= 50; rxWorld += 5) {
      const rzWorld = Math.sin(rxWorld * 0.03) * 6 + 16;
      const [cx, cy] = worldToCanvas(rxWorld, rzWorld);
      if (rxWorld === -45) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // 4. Village Building Footprints
    for (const b of VILLAGE_BUILDINGS) {
      const [bx, by] = worldToCanvas(b.x, b.z);
      const bw = b.w * zoom * (width / 130);
      const bd = (b.d * zoom * (height / 130)) * (tiltMode ? 0.65 : 1.0);

      ctx.fillStyle = b.type === 'sheriff'
        ? 'rgba(217, 119, 6, 0.9)'
        : b.type === 'tavern'
        ? 'rgba(234, 88, 12, 0.9)'
        : b.type === 'hideout'
        ? 'rgba(220, 38, 38, 0.9)'
        : b.type === 'dock'
        ? 'rgba(130, 95, 65, 0.95)'
        : 'rgba(120, 120, 120, 0.85)';

      ctx.fillRect(bx - bw / 2, by - bd / 2, bw, bd);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx - bw / 2, by - bd / 2, bw, bd);

      // Building label in expanded mode
      if (isExpanded && zoom >= 1.2) {
        ctx.fillStyle = '#f3f4f6';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(b.name.split(' ')[0], bx, by - bd / 2 - 3);
      }
    }

    // 5. Animals Blips
    for (const animal of animals) {
      if (animal.hp <= 0 || animal.harvested) continue;
      const [ax, ay] = worldToCanvas(animal.species === 'DEER' ? 6 : -12, animal.species === 'DEER' ? 12 : -18);
      if (ax >= 0 && ax <= width && ay >= 0 && ay <= height) {
        ctx.fillStyle = animal.species === 'WOLF' || animal.species === 'BEAR' ? '#f87171' : '#a3e635';
        ctx.beginPath();
        ctx.arc(ax, ay, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 6. NPC Blips with Live Heading
    for (const npc of npcs) {
      if (npc.hp <= 0) continue;
      const [nx, ny] = worldToCanvas(npc.position[0], npc.position[2]);
      if (nx < -10 || nx > width + 10 || ny < -10 || ny > height + 10) continue;

      ctx.fillStyle = npc.isWantedTarget
        ? '#ef4444'
        : npc.occupation === 'Town Sheriff'
        ? '#38bdf8'
        : npc.occupation === 'Master Hunter'
        ? '#4ade80'
        : '#fbbf24';

      ctx.beginPath();
      ctx.arc(nx, ny, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Heading arrow
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.lineTo(nx + npc.heading[0] * 8, ny + npc.heading[2] * 8 * (tiltMode ? 0.65 : 1.0));
      ctx.stroke();
    }

    // 7. Player Pin & Vision Arc
    const [playerCX, playerCY] = worldToCanvas(playerPos[0], playerPos[2]);
    ctx.save();
    ctx.translate(playerCX, playerCY);
    ctx.rotate(playerYaw);

    // Vision cone
    ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 36 * zoom, -Math.PI * 0.28 - Math.PI / 2, Math.PI * 0.28 - Math.PI / 2);
    ctx.closePath();
    ctx.fill();

    // Arrow icon
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();

    // 8. Grid overlay
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerCX, centerCY, width * 0.28, 0, Math.PI * 2);
    ctx.arc(centerCX, centerCY, width * 0.46, 0, Math.PI * 2);
    ctx.moveTo(centerCX, 0);
    ctx.lineTo(centerCX, height);
    ctx.moveTo(0, centerCY);
    ctx.lineTo(width, centerCY);
    ctx.stroke();

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width, height);

  }, [playerPos, playerYaw, npcs, animals, zoom, isExpanded, panOffset, isFollowPlayer, tiltMode]);

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setZoom((z) => clampZoom(z - e.deltaY * 0.0015));
  };

  // Drag Pan on Canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragStart.current = { x: e.clientX, y: e.clientY };

    setIsFollowPlayer(false);
    setPanOffset((prev) => ({
      x: prev.x - dx / (zoom * 2),
      z: prev.z - dy / (zoom * 2)
    }));
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Touch Pinch / Pan
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      isDragging.current = true;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      isDragging.current = false;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchDist.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && isDragging.current) {
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      setIsFollowPlayer(false);
      setPanOffset((prev) => ({
        x: prev.x - dx / (zoom * 2),
        z: prev.z - dy / (zoom * 2)
      }));
    } else if (e.touches.length === 2 && lastTouchDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / lastTouchDist.current;
      setZoom((z) => clampZoom(z * factor));
      lastTouchDist.current = dist;
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    lastTouchDist.current = null;
  };

  const clampZoom = (v: number) => Math.max(0.6, Math.min(3.0, v));

  const handleRecenter = () => {
    setIsFollowPlayer(true);
    setPanOffset({ x: 0, z: 0 });
    setZoom(1.2);
  };

  return (
    <div
      className={`relative pointer-events-auto bg-stone-950/85 backdrop-blur-md rounded-xl border border-white/15 overflow-hidden shadow-2xl transition-all duration-300 ${
        isExpanded ? 'w-80 h-80' : 'w-48 h-48'
      }`}
    >
      <canvas
        ref={canvasRef}
        width={isExpanded ? 320 : 192}
        height={isExpanded ? 320 : 192}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full h-full block cursor-grab active:cursor-grabbing touch-none"
      />

      {/* Header Overlay */}
      <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between pointer-events-none text-[10px] font-mono text-stone-200 drop-shadow">
        <span className="flex items-center gap-1 font-bold text-amber-400">
          <Compass className="w-3.5 h-3.5 text-amber-400" />
          {Math.round((((playerYaw * 180) / Math.PI + 360) % 360))}°
        </span>
        <span className="bg-black/50 px-1.5 py-0.5 rounded text-[9px]">
          {isFollowPlayer ? 'TRACKING' : 'FREE PAN'}
        </span>
        <span>
          X:{Math.round(playerPos[0])} Z:{Math.round(playerPos[2])}
        </span>
      </div>

      {/* Toolbar Controls */}
      <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 bg-black/60 backdrop-blur-sm p-0.5 rounded-lg border border-white/10">
        <button
          onClick={() => setTiltMode(!tiltMode)}
          className={`p-1 rounded text-stone-300 transition ${
            tiltMode ? 'bg-amber-600 text-stone-950 font-bold' : 'hover:bg-stone-800'
          }`}
          title="Toggle 2.5D Isometric Tilt"
        >
          <Layers className="w-3 h-3" />
        </button>
        <button
          onClick={() => setZoom((z) => clampZoom(z - 0.25))}
          className="p-1 hover:bg-stone-800 rounded text-stone-300 transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-3 h-3" />
        </button>
        <button
          onClick={() => setZoom((z) => clampZoom(z + 0.25))}
          className="p-1 hover:bg-stone-800 rounded text-stone-300 transition"
          title="Zoom In"
        >
          <ZoomIn className="w-3 h-3" />
        </button>
        <button
          onClick={handleRecenter}
          className="p-1 hover:bg-stone-800 rounded text-stone-300 transition"
          title="Re-center on Player"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
        <button
          onClick={() => setIsExpanded((e) => !e)}
          className="p-1 hover:bg-stone-800 rounded text-stone-300 transition"
          title={isExpanded ? 'Minimize Radar' : 'Expand Radar'}
        >
          {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
};
