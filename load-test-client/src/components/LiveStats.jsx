import React from 'react';
import { clsx } from 'clsx';

export default function LiveStats({ totalBets, totalWon }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-6 h-full">
      <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-xl flex flex-col justify-center">
        <h3 className="text-gray-400 text-base font-bold uppercase tracking-widest mb-2">Total Bets</h3>
        <p className="text-6xl font-black text-blue-400 tabular-nums tracking-tight">{totalBets.toLocaleString()}</p>
      </div>
      <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-xl flex flex-col justify-center">
        <h3 className="text-gray-400 text-base font-bold uppercase tracking-widest mb-2">Total Won</h3>
        <p className="text-6xl font-black text-green-400 tabular-nums tracking-tight">${totalWon.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
      </div>
    </div>
  );
}
