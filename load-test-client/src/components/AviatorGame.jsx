import React, { useState, useEffect, useRef } from 'react';

// High-quality Plane Asset
import planeAsset from '../assets/download (1).png';
const PLANE_SVG_PATH = "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z";

const AviatorGame = ({ socket, userId, balance }) => {
    const canvasRef = useRef(null);
    const [gameState, setGameState] = useState({
        status: 'WAITING',
        multiplier: 1.0,
        id: null,
        startTime: null
    });
    const [myBet, setMyBet] = useState(null);
    const [hasCashedOut, setHasCashedOut] = useState(false);
    const [winAmount, setWinAmount] = useState(0);
    const [betAmount, setBetAmount] = useState(10);

    const planeImgRef = useRef(null);
    const animationFrameRef = useRef(null);
    const flyAwayRef = useRef(null); // Animation state ref

    useEffect(() => {
        if (!socket || !userId) return;

        socket.on('game_update', (data) => {
            setGameState(prev => {
                // Only reset betting state if it's a NEW round
                if (data.id !== prev.id) {
                    setMyBet(null);
                    setHasCashedOut(false);
                    setWinAmount(0);
                }
                return data;
            });
        });

        socket.on('bet_confirmed', (data) => setMyBet(data.amount));

        socket.on('cashout_confirmed', (data) => {
            setHasCashedOut(true);
            setWinAmount(data.winAmount);
        });

        return () => {
            socket.off('game_update');
            socket.off('bet_confirmed');
            socket.off('cashout_confirmed');
        };
    }, [socket, userId]);

    // Preload plane asset
    useEffect(() => {
        const img = new Image();
        img.src = planeAsset;
        img.onload = () => {
            planeImgRef.current = img;
        };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = canvas.parentElement;
        const ctx = canvas.getContext('2d');

        const updateSize = () => {
            canvas.width = canvas.offsetWidth * window.devicePixelRatio;
            canvas.height = canvas.offsetHeight * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        };

        updateSize();
        window.addEventListener('resize', updateSize);

        const render = () => {
            const width = canvas.offsetWidth;
            const height = canvas.offsetHeight;
            ctx.clearRect(0, 0, width, height);

            if (gameState.status === 'FLYING' || gameState.status === 'CRASHED') {
                const multiplier = gameState.multiplier;

                // --- Parallax & Camera Logic ---
                const t = Math.log(multiplier) / 0.1;
                // Virtual coordinates (where the plane implies it is in the world)
                const virtualX = (t / 12) * (width * 0.85); // Matches previous scaling
                const virtualY = (multiplier / 4.0) * (height * 0.7);

                // Camera Position (clamped so plane stays in view)
                // If virtual pos > screen center (approx), shift camera
                const viewPortPadX = width * 0.5;
                const viewPortPadY = height * 0.5;

                const cameraX = Math.max(0, virtualX - viewPortPadX);
                const cameraY = Math.max(0, virtualY - viewPortPadY);

                // Screen Coordinates (where to draw relative to camera)
                const screenX = virtualX - cameraX;
                const screenY = height - (virtualY - cameraY); // Invert Y for canvas

                // 1. Draw Parallax Grid
                ctx.strokeStyle = '#2d3748';
                ctx.lineWidth = 0.5;

                // Offset grid based on camera position for scrolling effect
                const gridSize = 60;
                const offsetX = -(cameraX % gridSize);
                const offsetY = (cameraY % gridSize);

                for (let x = offsetX; x < width; x += gridSize) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
                }
                for (let y = offsetY; y < height; y += gridSize) {
                    ctx.beginPath();
                    ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
                }

                // 2. Draw Glow Sub-layer (Curve)
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#ff3366';
                ctx.strokeStyle = '#ff3366';
                ctx.lineWidth = 4;
                ctx.beginPath();

                // Start drawing curve from t=0 relative to current camera
                // We need to project every point of the curve to screen space
                let started = false;
                for (let i = 0; i <= t; i += 0.1) {
                    const m = Math.pow(Math.E, i * 0.1);
                    const vx = (i / 12) * (width * 0.85);
                    const vy = (m / 4.0) * (height * 0.7);

                    const sx = vx - cameraX;
                    const sy = height - (vy - cameraY);

                    // Optimization: only draw if within or near viewport
                    if (sx >= -50 && sx <= width + 50 && sy >= -50 && sy <= height + 50) {
                        if (!started) {
                            ctx.moveTo(sx, sy);
                            started = true;
                        } else {
                            ctx.lineTo(sx, sy);
                        }
                    }
                }
                ctx.stroke();
                ctx.shadowBlur = 0;

                // 3. Draw Plane Sprite
                const isCrashed = gameState.status === 'CRASHED';

                if (gameState.status === 'FLYING' || isCrashed) {
                    ctx.save();

                    let drawX = screenX;
                    let drawY = screenY;
                    let rotation = Math.min(Math.PI / 4, Math.atan(multiplier * 0.5));

                    // Fly Away Animation State
                    if (isCrashed) {
                        if (!flyAwayRef.current) {
                            flyAwayRef.current = Date.now();
                        }
                        const elapsed = (Date.now() - flyAwayRef.current) / 1000; // seconds

                        // Accelerate up and right
                        drawX += elapsed * 800;  // rapid right movement
                        drawY -= elapsed * 800;  // rapid up movement
                        rotation += elapsed * 2; // spin slightly
                    } else {
                        flyAwayRef.current = null; // Reset when not crashed
                    }

                    ctx.translate(drawX, drawY);

                    // Rotate based on slope of curve at current t
                    ctx.rotate(-rotation); // Point along curve

                    if (isCrashed) {
                        // If crashed, maybe rotate slightly more up
                        ctx.rotate(-0.5);
                    }

                    ctx.scale(1.5, 1.5);

                    // Plane Shadow/Glow
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = '#fff';

                    // Plane Body
                    if (planeImgRef.current) {
                        ctx.save();
                        // Adjust image rotation if needed
                        ctx.rotate(0.2);
                        const size = 120;
                        ctx.drawImage(planeImgRef.current, -size / 2, -size / 2, size, size);
                        ctx.restore();
                    } else {
                        const p = new Path2D(PLANE_SVG_PATH);
                        ctx.fillStyle = '#ff3366';
                        ctx.fill(p);
                    }

                    // Propeller / Engine Effect
                    ctx.fillStyle = '#ffffff';
                    ctx.globalAlpha = 0.8;
                    const flicker = Math.random() * 5;
                    ctx.beginPath();
                    ctx.arc(0, 22 + flicker, 4, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.restore();
                }
            }

            animationFrameRef.current = requestAnimationFrame(render);
        };

        render();
        return () => {
            window.removeEventListener('resize', updateSize);
            cancelAnimationFrame(animationFrameRef.current);
        };
    }, [gameState]);

    const handlePlaceBet = () => {
        if (gameState.status !== 'WAITING' || myBet) return;
        if (betAmount <= 0 || betAmount > balance) return;
        socket.emit('place_bet', { userId, amount: betAmount, roundId: gameState.id });
    };

    const adjustBet = (amount) => {
        if (myBet || gameState.status !== 'WAITING') return;
        setBetAmount(prev => {
            const next = prev + amount;
            return next > balance ? balance : (next < 10 ? 10 : next);
        });
    };

    const setMaxBet = () => {
        if (myBet || gameState.status !== 'WAITING') return;
        setBetAmount(Math.floor(balance));
    };

    const handleCashOut = () => {
        if (gameState.status !== 'FLYING' || !myBet || hasCashedOut) return;
        socket.emit('cash_out', { userId, roundId: gameState.id, multiplier: gameState.multiplier });
    };

    return (
        <div className="flex flex-col gap-4 w-full h-full animate-in fade-in duration-700 overflow-hidden">
            {/* COMPACT GAME PAN */}
            <div className="relative w-full h-[450px] bg-[#0c121d] rounded-[32px] border-4 border-[#1e293b] overflow-hidden shadow-[0_35px_60px_-15px_rgba(0,0,0,0.6)]">

                {/* Background Decor */}
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#ff3366_0%,transparent_50%)]"></div>
                </div>

                <canvas ref={canvasRef} className="w-full h-full" />

                {/* HUD Elements */}
                <div className="absolute top-8 left-8 flex flex-col gap-4 pointer-events-none">
                    <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_#ef4444]"></div>
                        <span className="text-[10px] font-black tracking-widest text-white/50 uppercase">Network Live</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Current Multiplier</span>
                        <div className={`text-6xl md:text-8xl font-black italic tracking-tighter transition-all duration-75 ${gameState.status === 'CRASHED' ? 'text-red-500 blur-[3px]' : 'text-white'}`}>
                            {gameState.multiplier.toFixed(2)}x
                        </div>
                    </div>
                </div>

                {/* Center Notifications */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {gameState.status === 'WAITING' && (
                        <div className="text-center bg-black/60 backdrop-blur-xl p-12 rounded-[40px] border border-white/5 scale-in shadow-2xl">
                            <div className="text-red-500 text-sm font-black uppercase tracking-[0.4em] mb-4">Starting In</div>
                            <div className="text-9xl font-black text-white tabular-nums">
                                {Math.max(0, Math.ceil((5000 - (Date.now() - new Date(gameState.startTime).getTime())) / 1000) || 5)}
                            </div>
                        </div>
                    )}

                    {gameState.status === 'CRASHED' && (
                        <div className="text-center bg-red-600/10 backdrop-blur-md px-12 py-6 rounded-full border-2 border-red-500/50 animate-bounce">
                            <span className="text-red-500 font-black text-4xl italic uppercase tracking-tighter">FLEW AWAY!</span>
                        </div>
                    )}
                </div>

                {/* Info Pills */}
                <div className="absolute bottom-8 right-8 flex gap-4 pointer-events-none">
                    <div className="bg-black/60 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 flex flex-col items-end">
                        <span className="text-[8px] font-bold text-gray-500 uppercase">Balance</span>
                        <span className="text-lg font-black text-green-400 font-mono">${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </div>

            {/* CONTROL PANELS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* BETTING PANEL */}
                <div className="group relative bg-[#131b2b] p-6 rounded-[32px] border-2 border-[#1e293b] hover:border-indigo-500/30 transition-all duration-500 shadow-2xl">
                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
                        <div>
                            <h3 className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Bet Configuration</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-white tracking-tighter">${betAmount.toLocaleString()}</span>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">USD</span>
                            </div>
                        </div>
                        <div className="bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Manual</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 mb-6">
                        <div className="grid grid-cols-4 gap-2">
                            {[10, 50, 100].map(val => (
                                <button
                                    key={val}
                                    onClick={() => adjustBet(val)}
                                    disabled={gameState.status !== 'WAITING' || !!myBet}
                                    className="bg-[#1e293b] hover:bg-[#334155] disabled:opacity-50 disabled:cursor-not-allowed py-2 rounded-xl text-xs font-black text-white transition-all border border-white/5"
                                >
                                    +{val}
                                </button>
                            ))}
                            <button
                                onClick={setMaxBet}
                                disabled={gameState.status !== 'WAITING' || !!myBet}
                                className="bg-indigo-600/20 hover:bg-indigo-600/40 disabled:opacity-50 disabled:cursor-not-allowed py-2 rounded-xl text-xs font-black text-indigo-400 border border-indigo-500/30 transition-all uppercase tracking-tighter"
                            >
                                Max
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handlePlaceBet}
                        disabled={gameState.status !== 'WAITING' || !!myBet || betAmount > balance}
                        className={`w-full group/btn relative h-20 rounded-2xl font-black text-2xl tracking-tighter transition-all duration-300 overflow-hidden ${gameState.status !== 'WAITING' || !!myBet || betAmount > balance
                            ? 'bg-[#1e293b] text-gray-600 cursor-not-allowed grayscale'
                            : 'bg-gradient-to-br from-[#22c55e] to-[#15803d] text-white hover:scale-[1.02] active:scale-95 shadow-[0_20px_40px_-10px_rgba(34,197,94,0.3)]'
                            }`}
                    >
                        <span className="relative z-10">
                            {betAmount > balance ? "LOW BALANCE" : (myBet ? "BETTING ACTIVE" : "PLACE BET")}
                        </span>
                        {gameState.status === 'WAITING' && !myBet && betAmount <= balance && (
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                        )}
                    </button>

                    {myBet && (
                        <div className="mt-4 flex items-center justify-center gap-2 text-[#22c55e] animate-pulse">
                            <span className="text-[10px] font-black uppercase">Reserved for flying</span>
                        </div>
                    )}
                </div>

                {/* CASHOUT PANEL */}
                <div className={`p-6 rounded-[32px] border-2 transition-all duration-500 shadow-2xl ${hasCashedOut
                    ? 'bg-orange-500/10 border-orange-500/50 shadow-[0_20px_50px_-10px_rgba(249,115,22,0.2)]'
                    : 'bg-[#131b2b] border-[#1e293b]'
                    }`}>
                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
                        <div>
                            <h3 className="text-orange-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Potential Payout</h3>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-3xl font-black tracking-tighter transition-all ${hasCashedOut ? 'text-green-400' : 'text-orange-500'}`}>
                                    {hasCashedOut ? `+$${winAmount.toFixed(2)}` : (myBet && gameState.status === 'FLYING' ? `$${(myBet * gameState.multiplier).toFixed(2)}` : '$0.00')}
                                </span>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">USD</span>
                            </div>
                        </div>
                        {hasCashedOut && (
                            <div className="bg-green-500/20 px-3 py-1 rounded-full border border-green-500/30">
                                <span className="text-[8px] font-black text-green-400 uppercase tracking-widest">Claimed</span>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleCashOut}
                        disabled={gameState.status !== 'FLYING' || !myBet || hasCashedOut}
                        className={`w-full relative h-20 rounded-2xl font-black text-2xl tracking-tighter transition-all duration-300 overflow-hidden ${gameState.status !== 'FLYING' || !myBet || hasCashedOut
                            ? 'bg-[#1e293b] text-gray-600 cursor-not-allowed'
                            : 'bg-gradient-to-br from-[#f97316] to-[#dc2626] text-white hover:scale-[1.02] active:scale-95 shadow-[0_20px_40px_-10px_rgba(249,115,22,0.3)] pulse-glow'
                            }`}
                    >
                        {hasCashedOut ? "COLLECTED" : "CASH OUT"}
                    </button>

                    {!myBet && !hasCashedOut && (
                        <div className="mt-4 text-center">
                            <span className="text-[10px] text-gray-500 font-bold uppercase">No active bet for this flight</span>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .scale-in { animation: scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
                @keyframes scaleIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                
                .pulse-glow { animation: pulseGlow 2s infinite; }
                @keyframes pulseGlow {
                    0% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4); }
                    70% { box-shadow: 0 0 0 20px rgba(249, 115, 22, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
                }
            `}</style>
        </div>
    );
};

export default AviatorGame;
