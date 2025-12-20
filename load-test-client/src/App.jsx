import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import LiveStats from './components/LiveStats';
import LiveChat from './components/LiveChat';
import BetTicker from './components/BetTicker';
import MainUserControl from './components/MainUserControl';

const WS_URL = 'http://localhost:3000';

function App() {
  const [socket, setSocket] = useState(null);
  const [totalBets, setTotalBets] = useState(0);
  const [totalWon, setTotalWon] = useState(0);
  const [messages, setMessages] = useState([]);
  const [bets, setBets] = useState([]);

  useEffect(() => {
    const newSocket = io(WS_URL, {
      transports: ['websocket'],
      reconnection: true
    });

    newSocket.on('connect', () => {
      console.log('Connected to Gateway WS');
    });

    newSocket.on('public_feed', (data) => {
      if (data.type === 'bet') {
        setTotalBets(prev => prev + 1);
        setBets(prev => [data, ...prev].slice(0, 50)); // Keep last 50
      } else if (data.type === 'win') {
        setTotalWon(prev => prev + data.amount);
        // Also add wins to ticker? maybe distinct style
        setBets(prev => [{...data, type: 'win'}, ...prev].slice(0, 50));
      }
    });

    newSocket.on('chat_message', (msg) => {
      setMessages(prev => [...prev, msg].slice(-100)); // Keep last 100
    });

    setSocket(newSocket);

    return () => newSocket.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 font-sans">
      <div className="w-full max-w-[1800px] mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-8 border-b border-gray-800">
          <div>
            <h1 className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
              AVIATOR<span className="text-white">DASHBOARD</span>
            </h1>
            <p className="text-gray-400 mt-2 text-lg font-light">Real-time Load Test Monitor & Control Center</p>
          </div>
          <div className="flex items-center gap-3 px-6 py-3 bg-gray-800 rounded-full border border-gray-700 shadow-lg">
            <div className={`w-4 h-4 rounded-full ${socket?.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-base font-medium text-gray-300">
              {socket?.connected ? 'System Online' : 'Connecting...'}
            </span>
          </div>
        </div>

        {/* Control Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 h-full">
            <MainUserControl socket={socket} />
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
            <LiveChat messages={messages} socket={socket} />
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
