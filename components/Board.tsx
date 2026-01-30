import React, { useState, useEffect, useRef } from 'react';
import { CellType, LevelConfig, Station, Coordinate } from '../types';
import { getKey, findPath } from '../utils/pathfinding';
import { TrainFront, Pickaxe, Droplets, Skull, Play, RotateCcw, Eraser, Pencil } from 'lucide-react';

interface BoardProps {
    level: LevelConfig;
    onLevelComplete: () => void;
    onCollision: () => void;
}

const GRID_SIZE = 20;
const CELL_SIZE = 34; 

const TRACK_COLORS = [
    { name: 'A', hex: '#38bdf8' }, // Light Blue
    { name: 'B', hex: '#f43f5e' }, // Red
    { name: 'C', hex: '#3b82f6' }, // Blue
    { name: 'D', hex: '#22c55e' }, // Green
    { name: 'E', hex: '#a855f7' }, // Purple
    { name: 'H', hex: '#eab308' }, // Yellow
];

const Board: React.FC<BoardProps> = ({ level, onLevelComplete, onCollision }) => {
    // Graph: Key "x,y" -> Value ["x,y", "x,y"]
    const [connections, setConnections] = useState<Map<string, string[]>>(new Map());
    const [edgeColors, setEdgeColors] = useState<Map<string, string>>(new Map());

    const [isDrawing, setIsDrawing] = useState(false);
    const [drawMode, setDrawMode] = useState<'add' | 'remove'>('add');
    const [activeColor, setActiveColor] = useState<string>(TRACK_COLORS[0].hex);
    const [lastDragCell, setLastDragCell] = useState<Coordinate | null>(null);
    const [collisionCell, setCollisionCell] = useState<Coordinate | null>(null);

    const [isSimulating, setIsSimulating] = useState(false);
    const [trainPosition, setTrainPosition] = useState<Coordinate | null>(null);
    const [simulationMessage, setSimulationMessage] = useState<string | null>(null);

    const boardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setConnections(new Map());
        setEdgeColors(new Map());
        setIsSimulating(false);
        setTrainPosition(null);
        setSimulationMessage(null);
        setDrawMode('add');
        setCollisionCell(null);
    }, [level]);

    // Clear collision effect after short time
    useEffect(() => {
        if (collisionCell) {
            const timer = setTimeout(() => setCollisionCell(null), 300);
            return () => clearTimeout(timer);
        }
    }, [collisionCell]);

    const isObstacle = (x: number, y: number) => {
        return level.obstacles.some(o => o.x === x && o.y === y);
    };

    const getStationAt = (x: number, y: number) => {
        return level.stations.find(s => s.x === x && s.y === y);
    };

    const getEdgeKey = (c1: Coordinate, c2: Coordinate) => {
        const k1 = getKey(c1.x, c1.y);
        const k2 = getKey(c2.x, c2.y);
        return [k1, k2].sort().join('|');
    };

    const modifyConnection = (c1: Coordinate, c2: Coordinate, mode: 'add' | 'remove') => {
        // Check Obstacles
        if (isObstacle(c1.x, c1.y)) {
            setCollisionCell(c1);
            onCollision();
            return;
        }
        if (isObstacle(c2.x, c2.y)) {
            setCollisionCell(c2);
            onCollision();
            return;
        }

        const k1 = getKey(c1.x, c1.y);
        const k2 = getKey(c2.x, c2.y);
        const edgeKey = getEdgeKey(c1, c2);

        setConnections(prev => {
            const newMap = new Map<string, string[]>(prev);
            const n1 = newMap.get(k1) || [];
            const n2 = newMap.get(k2) || [];
            
            if (mode === 'add') {
                if (!n1.includes(k2)) newMap.set(k1, [...n1, k2]);
                if (!n2.includes(k1)) newMap.set(k2, [...n2, k1]);
            } else {
                newMap.set(k1, n1.filter(k => k !== k2));
                newMap.set(k2, n2.filter(k => k !== k1));
            }
            return newMap;
        });

        setEdgeColors(prev => {
            const newMap = new Map(prev);
            if (mode === 'add') {
                newMap.set(edgeKey, activeColor);
            } else {
                newMap.delete(edgeKey);
            }
            return newMap;
        });
    };

    // --- Interaction (Pointer Events for Mobile & Desktop) ---
    const getCellFromEvent = (e: React.PointerEvent) => {
        if (!boardRef.current) return null;
        const rect = boardRef.current.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / CELL_SIZE);
        const y = Math.floor((e.clientY - rect.top) / CELL_SIZE);
        
        if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
            return { x, y };
        }
        return null;
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (isSimulating) return;
        boardRef.current?.setPointerCapture(e.pointerId);
        
        const cell = getCellFromEvent(e);
        if (cell) {
            setIsDrawing(true);
            setLastDragCell(cell);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDrawing || !lastDragCell || isSimulating) return;

        const cell = getCellFromEvent(e);
        if (!cell) return;

        // Optimization: Don't re-process if we are in the same cell
        if (cell.x === lastDragCell.x && cell.y === lastDragCell.y) return;

        const dx = Math.abs(cell.x - lastDragCell.x);
        const dy = Math.abs(cell.y - lastDragCell.y);

        // Allow 45 degree diagonals (dx=1, dy=1) or orthogonal (sum=1)
        const isNeighbor = (dx <= 1 && dy <= 1);

        if (isNeighbor) {
            modifyConnection(lastDragCell, cell, drawMode);
            setLastDragCell(cell);
        } else {
             setLastDragCell(cell);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDrawing(false);
        setLastDragCell(null);
        boardRef.current?.releasePointerCapture(e.pointerId);
    };

    const handleContextMenu = (e: React.MouseEvent) => e.preventDefault();

    // --- Rendering Tracks ---
    const renderTrackSVG = (x: number, y: number) => {
        const k1 = getKey(x, y);
        const neighbors = connections.get(k1) || [];
        if (neighbors.length === 0) return null;

        const center = CELL_SIZE / 2;
        const thickness = 6;
        const elements: React.ReactElement[] = [];

        const getColor = (k2: string) => {
             const [nx, ny] = k2.split(',').map(Number);
             return edgeColors.get(getEdgeKey({x,y}, {x:nx, y:ny})) || '#1e293b';
        };

        const processed = new Set<string>();
        const sortedNeighbors = [...neighbors];

        for (let i = 0; i < sortedNeighbors.length; i++) {
            const kA = sortedNeighbors[i];
            if (processed.has(kA)) continue;

            const [ax, ay] = kA.split(',').map(Number);
            const colorA = getColor(kA);
            
            // Calculate Vector Direction
            const dxA = ax - x;
            const dyA = ay - y;

            // Target Point A (Edge or Corner of current cell)
            const txA = center + (dxA * center);
            const tyA = center + (dyA * center);

            let matchedCurve = false;

            // Try to find a partner for a curve or straight line
            for (let j = i + 1; j < sortedNeighbors.length; j++) {
                const kB = sortedNeighbors[j];
                if (processed.has(kB)) continue;
                
                const [bx, by] = kB.split(',').map(Number);
                const colorB = getColor(kB);

                if (colorA === colorB) {
                    const dxB = bx - x;
                    const dyB = by - y;

                    const isOrthoA = (Math.abs(dxA) + Math.abs(dyA) === 1);
                    const isOrthoB = (Math.abs(dxB) + Math.abs(dyB) === 1);
                    
                    // 1. Curve (90 degree turn between orthogonal neighbors)
                    if (isOrthoA && isOrthoB && (dxA * dxB + dyA * dyB === 0)) {
                        const txB = center + (dxB * center);
                        const tyB = center + (dyB * center);

                        const pathD = `M ${txA} ${tyA} Q ${center} ${center} ${txB} ${tyB}`;
                        
                        elements.push(
                            <g key={`curve-${kA}-${kB}`}>
                                <path d={pathD} stroke="white" strokeWidth={thickness + 4} fill="none" strokeLinecap="round" />
                                <path d={pathD} stroke={colorA} strokeWidth={thickness} fill="none" strokeLinecap="round" />
                            </g>
                        );
                        
                        processed.add(kA);
                        processed.add(kB);
                        matchedCurve = true;
                        break;
                    }
                    // 2. Straight Line (180 degree)
                    else if (isOrthoA && isOrthoB && (dxA === -dxB && dyA === -dyB)) {
                         const txB = center + (dxB * center);
                         const tyB = center + (dyB * center);
                         const pathD = `M ${txA} ${tyA} L ${txB} ${tyB}`;
                         
                         elements.push(
                                <g key={`straight-${kA}-${kB}`}>
                                    <path d={pathD} stroke="white" strokeWidth={thickness + 4} fill="none" />
                                    <path d={pathD} stroke={colorA} strokeWidth={thickness} fill="none" />
                                </g>
                            );
                         processed.add(kA);
                         processed.add(kB);
                         matchedCurve = true;
                         break;
                    }
                }
            }

            if (!matchedCurve) {
                // Draw Single Segment from Center to Edge/Corner
                const d = `M ${center} ${center} L ${txA} ${tyA}`;

                elements.push(
                    <g key={`seg-${kA}`}>
                         <path d={d} stroke="white" strokeWidth={thickness + 4} fill="none" strokeLinecap="round" />
                         <path d={d} stroke={colorA} strokeWidth={thickness} fill="none" strokeLinecap="round" />
                    </g>
                );
                processed.add(kA);
            }
        }

        // Hub / Junction
        const distinctColors = new Set(neighbors.map(k => getColor(k)));
        if (distinctColors.size > 1 || neighbors.length > 2) {
             elements.push(
                <circle key="hub" cx={center} cy={center} r={thickness/1.5} fill="white" stroke="#64748b" strokeWidth={1} />
            );
        }

        return <>{elements}</>;
    };

    // --- Simulation ---
    const startSimulation = async () => {
        if (isSimulating) return;
        setIsSimulating(true);
        setSimulationMessage("Revisando las vías...");

        const routeIds = level.routeRequest;
        let fullPath: Coordinate[] = [];
        
        for (let i = 0; i < routeIds.length - 1; i++) {
            const startStation = level.stations.find(s => s.id === routeIds[i]);
            const endStation = level.stations.find(s => s.id === routeIds[i+1]);

            if (!startStation || !endStation) continue;

            const segmentPath = findPath(
                { x: startStation.x, y: startStation.y },
                { x: endStation.x, y: endStation.y },
                connections
            );

            if (!segmentPath) {
                setSimulationMessage(`Cortado el paso entre ${startStation.name} y ${endStation.name}`);
                setIsSimulating(false);
                return;
            }

            if (i > 0) segmentPath.shift(); 
            fullPath = [...fullPath, ...segmentPath];
        }

        setSimulationMessage("¡Salimos!");
        for (let i = 0; i < fullPath.length; i++) {
            setTrainPosition(fullPath[i]);
            await new Promise(r => setTimeout(r, 120));
        }

        setSimulationMessage("¡Llegamos joya!");
        await new Promise(r => setTimeout(r, 1000));
        onLevelComplete();
    };

    return (
        <div className="flex flex-col items-center gap-4 w-full">
            
            {/* Control Panel */}
            <div className="flex flex-col gap-4 w-full max-w-4xl bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-xl shadow-slate-100">
                
                <div className="flex justify-between items-start">
                    <div className="flex-1 space-y-1">
                         <div className="flex items-center gap-2">
                            <span className="bg-slate-900 text-white text-xs font-bold px-2 py-0.5 rounded uppercase">Misión</span>
                            <h3 className="font-semibold text-slate-800">Subte de {level.city}</h3>
                         </div>
                         <p className="text-slate-500 text-sm leading-snug">{level.description}</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-t border-slate-100 pt-4">
                    
                    {/* Tools & Colors */}
                    <div className="flex items-center justify-between w-full md:w-auto gap-4 flex-wrap">
                        <div className="flex gap-1 p-1 bg-slate-50 rounded-lg border border-slate-200">
                             {TRACK_COLORS.map(c => (
                                 <button
                                    key={c.name}
                                    onClick={() => { setActiveColor(c.hex); setDrawMode('add'); }}
                                    className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-all ${
                                        activeColor === c.hex && drawMode === 'add' ? 'ring-2 ring-slate-800 scale-110' : 'hover:scale-105'
                                    }`}
                                    style={{ backgroundColor: c.hex }}
                                    title={`Línea ${c.name}`}
                                 >
                                    <span className="text-[10px] font-bold text-white/90">{c.name}</span>
                                 </button>
                             ))}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setDrawMode(drawMode === 'add' ? 'remove' : 'add')}
                                className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-all font-medium text-sm ${
                                    drawMode === 'remove' ? 'bg-rose-100 text-rose-700 ring-2 ring-rose-200' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                }`}
                                title={drawMode === 'remove' ? "Modo Dibujar" : "Modo Borrar"}
                            >
                                {drawMode === 'remove' ? <Eraser size={18} /> : <Pencil size={18} />}
                                <span className="text-xs md:text-sm">{drawMode === 'remove' ? "Borrando" : "Dibujar"}</span>
                            </button>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 w-full md:w-auto justify-end">
                        <button 
                            onClick={() => { setConnections(new Map()); setEdgeColors(new Map()); }}
                            className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                            title="Limpiar todo"
                            disabled={isSimulating}
                        >
                            <RotateCcw size={20} />
                        </button>
                        <button 
                            onClick={startSimulation}
                            disabled={isSimulating}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold text-sm tracking-wide transition-all ${
                                isSimulating 
                                ? 'bg-slate-100 text-slate-400 cursor-wait'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 transform hover:-translate-y-0.5'
                            }`}
                        >
                            {isSimulating ? 'Viajando...' : 'Arrancar'}
                            <Play size={18} fill="currentColor" />
                        </button>
                    </div>
                </div>
            </div>

            {simulationMessage && (
                <div className={`font-medium py-2 px-6 rounded-full text-sm animate-pulse shadow-sm ${
                    simulationMessage.includes("Cortado") || simulationMessage.includes("Error")
                    ? "bg-rose-100 text-rose-700 border border-rose-200" 
                    : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                }`}>
                    {simulationMessage}
                </div>
            )}

            {/* Board Container Wrapper for Scrolling on small screens */}
            <div className="w-full overflow-auto rounded-xl border border-slate-200 shadow-xl bg-slate-100 p-1 flex justify-center">
                <div 
                    ref={boardRef}
                    className="relative bg-white shadow-inner select-none touch-none"
                    style={{ 
                        width: GRID_SIZE * CELL_SIZE, 
                        height: GRID_SIZE * CELL_SIZE,
                        minWidth: GRID_SIZE * CELL_SIZE, /* Prevent shrinking */
                        cursor: drawMode === 'add' ? `crosshair` : 'cell',
                        touchAction: 'none' /* Critical for pointer events on mobile */
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    onContextMenu={handleContextMenu}
                >
                    {/* Dot Grid Background */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none"
                         style={{
                            backgroundImage: 'radial-gradient(#64748b 1.5px, transparent 1.5px)',
                            backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
                            backgroundPosition: `${CELL_SIZE/2}px ${CELL_SIZE/2}px`
                         }}>
                    </div>

                    {/* Main Grid */}
                    <div 
                        className="absolute inset-0 grid pointer-events-none"
                        style={{ 
                            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                            gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`
                        }}
                    >
                        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
                            const x = i % GRID_SIZE;
                            const y = Math.floor(i / GRID_SIZE);
                            const station = getStationAt(x, y);
                            const obs = level.obstacles.find(o => o.x === x && o.y === y);
                            
                            const routeIndex = level.routeRequest.findIndex(rid => station?.id === rid);
                            const isStart = routeIndex === 0;
                            const isEnd = routeIndex === level.routeRequest.length - 1;
                            const isWaypoint = routeIndex > 0 && routeIndex < level.routeRequest.length - 1;
                            const isColliding = collisionCell?.x === x && collisionCell?.y === y;

                            // Identify combination station visually (more than 2 neighbors)
                            const k = getKey(x, y);
                            const neighborCount = connections.get(k)?.length || 0;
                            const isCombination = neighborCount > 2;

                            return (
                                <div 
                                    key={i}
                                    className={`relative transition-colors duration-300 ${isColliding ? 'bg-red-200 animate-pulse' : ''}`}
                                >
                                    {/* Track Layer */}
                                    <div className="absolute inset-0 z-10">
                                        <svg width="100%" height="100%" overflow="visible">
                                            {renderTrackSVG(x, y)}
                                        </svg>
                                    </div>

                                    {/* Obstacle Layer */}
                                    {obs && (
                                        <div className={`absolute inset-0 flex items-center justify-center z-20 transition-transform ${isColliding ? 'scale-125' : ''}`}>
                                            <div className={`backdrop-blur-sm p-1.5 rounded-lg shadow-sm border ${isColliding ? 'bg-red-50 border-red-300' : 'bg-white/80 border-slate-100'}`}>
                                                {obs.type === CellType.OBSTACLE_WATER && <Droplets size={16} className={isColliding ? 'text-red-500' : 'text-sky-500'} />}
                                                {obs.type === CellType.OBSTACLE_FOSSIL && <Skull size={16} className={isColliding ? 'text-red-600' : 'text-amber-600'} />}
                                                {obs.type === CellType.OBSTACLE_TUNNEL && <Pickaxe size={16} className={isColliding ? 'text-red-500' : 'text-slate-400'} />}
                                            </div>
                                        </div>
                                    )}

                                    {/* Station Layer */}
                                    {station && (
                                        <div className="absolute inset-0 flex items-center justify-center z-30">
                                            {/* Outer Circle */}
                                            <div className={`
                                                w-6 h-6 rounded-full border-[3px] flex items-center justify-center bg-white shadow-md z-10 transition-all
                                                ${isStart ? 'border-emerald-500 scale-110' : 
                                                  isEnd ? 'border-rose-500 scale-110' : 
                                                  isWaypoint ? 'border-amber-400 scale-105' :
                                                  isCombination ? 'border-slate-800 w-7 h-7' : 'border-slate-300'}
                                            `}>
                                                {/* Order Number or Generic Dot */}
                                                {routeIndex !== -1 ? (
                                                    <span className={`text-[10px] font-bold ${
                                                        isStart ? 'text-emerald-700' : isEnd ? 'text-rose-700' : 'text-amber-600'
                                                    }`}>
                                                        {routeIndex + 1}
                                                    </span>
                                                ) : (
                                                    <div className={`rounded-full ${isCombination ? 'w-2 h-2 bg-slate-800' : 'w-1.5 h-1.5 bg-slate-300'}`}></div>
                                                )}
                                            </div>
                                            
                                            {/* Station Label */}
                                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
                                                <div className="bg-white/80 backdrop-blur-[2px] text-[10px] font-semibold text-slate-800 px-2 py-0.5 rounded-sm shadow-sm whitespace-nowrap border border-slate-200/50">
                                                    {station.name}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Train Overlay */}
                    {trainPosition && (
                        <div 
                            className="absolute z-50 transition-all duration-150 ease-linear pointer-events-none"
                            style={{
                                left: trainPosition.x * CELL_SIZE,
                                top: trainPosition.y * CELL_SIZE,
                                width: CELL_SIZE,
                                height: CELL_SIZE,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <div className="bg-yellow-400 text-black p-1.5 rounded-lg shadow-lg shadow-yellow-400/30 scale-110 ring-2 ring-white">
                                <TrainFront size={16} fill="currentColor" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
             <div className="text-center text-xs text-slate-400 mt-4 max-w-lg font-medium px-4">
                Deslizá el dedo o el mouse para construir vías • Usá el botón de goma para borrar
            </div>
        </div>
    );
};

export default Board;