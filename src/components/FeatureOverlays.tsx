import React from 'react';
import { useGlobalState } from '../context/GlobalState.tsx';

// Icons using React.createElement for consistency if needed, but JSX is cleaner
const ClockIcon = ({ className }: any) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

const CloudSunIcon = ({ className }: any) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v2"></path>
    <path d="m4.93 4.93 1.41 1.41"></path>
    <path d="M20 12h2"></path>
    <path d="m19.07 4.93-1.41 1.41"></path>
    <path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"></path>
    <path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"></path>
  </svg>
);

const XIcon = ({ className }: any) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

export const FeatureOverlays = () => {
    const { timer, weather, stopTimer, closeWeather } = useGlobalState();

    // Calculate Timer Progress for Circle
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const progress = timer.duration > 0 ? (timer.remaining / timer.duration) * circumference : 0;
    const dashoffset = circumference - progress;

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed top-24 left-0 right-0 z-30 pointer-events-none flex flex-col items-center gap-4 px-4">
            
            {/* --- TIMER WIDGET --- */}
            {(timer.isActive || timer.remaining > 0) && (
                <div className="feature-widget pointer-events-auto flex items-center gap-4 p-4 min-w-[200px] animate-fade-in timer-active">
                    <div className="relative w-16 h-16 flex items-center justify-center">
                        {/* Background Circle */}
                        <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                            <circle 
                                stroke="rgba(255,255,255,0.1)" 
                                strokeWidth="4" 
                                fill="transparent" 
                                r={radius} 
                                cx="32" 
                                cy="32" 
                            />
                            <circle 
                                className="timer-progress-ring"
                                stroke="#22d3ee" 
                                strokeWidth="4" 
                                fill="transparent" 
                                r={radius} 
                                cx="32" 
                                cy="32"
                                style={{ strokeDasharray: circumference, strokeDashoffset: dashoffset }}
                            />
                        </svg>
                        <ClockIcon className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Timer</h3>
                        <div className="text-2xl font-mono font-bold text-white">{formatTime(timer.remaining)}</div>
                    </div>
                    <button onClick={stopTimer} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <XIcon className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
            )}

            {/* --- WEATHER WIDGET --- */}
            {weather.isVisible && weather.data && (
                <div className="feature-widget pointer-events-auto p-0 min-w-[280px] animate-fade-in">
                    <div className="bg-gradient-to-r from-blue-600 to-cyan-500 p-4 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <CloudSunIcon className="w-5 h-5 text-white" />
                            <span className="font-bold text-white">Weather Update</span>
                         </div>
                         <button onClick={closeWeather} className="text-white/80 hover:text-white">
                            <XIcon className="w-4 h-4" /> 
                         </button>
                    </div>
                    <div className="p-4 flex items-center gap-4">
                        <div className="weather-icon-anim">
                            {/* Use weather icon from API or fallback */}
                            {weather.data.current?.condition?.icon 
                            ? <img src={`https:${weather.data.current.condition.icon}`} className="w-16 h-16 drop-shadow-lg" />
                            : <CloudSunIcon className="w-12 h-12 text-yellow-400" />
                            }
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-white">{weather.data.current?.temp_c}°C</div>
                            <div className="text-sm text-gray-300">{weather.data.current?.condition?.text}</div>
                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <span>📍</span>
                                {weather.data.location?.name}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};