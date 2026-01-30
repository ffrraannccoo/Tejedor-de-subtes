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

    // Load progress on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                setProgress(JSON.parse(saved));
            } catch (e) {
                console.error("Error loading save", e);
            }
        }
    }, []);

    const saveProgress = (city: string, level: number) => {
        const newProgress = { ...progress, [city]: level };
        setProgress(newProgress);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newProgress));
    };

    const handleStartGame = async () => {
        // Load saved difficulty for this city, default to 1
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
        
        // Save progress immediately when advancing
        saveProgress(selectedCity, nextDiff);

        setAppState(AppState.LOADING_LEVEL);
        const level = await generateLevel(selectedCity, nextDiff);
        setCurrentLevel(level);
        setAppState(AppState.PLAYING);
    };

    const handleBackToMenu = () => {
        if (appState !== AppState.MENU) {
            setAppState(AppState.MENU);
        }
    };

    const triggerScreenShake = () => {
        if (isShaking) return;
        setIsShaking(true);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        setTimeout(() => setIsShaking(false), 400);
    };

    return (
        <div className={`min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-indigo-100 transition-colors ${isShaking ? 'collision-shake' : ''}`}>
            {/* Header */}
            <header className="px-4 py-3 md:px-6 md:py-4 bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div 
                        className={`flex items-center gap-2 md:gap-3 transition-opacity ${appState !== AppState.MENU ? 'cursor-pointer hover:opacity-70' : ''}`}
                        onClick={handleBackToMenu}
                        title={appState !== AppState.MENU ? "Volver al Menú" : ""}
                    >
                        <div className="bg-slate-900 p-1.5 md:p-2 rounded-lg shadow-md">
                            <TrainFront size={20} className="text-white md:w-6 md:h-6" />
                        </div>
                        <h1 className="text-lg md:text-2xl font-bold tracking-tight text-slate-900">
                            Tejedor de Subtes
                        </h1>
                    </div>
                    {appState === AppState.PLAYING && (
                        <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1 md:px-4 md:py-1.5 rounded-full border border-slate-200">
                            <span className="flex items-center gap-1">
                                <MapPin size={14} className="text-indigo-600" /> 
                                <span className="hidden sm:inline">{selectedCity}</span>
                                <span className="sm:hidden">{selectedCity.substring(0, 3)}</span>
                            </span>
                            <span className="w-px h-3 md:h-4 bg-slate-300"></span>
                            <span className="uppercase tracking-widest font-bold text-slate-500">
                                Nivel {difficulty}
                            </span>
                        </div>
                    )}
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 relative">
                
                {/* Background decorative elements */}
                <div className="absolute inset-0 z-0 opacity-30 pointer-events-none" 
                     style={{
                        backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                        backgroundSize: '20px 20px'
                     }}>
                </div>

                {appState === AppState.MENU && (
                    <div className="relative z-10 max-w-lg w-full space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="text-center space-y-4">
                            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Armá tu Red de Subte</h2>
                            <p className="text-base md:text-lg text-slate-500 leading-relaxed px-4">
                                Conectá las estaciones, esquivá los líos y hacé que la gente llegue a tiempo.
                            </p>
                        </div>

                        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 space-y-6 md:space-y-8">
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
                                                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg scale-[1.02]' 
                                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                                                }`}
                                            >
                                                <span>{city}</span>
                                                {level > 1 && (
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${selectedCity === city ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-500'}`}>
                                                        Nvl {level}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <button 
                                onClick={handleStartGame}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                            >
                                <PlayCircle size={24} />
                                {progress[selectedCity] && progress[selectedCity] > 1 ? 'Continuar' : 'Arrancar'}
                            </button>
                        </div>
                    </div>
                )}

                {appState === AppState.LOADING_LEVEL && (
                    <div className="flex flex-col items-center gap-6 animate-pulse z-10">
                        <div className="bg-white p-4 rounded-full shadow-xl">
                            <Loader2 size={40} className="animate-spin text-indigo-600" />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="text-xl text-slate-800 font-medium">Escaneando {selectedCity}...</p>
                            <p className="text-slate-500">Preparando el terreno y las estaciones</p>
                        </div>
                    </div>
                )}

                {appState === AppState.PLAYING && currentLevel && (
                    <div className="w-full max-w-6xl animate-in fade-in zoom-in-95 duration-500 z-10">
                        <Board 
                            level={currentLevel} 
                            onLevelComplete={handleLevelComplete} 
                            onCollision={triggerScreenShake}
                        />
                    </div>
                )}

                {appState === AppState.LEVEL_COMPLETE && (
                    <div className="text-center space-y-8 animate-in zoom-in duration-300 z-10 bg-white p-8 md:p-12 rounded-3xl shadow-2xl border border-slate-100 max-w-lg mx-4">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-2">
                            <TrainFront size={40} className="text-green-600" />
                        </div>
                        
                        <div className="space-y-2">
                            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900">¡Recorrido Aprobado!</h2>
                            <p className="text-lg text-slate-500">La red funciona de diez y el pasajero llegó joya.</p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                            <button 
                                onClick={handleBackToMenu}
                                className="px-6 py-3 rounded-lg bg-white border-2 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 font-bold transition-colors"
                            >
                                Menú
                            </button>
                            <button 
                                onClick={handleNextLevel}
                                className="px-8 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-lg shadow-slate-900/20 transition-all flex items-center justify-center gap-2"
                            >
                                Siguiente Nivel
                            </button>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
};

export default App;