import { useState } from 'react';
import LoyaltyRankingView from './LoyaltyRankingView';
import LoyaltyRewardsManager from './LoyaltyRewardsManager';
import LoyaltyHistoryView from './LoyaltyHistoryView';
import LoyaltyPendingDeliveriesView from './LoyaltyPendingDeliveriesView';

type SubTab = 'clientes' | 'recompensas' | 'historial' | 'entregas';

export default function LoyaltyAdminView() {
  const [subTab, setSubTab] = useState<SubTab>('clientes');

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-gray-800 rounded-xl p-1 w-fit flex-wrap">
        <button
          onClick={() => setSubTab('clientes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-all whitespace-nowrap ${
            subTab === 'clientes'
              ? 'bg-amber-500 text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <i className="ri-group-line" />
          Clientes
        </button>
        <button
          onClick={() => setSubTab('recompensas')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-all whitespace-nowrap ${
            subTab === 'recompensas'
              ? 'bg-amber-500 text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <i className="ri-gift-line" />
          Recompensas
        </button>
        <button
          onClick={() => setSubTab('historial')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-all whitespace-nowrap ${
            subTab === 'historial'
              ? 'bg-amber-500 text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <i className="ri-history-line" />
          Historial
        </button>
        <button
          onClick={() => setSubTab('entregas')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-all whitespace-nowrap ${
            subTab === 'entregas'
              ? 'bg-amber-500 text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <i className="ri-gift-line" />
          Entregas
        </button>
      </div>

      {subTab === 'clientes' && <LoyaltyRankingView />}
      {subTab === 'recompensas' && <LoyaltyRewardsManager />}
      {subTab === 'historial' && <LoyaltyHistoryView />}
      {subTab === 'entregas' && <LoyaltyPendingDeliveriesView />}
    </div>
  );
}