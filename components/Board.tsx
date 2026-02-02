import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CellType, LevelConfig, Station, Coordinate } from '../types';
import { getKey, findPath } from '../utils/pathfinding';
import { playBuildSound, playCollisionSound, playWinSound, playTrainWhistle, initAudio, startTrainLoop, stopTrainLoop } from '../services/soundService';
import { TrainFront, Pickaxe, Droplets, Skull, Play, RotateCcw, Eraser, Pencil, Info, ChevronUp, ChevronDown, ArrowLeft } from 'lucide-react';

interface BoardProps {
    level: LevelConfig;
    onLevelComplete: () => void;
    onCollision: () => void;
    onExit: () => void;
}

const GRID_SIZE = 15; 
const CELL_SIZE = 60; 

const TRACK_COLORS = [
    { name: 'A', hex: '#38bdf8' }, // Light Blue
    { name: 'B', hex: '#f43f5e' }, // Red
    { name: 'C', hex: '#3b82f6' }, // Blue
    { name: 'D', hex: '#22c55e' }, // Green
    { name: 'E', hex: '#a855f7' }, // Purple
    { name: 'H', hex: '#eab308' }, // Yellow
];

const Board: React.FC<BoardProps> = ({ level, onLevelComplete, onCollision, onExit }) => {
    // --- Game Logic State ---
    const [connections, setConnections] = useState<Map<string, string[]>>(new Map());
    const [edgeColors, setEdgeColors] = useState<Map<string, string>>(new Map());
    const [drawMode, setDrawMode] = useState<'add' | 'remove'>('add');
    const [activeColor, setActiveColor] = useState<string>(TRACK_COLORS[0].hex);
    const [collisionCell, setCollisionCell] = useState<Coordinate | null>(null);

    // --- Simulation State ---
    const [isSimulating, setIsSimulating] = useState(false);
    const [trainPosition, setTrainPosition] = useState<Coordinate | null>(null);
    const [simulationMessage, setSimulationMessage] = useState<string | null>(null);
    const [missionExpanded, setMissionExpanded] = useState(true);

    // --- Viewport / Gesture State ---
    const containerRef = useRef<HTMLDivElement>(null);
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.5 });
    const pointers = useRef<Map<number, { x: number, y: number }>>(new Map());
    const prevPinchDiff = useRef<number>(-1);
    const isDraggingView = useRef<boolean>(false);
    const lastDragCell = useRef<Coordinate | null>(null);

    // --- Auto-Fit Logic (Extracted for reuse) ---
    const fitBoard = useCallback(() => {
        if (containerRef.current) {
            const { width, height } = containerRef.current.getBoundingClientRect();
            if (width === 0 || height === 0) return;

            const boardSize = GRID_SIZE * CELL_SIZE;
            const padding = 20; // Internal padding
            
            // Calculate scale to fit completely within the flex-1 container
            const scaleX = (width - padding) / boardSize;
            const scaleY = (height - padding) / boardSize;
            const initialScale = Math.min(scaleX, scaleY, 1.2); // Cap zoom at 1.2
            
            const x = (width - boardSize * initialScale) / 2;
            const y = (height - boardSize * initialScale) / 2;
            
            setTransform({ x, y, scale: initialScale });
        }
    }, [level]); // Re-calculate if level changes

    // Initial fit and resize listener
    useEffect(() => {
        fitBoard();
        window.addEventListener('resize', fitBoard);
        setTimeout(fitBoard, 100); // Delay for layout settling
        return () => window.removeEventListener('resize', fitBoard);
    }, [fitBoard]);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            stopTrainLoop();
        };
    }, []);

    // Reset game state on level change
    useEffect(() => {
        setConnections(new Map());
        setEdgeColors(new Map());
        setIsSimulating(false);
        setTrainPosition(null);
        setSimulationMessage(null);
        setDrawMode('add');
        setCollisionCell(null);
        setMissionExpanded(true);
        stopTrainLoop();
    }, [level]);

    // Clear collision effect
    useEffect(() => {
        if (collisionCell) {
            const timer = setTimeout(() => setCollisionCell(null), 300);
            return () => clearTimeout(timer);
        }
    }, [collisionCell]);

    // --- Logic Helpers ---
    const isObstacle = (x: number, y: number) => level.obstacles.some(o => o.x === x && o.y === y);
    const getStationAt = (x: number, y: number) => level.stations.find(s => s.x === x && s.y === y);
    const getEdgeKey = (c1: Coordinate, c2: Coordinate) => [getKey(c1.x, c1.y), getKey(c2.x, c2.y)].sort().join('|');

    const modifyConnection = (c1: Coordinate, c2: Coordinate, mode: 'add' | 'remove') => {
        if (isObstacle(c1.x, c1.y)) { setCollisionCell(c1); playCollisionSound(); onCollision(); return; }
        if (isObstacle(c2.x, c2.y)) { setCollisionCell(c2); playCollisionSound(); onCollision(); return; }

        const k1 = getKey(c1.x, c1.y);
        const k2 = getKey(c2.x, c2.y);
        const edgeKey = getEdgeKey(c1, c2);

        // Check if change is needed BEFORE setting state to trigger sound correctly
        const n1 = connections.get(k1) || [];
        const n2 = connections.get(k2) || [];
        const alreadyConnected = n1.includes(k2);

        // Sound Logic
        if (mode === 'add' && !alreadyConnected) {
            playBuildSound();
        }

        setConnections(prev => {
            const newMap = new Map<string, string[]>(prev);
            const prevN1 = newMap.get(k1) || [];
            const prevN2 = newMap.get(k2) || [];
            if (mode === 'add') {
                if (!prevN1.includes(k2)) newMap.set(k1, [...prevN1, k2]);
                if (!prevN2.includes(k1)) newMap.set(k2, [...prevN2, k1]);
            } else {
                newMap.set(k1, prevN1.filter(k => k !== k2));
                newMap.set(k2, prevN2.filter(k => k !== k1));
            }
            return newMap;
        });

        setEdgeColors(prev => {
            const newMap = new Map(prev);
            mode === 'add' ? newMap.set(edgeKey, activeColor) : newMap.delete(edgeKey);
            return newMap;
        });
    };

    // --- Gesture & Pointer Logic ---
    const getGridCell = (clientX: number, clientY: number) => {
        if (!containerRef.current) return null;
        const rect = containerRef.current.getBoundingClientRect();
        
        const relX = (clientX - rect.left - transform.x) / transform.scale;
        const relY = (clientY - rect.top - transform.y) / transform.scale;

        const x = Math.floor(relX / CELL_SIZE);
        const y = Math.floor(relY / CELL_SIZE);

        if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
            return { x, y };
        }
        return null;
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        // Ensure audio context is ready on first touch
        initAudio(); 
        
        (e.target as Element).setPointerCapture(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointers.current.size === 2) {
            isDraggingView.current = true;
            lastDragCell.current = null;
            prevPinchDiff.current = -1;
        } else if (pointers.current.size === 1 && !isSimulating) {
            isDraggingView.current = false;
            const cell = getGridCell(e.clientX, e.clientY);
            if (cell) {
                lastDragCell.current = cell;
            }
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointers.current.size === 2) {
            const values = Array.from(pointers.current.values());
            const p1 = values[0] as { x: number; y: number };
            const p2 = values[1] as { x: number; y: number };

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const distance = Math.sqrt(dx*dx + dy*dy);

            if (prevPinchDiff.current > 0) {
                const delta = distance - prevPinchDiff.current;
                const zoomFactor = delta * 0.005;
                setTransform(prev => ({
                    ...prev,
                    scale: Math.min(Math.max(0.2, prev.scale + zoomFactor), 3)
                }));
            }
            prevPinchDiff.current = distance;

            // Pan
            setTransform(prev => ({
                ...prev,
                x: prev.x + e.movementX,
                y: prev.y + e.movementY
            }));

        } else if (pointers.current.size === 1 && !isDraggingView.current && !isSimulating) {
            const cell = getGridCell(e.clientX, e.clientY);
            if (!cell || !lastDragCell.current) return;

            if (cell.x === lastDragCell.current.x && cell.y === lastDragCell.current.y) return;

            const dx = Math.abs(cell.x - lastDragCell.current.x);
            const dy = Math.abs(cell.y - lastDragCell.current.y);

            if (dx <= 1 && dy <= 1) {
                modifyConnection(lastDragCell.current, cell, drawMode);
                lastDragCell.current = cell;
            } else {
                lastDragCell.current = cell;
            }
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        pointers.current.delete(e.pointerId);
        (e.target as Element).releasePointerCapture(e.pointerId);
        if (pointers.current.size < 2) {
            isDraggingView.current = false;
            prevPinchDiff.current = -1;
        }
        if (pointers.current.size === 0) {
            lastDragCell.current = null;
        }
    };

    // --- SVG Rendering ---
    const renderTrackSVG = (x: number, y: number) => {
        const k1 = getKey(x, y);
        const neighbors = connections.get(k1) || [];
        if (neighbors.length === 0) return null;

        const center = CELL_SIZE / 2;
        const thickness = 12; // Thicker tracks for better visibility
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
            const dxA = ax - x;
            const dyA = ay - y;
            const txA = center + (dxA * center);
            const tyA = center + (dyA * center);

            let matchedCurve = false;

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
                    
                    if (isOrthoA && isOrthoB && (dxA * dxB + dyA * dyB === 0)) {
                        const txB = center + (dxB * center);
                        const tyB = center + (dyB * center);
                        const pathD = `M ${txA} ${tyA} Q ${center} ${center} ${txB} ${tyB}`;
                        elements.push(<g key={`curve-${kA}-${kB}`}><path d={pathD} stroke="white" strokeWidth={thickness + 6} fill="none" strokeLinecap="round" /><path d={pathD} stroke={colorA} strokeWidth={thickness} fill="none" strokeLinecap="round" /></g>);
                        processed.add(kA); processed.add(kB); matchedCurve = true; break;
                    }
                    else if (isOrthoA && isOrthoB && (dxA === -dxB && dyA === -dyB)) {
                         const txB = center + (dxB * center);
                         const tyB = center + (dyB * center);
                         const pathD = `M ${txA} ${tyA} L ${txB} ${tyB}`;
                         elements.push(<g key={`straight-${kA}-${kB}`}><path d={pathD} stroke="white" strokeWidth={thickness + 6} fill="none" /><path d={pathD} stroke={colorA} strokeWidth={thickness} fill="none" /></g>);
                         processed.add(kA); processed.add(kB); matchedCurve = true; break;
                    }
                }
            }
            if (!matchedCurve) {
                const d = `M ${center} ${center} L ${txA} ${tyA}`;
                elements.push(<g key={`seg-${kA}`}><path d={d} stroke="white" strokeWidth={thickness + 6} fill="none" strokeLinecap="round" /><path d={d} stroke={colorA} strokeWidth={thickness} fill="none" strokeLinecap="round" /></g>);
                processed.add(kA);
            }
        }
        const distinctColors = new Set(neighbors.map(k => getColor(k)));
        if (distinctColors.size > 1 || neighbors.length > 2) {
             elements.push(<circle key="hub" cx={center} cy={center} r={thickness/1.5} fill="white" stroke="#64748b" strokeWidth={1} />);
        }
        return <>{elements}</>;
    };

    // --- Simulation ---
    const startSimulation = async () => {
        if (isSimulating) return;
        setIsSimulating(true);
        setSimulationMessage("Revisando...");
        setMissionExpanded(false); // Collapse header on start
        
        // Start Sound Sequence
        playTrainWhistle(); 
        startTrainLoop(); 

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
                setSimulationMessage(`Sin camino: ${startStation.name} -> ${endStation.name}`);
                setIsSimulating(false);
                stopTrainLoop(); // STOP SOUND
                playCollisionSound(); 
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

        setSimulationMessage("¡Llegamos!");
        stopTrainLoop(); // STOP SOUND
        playWinSound(); 
        await new Promise(r => setTimeout(r, 1000));
        onLevelComplete();
    };

    return (
        <div className="flex flex-col h-full w-full bg-slate-200">
            
            {/* 1. Header Area (Fixed) - Does not overlap board */}
            <div className="bg-white shrink-0 shadow-sm z-30 border-b border-slate-200">
                <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2">
                         <button onClick={() => { stopTrainLoop(); onExit(); }} className="p-1 rounded-full text-slate-400 hover:bg-slate-100"><ArrowLeft size={20}/></button>
                         <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{level.city}</span>
                    </div>
                    <button 
                        onClick={() => setMissionExpanded(!missionExpanded)} 
                        className="flex items-center gap-1 text-slate-500 text-xs font-bold py-1 px-2 rounded hover:bg-slate-50"
                    >
                        MISIÓN {missionExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    </button>
                </div>
                
                {/* Collapsible Mission Text */}
                {missionExpanded && (
                    <div className="px-4 pb-3 animate-in slide-in-from-top-2 duration-200">
                         <p className="text-sm text-slate-800 font-medium leading-relaxed border-l-4 border-indigo-500 pl-3">
                            {level.description}
                         </p>
                    </div>
                )}
            </div>

            {/* 2. Middle Area (Board) - Takes remaining space */}
            <div 
                ref={containerRef}
                className="flex-1 w-full relative touch-none bg-slate-200 overflow-hidden cursor-crosshair"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                {/* Status Toast */}
                {simulationMessage && (
                    <div className="absolute top-4 left-0 right-0 z-50 flex justify-center pointer-events-none">
                        <div className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-xl animate-in fade-in zoom-in ${
                            simulationMessage.includes("Sin camino") ? "bg-rose-500 text-white" : "bg-emerald-500 text-white"
                        }`}>
                            {simulationMessage}
                        </div>
                    </div>
                )}

                {/* Scalable Game Content */}
                <div 
                    style={{ 
                        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                        transformOrigin: '0 0',
                        width: GRID_SIZE * CELL_SIZE,
                        height: GRID_SIZE * CELL_SIZE,
                    }}
                    className="absolute bg-white shadow-2xl rounded-sm will-change-transform"
                >
                     {/* Background Dots */}
                     <div className="absolute inset-0 opacity-20 pointer-events-none"
                         style={{
                            backgroundImage: 'radial-gradient(#64748b 2px, transparent 2px)',
                            backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
                            backgroundPosition: `${CELL_SIZE/2}px ${CELL_SIZE/2}px`
                         }}>
                    </div>

                    {/* Grid Render */}
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
                            const isColliding = collisionCell?.x === x && collisionCell?.y === y;

                            return (
                                <div key={i} className={`relative ${isColliding ? 'bg-red-200/50' : ''}`}>
                                    <div className="absolute inset-0 z-10">
                                        <svg width="100%" height="100%" overflow="visible">
                                            {renderTrackSVG(x, y)}
                                        </svg>
                                    </div>

                                    {/* Obstacles: Bigger Icons */}
                                    {obs && (
                                        <div className={`absolute inset-0 flex items-center justify-center z-20 ${isColliding ? 'scale-110' : ''}`}>
                                            <div className="bg-white/90 p-1 rounded-xl shadow-sm border border-slate-100">
                                                {obs.type === CellType.OBSTACLE_WATER && <Droplets size={CELL_SIZE * 0.7} className="text-sky-500" />}
                                                {obs.type === CellType.OBSTACLE_FOSSIL && <Skull size={CELL_SIZE * 0.7} className="text-amber-600" />}
                                                {obs.type === CellType.OBSTACLE_TUNNEL && <Pickaxe size={CELL_SIZE * 0.7} className="text-slate-400" />}
                                            </div>
                                        </div>
                                    )}

                                    {/* Stations: Bigger Circles & Text */}
                                    {station && (
                                        <div className="absolute inset-0 flex items-center justify-center z-30">
                                            <div className={`
                                                rounded-full border-[5px] flex items-center justify-center bg-white shadow-md z-10
                                                ${isStart ? 'border-emerald-500 w-[85%] h-[85%]' : 
                                                  isEnd ? 'border-rose-500 w-[85%] h-[85%]' : 
                                                  routeIndex > 0 ? 'border-amber-400 w-[75%] h-[75%]' :
                                                   'border-slate-300 w-[60%] h-[60%]' }
                                            `}>
                                                {routeIndex !== -1 && (
                                                    <span className="text-base font-black text-slate-800">{routeIndex + 1}</span>
                                                )}
                                            </div>
                                            
                                            {/* Station Labels - Bigger Text */}
                                            <div className="absolute -top-[55%] left-1/2 -translate-x-1/2 z-40 pointer-events-none">
                                                <div className="bg-slate-900/90 text-xs leading-none font-bold text-white px-2 py-1 rounded-md shadow-lg whitespace-nowrap backdrop-blur-sm border border-white/20">
                                                    {station.name}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {trainPosition && (
                        <div 
                            className="absolute z-50 transition-all duration-150 ease-linear pointer-events-none"
                            style={{
                                left: trainPosition.x * CELL_SIZE,
                                top: trainPosition.y * CELL_SIZE,
                                width: CELL_SIZE,
                                height: CELL_SIZE,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            <div className="bg-yellow-400 text-black p-2 rounded-xl shadow-xl scale-125 ring-2 ring-white">
                                <TrainFront size={CELL_SIZE * 0.7} fill="currentColor" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Bottom Controls (Fixed) */}
            <div className="bg-white border-t border-slate-200 px-3 pb-4 pt-2 shrink-0 z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
                
                {/* Row 1: Tools & Play */}
                <div className="flex gap-2 mb-3">
                     <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setDrawMode('add')}
                            className={`p-2 rounded-lg transition-all ${
                                drawMode === 'add' ? 'bg-white shadow text-slate-800' : 'text-slate-400'
                            }`}
                        >
                            <Pencil size={20} />
                        </button>
                        <button
                            onClick={() => setDrawMode('remove')}
                            className={`p-2 rounded-lg transition-all ${
                                drawMode === 'remove' ? 'bg-white shadow text-rose-600' : 'text-slate-400'
                            }`}
                        >
                            <Eraser size={20} />
                        </button>
                     </div>

                    {/* Reset Button: Clears + Resets View */}
                    <button 
                        onClick={() => { 
                            setConnections(new Map()); 
                            setEdgeColors(new Map());
                            fitBoard(); // Reset viewport
                        }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:text-rose-600 active:bg-slate-200"
                    >
                        <RotateCcw size={18} />
                    </button>

                     <button 
                        onClick={startSimulation}
                        disabled={isSimulating}
                        className={`flex-1 h-10 rounded-xl font-bold text-sm tracking-wide shadow-sm flex items-center justify-center gap-2 transform active:scale-95 transition-all ${
                            isSimulating 
                            ? 'bg-slate-100 text-slate-400' 
                            : 'bg-indigo-600 text-white shadow-indigo-200'
                        }`}
                    >
                        {isSimulating ? '...' : 'ARRANCAR'}
                        {!isSimulating && <Play size={16} fill="currentColor" />}
                    </button>
                </div>

                {/* Row 2: Colors */}
                <div className="flex justify-between items-center px-1">
                    {TRACK_COLORS.map(c => (
                        <button
                            key={c.name}
                            onClick={() => { setActiveColor(c.hex); setDrawMode('add'); }}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform ${
                                activeColor === c.hex && drawMode === 'add' 
                                ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' 
                                : 'opacity-80 scale-95'
                            }`}
                            style={{ backgroundColor: c.hex }}
                        >
                            <span className="text-[10px] font-bold text-white drop-shadow-md">{c.name}</span>
                        </button>
                    ))}
                </div>
            </div>
            
        </div>
    );
};

export default Board;