import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

// Types
export interface TimerState {
  isActive: boolean;
  duration: number; // Total seconds
  remaining: number; // Seconds left
  label?: string;
}

export interface WeatherState {
  isVisible: boolean;
  data: any | null;
  lastUpdated: number;
}

interface GlobalContextType {
  timer: TimerState;
  weather: WeatherState;
  startTimer: (duration: number) => void;
  stopTimer: () => void;
  updateWeather: (data: any) => void;
  closeWeather: () => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export const GlobalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- TIMER STATE ---
  const [timer, setTimer] = useState<TimerState>({ isActive: false, duration: 0, remaining: 0 });
  const timerInterval = useRef<any>(null);

  // --- WEATHER STATE ---
  const [weather, setWeather] = useState<WeatherState>({ isVisible: false, data: null, lastUpdated: 0 });

  // --- TIMER LOGIC ---
  const startTimer = (duration: number) => {
    // Clear existing
    if (timerInterval.current) clearInterval(timerInterval.current);

    setTimer({ isActive: true, duration, remaining: duration });

    timerInterval.current = setInterval(() => {
      setTimer(prev => {
        if (prev.remaining <= 1) {
          // Timer Finished
          clearInterval(timerInterval.current);
          handleTimerEnd();
          return { ...prev, isActive: false, remaining: 0 };
        }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerInterval.current) clearInterval(timerInterval.current);
    setTimer(prev => ({ ...prev, isActive: false }));
  };

  const handleTimerEnd = () => {
    // 1. Play Sound
    const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
    audio.play().catch(e => console.error("Audio play failed", e));
    
    // 2. Browser Notification (if allowed)
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Kaniska Timer", { body: "Your timer has finished!" });
    }
    
    // 3. Keep UI visible for a moment showing 00:00
    setTimeout(() => {
        setTimer(prev => ({ ...prev, isActive: false, remaining: 0, duration: 0 }));
    }, 5000);
  };

  // --- WEATHER LOGIC ---
  const updateWeather = (data: any) => {
    setWeather({ isVisible: true, data, lastUpdated: Date.now() });
    // Auto hide after 15 seconds if no interaction
    setTimeout(() => {
        setWeather(prev => ({ ...prev, isVisible: false }));
    }, 15000);
  };

  const closeWeather = () => {
    setWeather(prev => ({ ...prev, isVisible: false }));
  };

  // --- EVENT LISTENERS (Bridge from api.ts) ---
  useEffect(() => {
    const handleTimerEvent = (e: CustomEvent) => {
      const { duration } = e.detail;
      startTimer(duration);
    };

    const handleWeatherEvent = (e: CustomEvent) => {
      const { data } = e.detail;
      updateWeather(data);
    };

    const handlePhoneControlEvent = (e: CustomEvent) => {
        const { action, value } = e.detail;
        console.log("Phone Control Triggered:", action, value);
        // Visual feedback could be added here
    };

    window.addEventListener('kaniska-timer-start' as any, handleTimerEvent);
    window.addEventListener('kaniska-weather-update' as any, handleWeatherEvent);
    window.addEventListener('kaniska-phone-control' as any, handlePhoneControlEvent);

    return () => {
      window.removeEventListener('kaniska-timer-start' as any, handleTimerEvent);
      window.removeEventListener('kaniska-weather-update' as any, handleWeatherEvent);
      window.removeEventListener('kaniska-phone-control' as any, handlePhoneControlEvent);
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, []);

  return (
    // FIX: Using React.createElement since JSX might be an issue in some environments, but assuming standard React setup here.
    <GlobalContext.Provider value={{ timer, weather, startTimer, stopTimer, updateWeather, closeWeather }}>
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobalState = () => {
  const context = useContext(GlobalContext);
  if (!context) throw new Error("useGlobalState must be used within GlobalProvider");
  return context;
};