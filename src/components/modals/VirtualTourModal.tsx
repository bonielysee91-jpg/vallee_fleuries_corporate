import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { VFC_MEDIA } from '../../constants/media.ts';
import { X, Compass, RotateCw, ZoomIn, ZoomOut, Maximize2, Layers } from 'lucide-react';

export const VirtualTourModal: React.FC = () => {
  const { isVirtualTourOpen, closeVirtualTour } = useAppStore();
  const [activeRoom, setActiveRoom] = useState<'SALON' | 'MASTER' | 'POOL' | 'CUISINE'>('SALON');
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);

  if (!isVirtualTourOpen) return null;

  const rooms = [
    { id: 'SALON', name: 'Grand Salon Cathédrale', img: VFC_MEDIA.luxuryInterior },
    { id: 'POOL', name: 'Piscine & Jardin Tropical', img: VFC_MEDIA.villaPool },
    { id: 'MASTER', name: 'Suite Panoramique', img: VFC_MEDIA.penthouseView },
    { id: 'CUISINE', name: 'Terrasse & Pergola', img: VFC_MEDIA.beachResidence },
  ];

  const currentRoom = rooms.find(r => r.id === activeRoom) || rooms[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/90 backdrop-blur-lg animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[85vh] bg-slate-950 rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col">
        
        {/* Top Floating Glass Bar */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between p-3 rounded-xl bg-black/40 backdrop-blur-xl border border-white/15 text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/80 flex items-center justify-center text-white">
              <Compass className="w-4 h-4 animate-spin" style={{ animationDuration: '10s' }} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold tracking-tight">
                Visite Virtuelle Immersive 360° VFC
              </h3>
              <p className="text-[10px] text-slate-300">
                Espace actif : <span className="font-semibold text-amber-300">{currentRoom.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setRotation(r => r + 45)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
              title="Pivoter à 45°"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(z => Math.min(z + 0.2, 1.6))}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
              title="Zoom avant"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(z => Math.max(z - 0.2, 0.8))}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
              title="Zoom arrière"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={closeVirtualTour}
              className="p-2 rounded-lg bg-rose-500/30 hover:bg-rose-500/50 text-rose-200 transition-colors ml-2"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 360 Interactive Viewport */}
        <div className="relative flex-1 w-full overflow-hidden flex items-center justify-center bg-black cursor-grab active:cursor-grabbing">
          <img
            src={currentRoom.img}
            alt={currentRoom.name}
            className="w-full h-full object-cover transition-transform duration-700 ease-out select-none pointer-events-none"
            style={{
              transform: `scale(${zoom}) rotate(${rotation * 0.05}deg)`,
              filter: 'brightness(0.96) contrast(1.05)'
            }}
          />

          {/* Interactive Navigation Hotspots on the floor/walls */}
          <div className="absolute inset-0 pointer-events-auto">
            <button
              onClick={() => setActiveRoom(activeRoom === 'SALON' ? 'POOL' : 'SALON')}
              className="absolute top-1/2 left-1/3 transform -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full bg-emerald-900/80 text-amber-300 border border-white/30 backdrop-blur-md text-xs font-semibold shadow-lg hover:scale-110 transition-transform flex items-center gap-1.5 cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Passer vers Terrasse & Piscine</span>
            </button>
          </div>
        </div>

        {/* Bottom Room Selector Toolbar */}
        <div className="p-4 bg-slate-950/90 border-t border-white/10 z-20 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 shrink-0">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Pièces numérisées :</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setActiveRoom(room.id as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                  activeRoom === room.id
                    ? 'bg-emerald-700 text-white shadow-md'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                <span>{room.name}</span>
              </button>
            ))}
          </div>

          <div className="text-[11px] text-slate-400 hidden md:block">
            Matterport Pro3 Real 3D LiDAR Scanner
          </div>
        </div>

      </div>
    </div>
  );
};
