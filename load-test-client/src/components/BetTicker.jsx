import React from 'react';

export default function BetTicker({ bets }) {
  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 h-full flex flex-col shadow-2xl overflow-hidden">
      <div className="p-6 border-b border-gray-700 bg-gray-800/80 backdrop-blur rounded-t-2xl flex justify-between items-center sticky top-0 z-10 transition-colors hover:bg-gray-700/50">
        <h3 className="text-xl font-bold text-white flex items-center gap-3">
          <span className="flex relative h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
          </span>
          Live Bets Feed
        </h3>
        <span className="text-xs font-mono text-gray-500 bg-gray-900 px-2 py-1 rounded">REAL-TIME</span>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar overflow-x-hidden">
        <table className="w-full text-left text-base table-fixed">
          <thead className="bg-gray-900/80 text-gray-400 uppercase text-xs font-bold tracking-wider sticky top-0 backdrop-blur z-10">
            <tr>
              <th className="px-6 py-4">Time</th>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4 text-right">Amount</th>
              <th className="px-6 py-4 text-right">Mult</th>
              <th className="px-6 py-4 text-center">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {bets.map((bet, i) => (
              <tr key={i} className={`transition-colors ${bet.type === 'win' ? 'bg-green-900/10 hover:bg-green-900/20' : 'hover:bg-gray-700/30'}`}>
                <td className="px-6 py-4 text-gray-400 font-mono text-sm">
                  {new Date(bet.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td className="px-6 py-4 text-blue-300 font-medium truncate max-w-[150px]" title={bet.user_id}>
                  {bet.user_id.slice(0, 8)}...
                </td>
                <td className="px-6 py-4 text-right font-mono font-bold text-white tracking-wide">
                  ${bet.amount.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-right font-mono font-bold text-yellow-400">
                  {bet.multiplier ? `${bet.multiplier.toFixed(2)}x` : '-'}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${bet.type === 'win' ? 'bg-green-500/20 text-green-400 border border-green-500/50' :
                    'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                    }`}>
                    {bet.type === 'win' ? 'WIN' : 'BET'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {bets.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-600">
            <p className="text-xl italic">Waiting for bets...</p>
          </div>
        )}
      </div>
    </div>
  );
}
