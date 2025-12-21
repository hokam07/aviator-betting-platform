import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

import LiveStats from './components/LiveStats';
import LiveChat from './components/LiveChat';
import BetTicker from './components/BetTicker';
import MainUserControl from './components/MainUserControl';
import AviatorGame from './components/AviatorGame';

const WS_URL = 'http://localhost:3000';
const socketInstance = io(WS_URL, {
  transports: ['websocket'],
  reconnection: true,
  autoConnect: true
});

function App() {
  const winTimeoutRef = React.useRef(null);
  const [toastKey, setToastKey] = useState(0);
  const [messages, setMessages] = useState([]);
  const [bets, setBets] = useState([]);
  const [lastEvent, setLastEvent] = useState(null);
  const [eventCount, setEventCount] = useState(0);
  const [showWinToast, setShowWinToast] = useState(false);
  const [winAmount, setWinAmount] = useState(0);
  const [isConnected, setIsConnected] = useState(socketInstance.connected);

  const [userId] = useState(() => {
    const cached = localStorage.getItem('aviator_user_id');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (cached && uuidRegex.test(cached)) return cached;
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  });

  const [balance, setBalance] = useState(0);
  const [stats, setStats] = useState({
    totalBets: 0,
    totalWagered: 0,
    totalWon: 0
  });

  useEffect(() => {
    localStorage.setItem('aviator_user_id', userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const syncData = () => {
      console.log(`[APP] Syncing data for user: ${userId}`);
      socketInstance.emit('subscribe', userId);

      // Initial fetch
      fetch(`http://localhost:3000/api/balance/${userId}`)
        .then(r => r.json()).then(d => setBalance(d.balance)).catch(console.error);
      fetch(`http://localhost:3000/api/user/stats/${userId}`)
        .then(r => r.json()).then(d => setStats({
          totalBets: d.total_bet_count || 0,
          totalWagered: d.total_wagered_amount || 0,
          totalWon: d.total_won_amount || 0
        })).catch(console.error);
    };

    const handleConnect = () => {
      console.log('Connected to Gateway WS');
      setIsConnected(true);
      syncData();
    };

    const handleBalanceUpdate = (data) => {
      if (data.user_id === userId) {
        console.log(`[APP] Balance Update: ${data.balance}`);
        setBalance(data.balance);
      }
    };

    const handlePublicFeed = (data) => {
      console.log(`[APP] WS Feed:`, data.type, data.amount);
      setEventCount(prev => prev + 1);
      setLastEvent(data);

      if (data.type === 'bet') {
        setBets(prev => [data, ...prev].slice(0, 50));
        if (data.user_id === userId) {
          setStats(prev => ({
            ...prev,
            totalBets: prev.totalBets + 1,
            totalWagered: prev.totalWagered + (parseFloat(data.amount) || 0)
          }));
        }
      } else if (data.type === 'win') {
        setBets(prev => [{ ...data, type: 'win' }, ...prev].slice(0, 50));
        if (data.user_id === userId) {
          setStats(prev => ({
            ...prev,
            totalWon: prev.totalWon + (parseFloat(data.amount) || 0)
          }));
        }

        if (data.amount >= 100) {
          console.log(`[APP] Showing Win Toast for $${data.amount}`);
          setWinAmount(data.amount);
          setToastKey(prev => prev + 1);
          setShowWinToast(true);

          if (winTimeoutRef.current) clearTimeout(winTimeoutRef.current);
          winTimeoutRef.current = setTimeout(() => {
            setShowWinToast(false);
          }, 5000);
        }
      }
    };

    const handleChatMessage = (msg) => {
      setMessages(prev => [...prev, msg].slice(-100));
    };

    socketInstance.on('connect', handleConnect);
    socketInstance.on('disconnect', () => setIsConnected(false));
    socketInstance.on('public_feed', handlePublicFeed);
    socketInstance.on('chat_message', handleChatMessage);
    socketInstance.on('balance_update', handleBalanceUpdate);

    // Initial sync if already connected
    if (socketInstance.connected) syncData();

    return () => {
      socketInstance.off('connect', handleConnect);
      socketInstance.off('public_feed', handlePublicFeed);
      socketInstance.off('chat_message', handleChatMessage);
      socketInstance.off('balance_update', handleBalanceUpdate);
    };
  }, [userId]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 font-sans transition-all relative overflow-x-hidden">

      {/* Win Toast Notification */}
      {showWinToast && (
        <div key={toastKey} className="fixed top-10 left-1/2 -translate-x-1/2 z-50 animate-bounce pointer-events-none">
          <div className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 p-1 rounded-2xl shadow-[0_0_50px_rgba(234,179,8,0.5)]">
            <div className="bg-gray-900 px-8 py-4 rounded-xl flex items-center gap-4">
              <span className="text-4xl">🎉</span>
              <div>
                <div className="text-yellow-400 font-black text-sm uppercase tracking-widest">Mega Win!</div>
                <div className="text-3xl font-black text-white font-mono">${winAmount.toLocaleString()}</div>
              </div>
              <span className="text-4xl">🚀</span>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-[1800px] mx-auto space-y-8">

        {/* Header */}
        <div className="flex justify-between items-center pb-8 border-b border-gray-800">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
                AVIATOR<span className="text-white">DASHBOARD</span>
              </h1>
              <p className="text-gray-400 mt-2 text-lg font-light italic">Real-time Load Test Monitor & Control Center</p>
            </div>

            {/* Debug Panel */}
            <div className="flex gap-4 ml-8 bg-gray-800/50 p-4 rounded-xl border border-gray-700">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-bold uppercase">Messages</span>
                <span className="text-xl font-mono text-green-400">{eventCount}</span>
              </div>
              <div className="flex flex-col border-l border-gray-700 pl-4">
                <span className="text-[10px] text-gray-500 font-bold uppercase">Last Type</span>
                <span className="text-xl font-mono text-blue-400">{lastEvent?.type || 'None'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-6 py-3 bg-gray-800 rounded-full border border-gray-700 shadow-lg scale-110">
            <div className={`w-4 h-4 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-base font-medium text-gray-300">
              {isConnected ? 'System Online' : 'Connecting...'}
            </span>
          </div>
        </div>

        {/* TOP CONTROLS */}
        <div className="w-full space-y-6">
          <MainUserControl socket={socketInstance} userId={userId} balance={balance} stats={stats} />
          <LiveStats totalBets={stats.totalBets} totalWon={stats.totalWon} />
        </div>

        {/* MAIN: 3-Column Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start pb-8">

          {/* LEFT: Live Feed (Bet Ticker) */}
          <div className="xl:col-span-3 h-[850px]">
            <BetTicker bets={bets} />
          </div>

          {/* MIDDLE: The Game */}
          <div className="xl:col-span-6 h-[850px]">
            <AviatorGame socket={socketInstance} userId={userId} balance={balance} />
          </div>

          {/* RIGHT: Live Chat */}
          <div className="xl:col-span-3 h-[850px]">
            <LiveChat messages={messages} socket={socketInstance} />
          </div>

        </div>

      </div>
    </div>
  );
}

export default App;
