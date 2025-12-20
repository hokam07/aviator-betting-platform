import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { clsx } from 'clsx';

const API_URL = 'http://localhost:3000/api';
const WHALE_USER_ID = '11111111-1111-1111-1111-111111111111';

export default function MainUserControl({ socket }) {
    const [balance, setBalance] = useState(0);
    const [autoBet, setAutoBet] = useState(false);
    const [betAmount, setBetAmount] = useState(100);
    const [loading, setLoading] = useState(false);
    const [vibrationEnabled, setVibrationEnabled] = useState(true);
    const [stats, setStats] = useState({
        totalBets: 0,
        totalWagered: 0,
        totalWon: 0
    });

    useEffect(() => {
        if (!socket) return;
        
        socket.emit('subscribe', WHALE_USER_ID);
        
        const handleBalance = (data) => {
            if (data.user_id === WHALE_USER_ID) {
                setBalance(data.balance);
            }
        };

        const handlePublicFeed = (data) => {
            if (data.user_id === WHALE_USER_ID) {
                if (data.type === 'bet') {
                    setStats(prev => ({
                        ...prev,
                        totalBets: prev.totalBets + 1,
                        totalWagered: prev.totalWagered + data.amount
                    }));
                } else if (data.type === 'win') {
                    setStats(prev => ({
                        ...prev,
                        totalWon: prev.totalWon + data.amount
                    }));

                    // Haptic Feedback
                    if (vibrationEnabled && navigator.vibrate) {
                        navigator.vibrate([100, 50, 100]);
                    }
                }
            }
        };

        socket.on('balance_update', handleBalance);
        socket.on('public_feed', handlePublicFeed);

        // Initial fetch: Balance
        axios.get(`${API_URL}/balance/${WHALE_USER_ID}`)
             .then(res => setBalance(res.data.balance))
             .catch(err => console.error(err));

        // Initial fetch: Lifetime Stats from Read-Through Cache
        axios.get(`${API_URL}/user/stats/${WHALE_USER_ID}`)
             .then(res => {
                setStats({
                    totalBets: res.data.total_bet_count,
                    totalWagered: res.data.total_wagered_amount,
                    totalWon: res.data.total_won_amount
                });
             })
             .catch(err => console.error('Failed to fetch stats:', err));

        return () => {
            socket.off('balance_update', handleBalance);
            socket.off('public_feed', handlePublicFeed);
        };
    }, [socket, vibrationEnabled]);

    useEffect(() => {
        let interval;
        if (autoBet) {
            interval = setInterval(async () => {
                try {
                    // Bet safety check
                    if (betAmount > 1000) {
                        const confirmed = window.confirm(`Warning: You are betting $${betAmount}. Are you sure?`);
                        if (!confirmed) {
                            setAutoBet(false);
                            return;
                        }
                    }

                    // Generate valid UUIDs
                    const betRoundId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                        return v.toString(16);
                    });
                    const externalTxId = `whale-bet-${Date.now()}`;
                    
                    // Place bet via callback - backend will handle resolution
                    await axios.post('http://localhost:3001/callback', {
                        type: 'bet',
                        external_tx_id: externalTxId,
                        user_id: WHALE_USER_ID,
                        bet_round_id: betRoundId,
                        amount: betAmount
                    }, { headers: { 'x-signature': 'dummy' } });
                    
                } catch (err) {
                    console.error("Bet failed:", err.message);
                    setAutoBet(false);
                    alert(`Bet failed: ${err.message}`);
                }
            }, 1000); // Bet every 1 second
        }
        return () => clearInterval(interval);
    }, [autoBet, betAmount]);

    const handleDeposit = async () => {
        setLoading(true);
        try {
            // Generate valid UUID for bet_round_id
            const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            
            await axios.post('http://localhost:3001/callback', {
                type: 'win',
                external_tx_id: `dep-${Date.now()}`,
                user_id: WHALE_USER_ID,
                bet_round_id: uuid,
                amount: 10000
            }, { headers: { 'x-signature': 'dummy' } });
        } catch (err) {
            alert('Deposit failed');
        } finally {
            setLoading(false);
        }
    };

    const profitLoss = stats.totalWon - stats.totalWagered;

    return (
        <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-2xl p-8 shadow-2xl border border-indigo-700/50 h-full flex flex-col gap-6">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">Whale User Control</h2>
                    <div className="text-indigo-200 text-lg font-mono bg-indigo-950/50 px-3 py-1 rounded-md inline-block border border-indigo-500/30">
                        {WHALE_USER_ID}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-indigo-200 text-sm font-medium uppercase tracking-wider mb-1">Current Balance</div>
                    <div className="text-5xl font-black text-white font-mono tracking-tight shadow-purple-500/50 drop-shadow-lg">
                        ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            {/* Lifetime Stats Panel */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-indigo-950/40 p-5 rounded-xl border border-indigo-500/20">
                <div className="flex flex-col">
                    <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Total Bets</span>
                    <span className="text-2xl font-mono text-white leading-none mt-1">{stats.totalBets}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Wagered</span>
                    <span className="text-2xl font-mono text-white leading-none mt-1">${stats.totalWagered.toLocaleString()}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Won</span>
                    <span className="text-2xl font-mono text-green-400 leading-none mt-1">${stats.totalWon.toLocaleString()}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">P/L</span>
                    <span className={clsx(
                        "text-2xl font-mono leading-none mt-1",
                        profitLoss >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                        {profitLoss >= 0 ? '+' : ''}${profitLoss.toLocaleString()}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-base font-semibold text-indigo-200 uppercase tracking-wide">Bet Amount</label>
                        <button 
                            onClick={() => setVibrationEnabled(!vibrationEnabled)}
                            className={clsx(
                                "text-[10px] font-bold px-3 py-1 rounded-full border transition-all uppercase tracking-tighter",
                                vibrationEnabled ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/50" : "bg-gray-700/50 text-gray-500 border-gray-600/50"
                            )}
                        >
                            Vibration: {vibrationEnabled ? 'ON' : 'OFF'}
                        </button>
                    </div>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400 text-xl font-bold">$</span>
                        <input 
                            type="number" 
                            value={betAmount} 
                            onChange={(e) => setBetAmount(Number(e.target.value))}
                            className="w-full bg-indigo-950/80 border border-indigo-500/50 rounded-xl pl-10 pr-4 py-5 text-2xl text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/50 transition-all font-mono font-bold shadow-inner"
                        />
                    </div>
                </div>
                <div className="flex items-end gap-3 h-full">
                    <button 
                        onClick={() => setAutoBet(!autoBet)}
                        className={clsx(
                            "flex-1 py-5 px-6 rounded-xl text-lg font-black tracking-wide transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl uppercase border-b-4",
                            autoBet 
                                ? "bg-red-500 hover:bg-red-600 border-red-700 text-white shadow-red-500/20" 
                                : "bg-emerald-500 hover:bg-emerald-600 border-emerald-700 text-white shadow-emerald-500/20"
                        )}
                    >
                        {autoBet ? 'STOP AUTO BET' : 'START AUTO BET'}
                    </button>
                    <button 
                        onClick={handleDeposit}
                        disabled={loading}
                        className="py-5 px-6 rounded-xl font-bold text-lg bg-indigo-600 hover:bg-indigo-500 border-b-4 border-indigo-800 transition-all active:scale-95 disabled:opacity-50 text-white shadow-indigo-500/30"
                    >
                        + $10k
                    </button>
                </div>
            </div>
            
            {autoBet && (
                <div className="flex items-center justify-center gap-3 text-emerald-300 text-lg font-bold bg-emerald-950/30 py-3 rounded-lg border border-emerald-500/20 animate-pulse">
                    <span className="w-3 h-3 bg-emerald-400 rounded-full shadow-[0_0_10px_#34d399]"></span>
                    AUTOMATIC BETTING ACTIVE • 1s INTERVAL
                </div>
            )}
        </div>
    );
}
