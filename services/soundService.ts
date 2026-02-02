// Simple synthesizer for game sound effects to avoid external asset dependencies
let audioCtx: AudioContext | null = null;
let trainLoopInterval: number | null = null;
let pinkNoiseBuffer: AudioBuffer | null = null;

const getContext = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
};

// Generate Pink Noise (better for machinery/earth sounds than White Noise)
const getPinkNoiseBuffer = (ctx: AudioContext) => {
    if (pinkNoiseBuffer) return pinkNoiseBuffer;
    
    const bufferSize = ctx.sampleRate * 2; // 2 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    let b0, b1, b2, b3, b4, b5, b6;
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
    
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        data[i] *= 0.11; // Validate amplitude
        b6 = white * 0.115926;
    }
    pinkNoiseBuffer = buffer;
    return buffer;
};

export const initAudio = () => {
    const ctx = getContext();
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
    // Pre-generate buffers
    getPinkNoiseBuffer(ctx);
};

export const playBuildSound = () => {
    const ctx = getContext();
    const t = ctx.currentTime;

    // 1. "Thump" - Cuerpo del sonido (Grave y seco, estilo golpe en bloque)
    const osc = ctx.createOscillator();
    osc.type = 'triangle'; 
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.08); // Caída rápida de tono para el golpe

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.8, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start();
    osc.stop(t + 0.1);

    // 2. "Crunch" - Textura (Ruido rosa con corte rápido)
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = getPinkNoiseBuffer(ctx);
    
    // Filtro paso bajo que se cierra para simular el sonido sordo de la tierra
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(2500, t); 
    noiseFilter.frequency.exponentialRampToValueAtTime(100, t + 0.08); 

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1); // Duración muy corta (pop)

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    
    noiseSrc.start();
    noiseSrc.stop(t + 0.15);
};

export const playCollisionSound = () => {
    const ctx = getContext();
    const t = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(100, t);
    osc1.frequency.linearRampToValueAtTime(20, t + 0.3);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc1.connect(gain);
    gain.connect(ctx.destination);
    
    osc1.start();
    osc1.stop(t + 0.3);
};

export const playWinSound = () => {
    const ctx = getContext();
    const t = ctx.currentTime;

    const playNote = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
    };

    // Major Arpeggio Fanfare
    playNote(523.25, t, 0.2);       // C5
    playNote(659.25, t + 0.1, 0.2); // E5
    playNote(783.99, t + 0.2, 0.2); // G5
    playNote(1046.50, t + 0.4, 0.6);// C6
};

export const playTrainWhistle = () => {
    const ctx = getContext();
    const t = ctx.currentTime;

    const playTone = (freq: number) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;

        // Lowpass to make it sound more like a horn
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.1);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.4);
        gain.gain.linearRampToValueAtTime(0, t + 0.6);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + 0.6);
    };

    // Two tones for a chord
    playTone(293.66); // D4
    playTone(369.99); // F#4
};

// --- Continuous Train Loop ---

export const startTrainLoop = () => {
    if (trainLoopInterval) return; // Already running

    const ctx = getContext();
    const playChug = () => {
        const t = ctx.currentTime;
        
        // Pink noise burst
        const src = ctx.createBufferSource();
        src.buffer = getPinkNoiseBuffer(ctx);
        src.loop = true;

        // Filter to make it sound "steamy" and mechanical
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 400; 
        filter.Q.value = 1;

        const gain = ctx.createGain();
        // Rhythm envelope: Quick attack, decay
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.4, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        src.start(t);
        src.stop(t + 0.16);
    };

    // Play first one immediately
    playChug();
    
    // Schedule loop approx every 180ms (fast chug)
    trainLoopInterval = window.setInterval(() => {
        if (ctx.state === 'running') playChug();
    }, 180);
};

export const stopTrainLoop = () => {
    if (trainLoopInterval) {
        clearInterval(trainLoopInterval);
        trainLoopInterval = null;
    }
};