import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import LiveStats from './components/LiveStats';
import LiveChat from './components/LiveChat';
import BetTicker from './components/BetTicker';
import MainUserControl from './components/MainUserControl';

const WS_URL = 'http://localhost:3000';
const socketInstance = io(WS_URL, {
  transports: ['websocket'],
  reconnection: true,
  autoConnect: true
});

function App() {
  const winTimeoutRef = React.useRef(null);
  const [toastKey, setToastKey] = useState(0);
  const [totalBets, setTotalBets] = useState(0);
  const [totalWon, setTotalWon] = useState(0);
  const [messages, setMessages] = useState([]);
  const [bets, setBets] = useState([]);
  const [lastEvent, setLastEvent] = useState(null);
  const [eventCount, setEventCount] = useState(0);
  const [showWinToast, setShowWinToast] = useState(false);
  const [winAmount, setWinAmount] = useState(0);
  const [isConnected, setIsConnected] = useState(socketInstance.connected);

  useEffect(() => {
    const handleConnect = () => {
      console.log('Connected to Gateway WS');
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handlePublicFeed = (data) => {
      console.log(`[APP] WS Feed:`, data.type, data.amount);
      setEventCount(prev => prev + 1);
      setLastEvent(data);

      if (data.type === 'bet') {
        setTotalBets(prev => prev + 1);
        setBets(prev => [data, ...prev].slice(0, 50));
      } else if (data.type === 'win') {
        setTotalWon(prev => prev + (parseFloat(data.amount) || 0));
        setBets(prev => [{...data, type: 'win'}, ...prev].slice(0, 50));

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
    socketInstance.on('disconnect', handleDisconnect);
    socketInstance.on('public_feed', handlePublicFeed);
    socketInstance.on('chat_message', handleChatMessage);

    return () => {
      socketInstance.off('connect', handleConnect);
      socketInstance.off('disconnect', handleDisconnect);
      socketInstance.off('public_feed', handlePublicFeed);
      socketInstance.off('chat_message', handleChatMessage);
    };
  }, []);

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

        {/* Control Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 h-full">
            <MainUserControl socket={socketInstance} />
          </div>
          <div className="h-full">
            <LiveStats totalBets={totalBets} totalWon={totalWon} />
          </div>
        </div>

        {/* Data Feed Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-8">
          <div className="xl:col-span-2">
            <BetTicker bets={bets} />
          </div>
          <div>
            <LiveChat messages={messages} socket={socketInstance} />
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
