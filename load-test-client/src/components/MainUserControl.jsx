import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { clsx } from 'clsx';

const API_URL = 'http://localhost:3000/api';

export default function MainUserControl({ socket, userId, balance, stats }) {
    const [vibrationEnabled, setVibrationEnabled] = useState(true);

    useEffect(() => {
        if (vibrationEnabled && stats.totalWon > 0 && navigator.vibrate) {
            // Subtle vibration on win if stats change
            navigator.vibrate([100, 50, 100]);
        }
    }, [stats.totalWon, vibrationEnabled]);

    const profitLoss = stats.totalWon - stats.totalWagered;

    return (
        <div className="bg-gradient-to-br from-indigo-900/80 to-purple-900/80 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-indigo-700/30 flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-500">
            <div className="flex items-center gap-6 w-full md:w-auto">
                <div className="bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20">
                    <h2 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-1">Active Pilot</h2>
                    <div className="text-xl font-black text-white font-mono tracking-tighter">
                        PILOT <span className="text-indigo-500">#{userId.slice(0, 8).toUpperCase()}</span>
                    </div>
                </div>

                <div className="h-12 w-px bg-white/5 hidden md:block"></div>

                <div>
                    <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest mb-1 opacity-60">Real-Time Balance</div>
                    <div className="text-4xl font-black text-white font-mono tracking-tight drop-shadow-xl flex items-baseline gap-2">
                        <span className="text-indigo-400 text-2xl font-bold">$</span>
                        {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            {/* Lifetime Stats Panel */}
            <div className="flex-1 flex justify-around bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/5 w-full md:max-w-2xl">
                <div className="flex flex-col items-center">
                    <span className="text-[10px] text-indigo-400 font-black uppercase tracking-widest opacity-70">Flights</span>
                    <span className="text-xl font-black text-white font-mono mt-1">{stats.totalBets}</span>
                </div>
                <div className="w-px h-8 bg-white/5 self-center"></div>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] text-indigo-400 font-black uppercase tracking-widest opacity-70">Wagered</span>
                    <span className="text-xl font-black text-white font-mono mt-1">${stats.totalWagered.toLocaleString()}</span>
                </div>
                <div className="w-px h-8 bg-white/5 self-center"></div>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] text-indigo-400 font-black uppercase tracking-widest opacity-70">Total Won</span>
                    <span className="text-xl font-black text-emerald-400 font-mono mt-1">${stats.totalWon.toLocaleString()}</span>
                </div>
                <div className="w-px h-8 bg-white/5 self-center"></div>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] text-indigo-400 font-black uppercase tracking-widest opacity-70">Net P/L</span>
                    <span className={clsx(
                        "text-xl font-black font-mono mt-1",
                        profitLoss >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                        {profitLoss >= 0 ? '+' : ''}${profitLoss.toLocaleString()}
                    </span>
                </div>
            </div>

            <button
                onClick={() => setVibrationEnabled(!vibrationEnabled)}
                className={clsx(
                    "px-4 py-2 rounded-xl border-2 transition-all text-[10px] font-black uppercase tracking-widest",
                    vibrationEnabled
                        ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30"
                        : "bg-gray-800/50 text-gray-500 border-gray-700/50 grayscale"
                )}
            >
                Haptics: {vibrationEnabled ? 'ON' : 'OFF'}
            </button>
        </div>
    );
}
