import React, { useEffect, useRef, useState } from 'react';

export default function LiveChat({ messages, socket }) {
  const scrollRef = useRef(null);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !socket) return;

    socket.emit('chat_message', {
      user: 'Admin',
      text: inputText
    });
    setInputText('');
  };

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 h-full flex flex-col shadow-2xl overflow-x-hidden no-scrollbar">
      <div className="p-6 border-b border-gray-700 bg-gray-800/80 backdrop-blur rounded-t-2xl">
        <h3 className="text-xl font-bold text-white flex items-center gap-3">
          <span className="flex relative h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          Live Chat
        </h3>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar overflow-x-hidden p-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className="animate-fade-in bg-gray-900/50 p-3 rounded-lg border border-gray-700/50">
            <div className="flex items-baseline justify-between mb-1">
              <span className={`font-bold text-sm ${msg.user === 'Admin' ? 'text-yellow-400' : 'text-blue-400'}`}>{msg.user}</span>
              <span className="text-xs text-gray-500">{new Date(msg.timestamp || Date.now()).toLocaleTimeString()}</span>
            </div>
            <p className="text-gray-200 text-base leading-snug">{msg.text}</p>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-600">
            <p className="text-lg italic">Waiting for messages...</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-gray-700 bg-gray-800/80 backdrop-blur rounded-b-2xl">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-lg transition-colors shadow-lg active:scale-95"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
