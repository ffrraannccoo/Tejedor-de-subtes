import React, { useState, useEffect } from 'react';
import { CITIES, LevelConfig } from './types';
import { generateLevel } from './services/levelGenerator';
import Board from './components/Board';
import { TrainFront, MapPin, PlayCircle, Loader2 } from 'lucide-react';

enum AppState {
    MENU,
    LOADING_LEVEL,
    PLAYING,
    LEVEL_COMPLETE
}

const STORAGE_KEY = 'subway_weaver_progress_v1';

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
        <div className={`h-screen w-screen overflow-hidden bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-indigo-100 transition-colors ${isShaking ? 'collision-shake' : ''}`}>
            
            {/* Conditional Header - Hidden during gameplay to save space for the board */}
            {appState !== AppState.PLAYING && (
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

            {/* In-Game Minimal Header (Overlaid inside Board in Board.tsx usually, but we keep a back button here if needed? 
                Actually, Board.tsx now handles the UI overlay. We just need a container for the app states.) 
            */}
            
            {/* Main Content Area */}
            <main className="flex-1 relative flex flex-col w-full h-full overflow-hidden">
                
                {appState === AppState.MENU && (
                    <div className="absolute inset-0 overflow-auto p-4 flex flex-col items-center">
                        <div className="max-w-lg w-full space-y-8 mt-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                             <div className="text-center space-y-4">
                                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Armá tu Red</h2>
                                <p className="text-slate-500 leading-relaxed">Conectá las estaciones, esquivá los líos y hacé que la gente llegue a tiempo.</p>
                            </div>

                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl space-y-6">
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Elegí la Ciudad</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {CITIES.map(city => {
                                            const level = progress[city] || 1;
                                            return (
                                                <button
                                                    key={city}
                                                    onClick={() => setSelectedCity(city)}
                                                    className={`px-4 py-3 rounded-xl text-left transition-all border font-medium flex justify-between items-center ${
                                                        selectedCity === city 
                                                        ? 'bg-slate-900 text-white border-slate-900 shadow-lg' 
                                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <span>{city}</span>
                                                    {level > 1 && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-200">Nvl {level}</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <button 
                                    onClick={handleStartGame}
                                    className="w-full py-4 bg-indigo-600 active:bg-indigo-800 text-white text-lg font-bold rounded-xl shadow-lg transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <PlayCircle size={24} />
                                    {progress[selectedCity] && progress[selectedCity] > 1 ? 'Continuar' : 'Arrancar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {appState === AppState.LOADING_LEVEL && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-slate-50 z-50">
                        <Loader2 size={48} className="animate-spin text-indigo-600" />
                        <p className="text-xl text-slate-800 font-medium animate-pulse">Viajando a {selectedCity}...</p>
                    </div>
                )}

                {appState === AppState.PLAYING && currentLevel && (
                    <div className="w-full h-full animate-in fade-in duration-500">
                        <Board 
                            level={currentLevel} 
                            onLevelComplete={handleLevelComplete} 
                            onCollision={triggerScreenShake}
                        />
                        {/* Floating Back Button for Game Mode */}
                        <button 
                            onClick={handleBackToMenu}
                            className="absolute top-4 right-4 z-[60] p-2 bg-white/90 backdrop-blur rounded-full shadow-md border border-slate-200 text-slate-400 hover:text-slate-700"
                        >
                            <TrainFront size={20} />
                        </button>
                    </div>
                )}

                {appState === AppState.LEVEL_COMPLETE && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
                             <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full">
                                <TrainFront size={40} className="text-green-600" />
                            </div>
                            <h2 className="text-3xl font-extrabold text-slate-900">¡Excelente!</h2>
                            <div className="flex flex-col gap-3">
                                <button onClick={handleNextLevel} className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold shadow-lg">Siguiente Nivel</button>
                                <button onClick={handleBackToMenu} className="w-full py-3 rounded-xl border-2 border-slate-100 text-slate-600 font-bold">Menú</button>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
};

export default App;