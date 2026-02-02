import React, { useState, useEffect } from 'react';
import { CITIES, LevelConfig } from './types';
import { generateLevel } from './services/levelGenerator';
import { initAudio } from './services/soundService';
import Board from './components/Board';
import { TrainFront, MapPin, PlayCircle, Loader2, Building2, Globe2, ChevronDown } from 'lucide-react';

enum AppState {
    MENU,
    LOADING_LEVEL,
    PLAYING,
    LEVEL_COMPLETE
}

const STORAGE_KEY = 'subway_weaver_progress_v1';

// Mapping icons to cities for visual flair
const CITY_ICONS: Record<string, React.ReactNode> = {
    "Buenos Aires": <Building2 size={18} />,
    "Nueva York": <Building2 size={18} />,
    "Londres": <Globe2 size={18} />,
    "París": <Globe2 size={18} />,
    "Tokio": <Building2 size={18} />,
    "Berlín": <Globe2 size={18} />,
    "Madrid": <Building2 size={18} />
};

const App: React.FC = () => {
    const [appState, setAppState] = useState<AppState>(AppState.MENU);
    const [selectedCity, setSelectedCity] = useState<string>(CITIES[0]);
    const [difficulty, setDifficulty] = useState<number>(1);
    const [currentLevel, setCurrentLevel] = useState<LevelConfig | null>(null);
    const [progress, setProgress] = useState<Record<string, number>>({});
    const [isShaking, setIsShaking] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try { setProgress(JSON.parse(saved)); } catch (e) { console.error("Error loading save", e); }
        }
    }, []);

    const saveProgress = (city: string, level: number) => {
        const newProgress = { ...progress, [city]: level };
        setProgress(newProgress);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newProgress));
    };

    const handleStartGame = async () => {
        initAudio(); // Wake up audio context
        const savedDifficulty = progress[selectedCity] || 1;
        setDifficulty(savedDifficulty);
        setAppState(AppState.LOADING_LEVEL);
        const level = await generateLevel(selectedCity, savedDifficulty);
        setCurrentLevel(level);
        setAppState(AppState.PLAYING);
    };

    const handleLevelComplete = () => {
        setAppState(AppState.LEVEL_COMPLETE);
    };

    const handleNextLevel = async () => {
        const nextDiff = Math.min(difficulty + 1, 5);
        setDifficulty(nextDiff);
        saveProgress(selectedCity, nextDiff);
        setAppState(AppState.LOADING_LEVEL);
        const level = await generateLevel(selectedCity, nextDiff);
        setCurrentLevel(level);
        setAppState(AppState.PLAYING);
    };

    const handleBackToMenu = () => {
        if (appState !== AppState.MENU) setAppState(AppState.MENU);
    };

    const triggerScreenShake = () => {
        if (isShaking) return;
        setIsShaking(true);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        setTimeout(() => setIsShaking(false), 400);
    };

    return (
        <div className={`h-[100dvh] w-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 transition-colors ${isShaking ? 'collision-shake' : ''}`}>
            
            {/* Conditional Header - Hidden during gameplay */}
            {appState !== AppState.PLAYING && appState !== AppState.MENU && (
                <header className="px-4 py-3 bg-white border-b border-slate-200 shadow-sm shrink-0 z-50">
                    <div className="max-w-6xl mx-auto flex justify-between items-center">
                        <div 
                            className="flex items-center gap-2 cursor-pointer hover:opacity-70"
                            onClick={handleBackToMenu}
                        >
                            <div className="bg-slate-900 p-1.5 rounded-lg shadow-md">
                                <TrainFront size={20} className="text-white" />
                            </div>
                            <h1 className="text-lg font-bold tracking-tight text-slate-900">
                                Tejedor de Subtes
                            </h1>
                        </div>
                    </div>
                </header>
            )}

            {/* Main Content Area */}
            <main className="flex-1 relative flex flex-col w-full h-full overflow-hidden">
                
                {/* MENU SCREEN: Spectacular Overhaul */}
                {appState === AppState.MENU && (
                    <div className="absolute inset-0 w-full h-full bg-slate-900">
                        {/* Dramatic Background Image with Animation and Fallback Gradient */}
                        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-950 to-black">
                            <img 
                                src="/intro.jpg" 
                                className="w-full h-full object-cover opacity-60 scale-105 animate-[pulse_10s_ease-in-out_infinite]"
                                alt="Subway Tunnel"
                            />
                            {/* Overlay Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-slate-900/40"></div>
                        </div>

                        {/* Menu Content */}
                        <div className="relative z-10 flex flex-col justify-end h-full pb-16 px-6 animate-in fade-in slide-in-from-bottom-12 duration-1000">
                             <div className="mb-8 space-y-2">
                                <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase backdrop-blur-sm">
                                    <TrainFront size={12} />
                                    Simulación de Tránsito
                                </div>
                                <h1 className="text-5xl font-black text-white tracking-tighter leading-tight drop-shadow-2xl">
                                    TEJEDOR DE<br/>
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300">SUBTES</span>
                                </h1>
                                <p className="text-slate-300 max-w-xs text-sm font-medium leading-relaxed drop-shadow-md">
                                    Diseñá redes imposibles en ciudades reales. Evitá el caos.
                                </p>
                             </div>

                             {/* Control Panel Card */}
                             <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-5 rounded-3xl shadow-2xl space-y-5">
                                 
                                 {/* Custom Combobox for City Selection */}
                                 <div className="space-y-2">
                                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Destino</label>
                                     <div className="relative group">
                                         <div className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none group-focus-within:text-indigo-300">
                                            {CITY_ICONS[selectedCity] || <MapPin size={18} />}
                                         </div>
                                         <select 
                                            value={selectedCity}
                                            onChange={(e) => setSelectedCity(e.target.value)}
                                            className="w-full appearance-none bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-2xl py-4 pl-12 pr-10 text-white font-bold text-lg shadow-inner outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                                         >
                                             {CITIES.map(city => (
                                                 <option key={city} value={city} className="bg-slate-900 text-white">
                                                     {city} {progress[city] ? `(Nvl ${progress[city]})` : ''}
                                                 </option>
                                             ))}
                                         </select>
                                         <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                                             <ChevronDown size={20} />
                                         </div>
                                     </div>
                                 </div>

                                 <button 
                                     onClick={handleStartGame}
                                     className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] text-white text-lg font-black tracking-wide rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all flex items-center justify-center gap-3 border border-indigo-400/20"
                                 >
                                     <PlayCircle size={24} fill="white" className="text-indigo-600" />
                                     <span>{progress[selectedCity] && progress[selectedCity] > 1 ? 'CONTINUAR' : 'INICIAR VIAJE'}</span>
                                 </button>
                             </div>
                        </div>
                    </div>
                )}

                {appState === AppState.LOADING_LEVEL && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-slate-950 z-50">
                        <Loader2 size={48} className="animate-spin text-indigo-500" />
                        <p className="text-xl text-white font-bold animate-pulse tracking-wide">Viajando a {selectedCity}...</p>
                    </div>
                )}

                {appState === AppState.PLAYING && currentLevel && (
                    <div className="w-full h-full flex flex-col animate-in fade-in duration-500 bg-slate-50">
                        <Board 
                            level={currentLevel} 
                            onLevelComplete={handleLevelComplete} 
                            onCollision={triggerScreenShake}
                            onExit={handleBackToMenu}
                        />
                    </div>
                )}

                {appState === AppState.LEVEL_COMPLETE && (
                    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center space-y-6 animate-in zoom-in-95 duration-300 border-4 border-indigo-100">
                             <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-full shadow-inner animate-bounce">
                                <TrainFront size={40} className="text-emerald-600" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">¡EXCELENTE!</h2>
                            <div className="flex flex-col gap-3">
                                <button onClick={handleNextLevel} className="w-full py-4 rounded-xl bg-slate-900 text-white font-bold shadow-lg active:scale-95 transition-transform">Siguiente Nivel</button>
                                <button onClick={handleBackToMenu} className="w-full py-4 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50">Volver al Menú</button>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
};

export default App;