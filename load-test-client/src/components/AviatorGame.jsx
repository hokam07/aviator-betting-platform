import React, { useState, useEffect, useRef } from 'react';

const AviatorGame = ({ socket }) => {
    const [gameState, setGameState] = useState({
        status: 'WAITING',
        multiplier: 1.0,
        roundId: null,
        waitTime: 0
    });
    const [myBet, setMyBet] = useState(null);
    const [hasCashedOut, setHasCashedOut] = useState(false);
    const [userId] = useState(() => localStorage.getItem('aviator_user_id') || `user_${Math.random().toString(36).slice(2, 7)}`);

    useEffect(() => {
        localStorage.setItem('aviator_user_id', userId);

        socket.on('game_update', (data) => {
            setGameState(data);

            // Reset local state on new round
            if (data.status === 'WAITING' && data.multiplier === 1.0) {
                setMyBet(null);
                setHasCashedOut(false);
            }
        });

        socket.on('bet_confirmed', (data) => {
            setMyBet(data.amount);
        });

        socket.on('cashout_confirmed', (data) => {
            setHasCashedOut(true);
        });

        return () => {
            socket.off('game_update');
            socket.off('bet_confirmed');
            socket.off('cashout_confirmed');
        };
    }, [socket, userId]);

    const handlePlaceBet = () => {
        if (gameState.status !== 'WAITING') return;
        socket.emit('place_bet', {
            userId,
            amount: 10, // Fixed for demo, can be dynamic
            roundId: gameState.id
        });
    };

    const handleCashOut = () => {
        if (gameState.status !== 'FLYING' || !myBet || hasCashedOut) return;
        socket.emit('cash_out', {
            userId,
            roundId: gameState.id,
            multiplier: gameState.multiplier
        });
    };

    // Calculate progress for animation
    const isFlying = gameState.status === 'FLYING';
    const isCrashed = gameState.status === 'CRASHED';
    const isWaiting = gameState.status === 'WAITING';

    return (
        <div className="bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-2xl overflow-hidden relative min-h-[400px] flex flex-col justify-between">
            {/* Background Animation (Simplified) */}
            <div className={`absolute inset-0 opacity-10 pointer-events-none transition-all duration-1000 ${isFlying ? 'bg-blue-500' : isCrashed ? 'bg-red-500' : 'bg-transparent'}`}></div>

            {/* Game Header */}
            <div className="flex justify-between items-center z-10">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Live Round</span>
                </div>
                <div className="text-xs font-mono text-gray-500">{gameState.id?.slice(0, 8)}</div>
            </div>

            {/* Central Display */}
            <div className="flex-grow flex flex-col items-center justify-center z-10 py-12">
                {isWaiting ? (
                    <div className="text-center animate-pulse">
                        <div className="text-gray-500 text-sm uppercase tracking-widest mb-2 font-bold">Waiting for Takeoff</div>
                        <div className="text-5xl font-black text-white">READY</div>
                    </div>
                ) : (
                    <div className="text-center perspective-1000">
                        <div className={`text-8xl md:text-9xl font-black transition-all duration-100 flex items-baseline gap-2 ${isCrashed ? 'text-red-500 scale-95 blur-sm' : 'text-white'}`}>
                            {gameState.multiplier.toFixed(2)}
                            <span className="text-4xl md:text-5xl font-black italic">x</span>
                        </div>
                        {isCrashed && <div className="text-red-500 font-black text-2xl uppercase tracking-tighter mt-[-20px] animate-bounce">Flew Away!</div>}
                    </div>
                )}
            </div>

            {/* Interactive Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 z-10 pt-4 border-t border-gray-700/50">
                <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-700">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Your Bet</span>
                        <span className="text-xs font-mono text-blue-400 font-bold">{myBet ? `$${myBet}` : 'None'}</span>
                    </div>
                    <button
                        onClick={handlePlaceBet}
                        disabled={!isWaiting || myBet !== null}
                        className={`w-full py-4 rounded-xl font-black text-lg transition-all transform active:scale-95 ${!isWaiting || myBet !== null
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 shadow-[0_10px_30px_rgba(16,185,129,0.3)]'
                            }`}
                    >
                        {myBet !== null ? 'BETTING...' : 'PLACE BET ($10)'}
                    </button>
                </div>

                <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-700">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Potential Win</span>
                        <span className="text-xs font-mono text-yellow-500 font-bold">
                            {myBet && !hasCashedOut && isFlying ? `$${(myBet * gameState.multiplier).toFixed(2)}` : '-'}
                        </span>
                    </div>
                    <button
                        onClick={handleCashOut}
                        disabled={!isFlying || !myBet || hasCashedOut}
                        className={`w-full py-4 rounded-xl font-black text-lg transition-all transform active:scale-95 ${!isFlying || !myBet || hasCashedOut
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 shadow-[0_10px_30px_rgba(249,115,22,0.3)]'
                            }`}
                    >
                        {hasCashedOut ? 'CASHED OUT!' : 'CASH OUT'}
                    </button>
                </div>
            </div>

            {/* Visual Progress Bar */}
            {isWaiting && (
                <div className="absolute bottom-0 left-0 h-1 bg-blue-500 animate-[loading_5s_linear_infinite]"></div>
            )}
            <style jsx>{`
                @keyframes loading {
                    from { width: 0%; }
                    to { width: 100%; }
                }
            `}</style>
        </div>
    );
};

export default AviatorGame;
