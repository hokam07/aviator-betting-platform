import React from 'react';
import { clsx } from 'clsx';

export default function LiveStats({ totalBets, totalWon }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
      <div className="bg-gray-800/50 backdrop-blur-md p-6 rounded-2xl border border-gray-700 shadow-xl flex items-center justify-between px-10">
        <h3 className="text-gray-400 text-sm font-bold uppercase tracking-widest">Total Bets</h3>
        <p className="text-4xl font-black text-blue-400 tabular-nums tracking-tight">{totalBets.toLocaleString()}</p>
      </div>
      <div className="bg-gray-800/50 backdrop-blur-md p-6 rounded-2xl border border-gray-700 shadow-xl flex items-center justify-between px-10">
        <h3 className="text-gray-400 text-sm font-bold uppercase tracking-widest">Total Won</h3>
        <p className="text-4xl font-black text-green-400 tabular-nums tracking-tight">${totalWon.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
      </div>
    </div>
  );
}
