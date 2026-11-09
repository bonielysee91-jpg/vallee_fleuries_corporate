import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { api, formatFcfa } from '../../services/api.ts';
import { Transaction } from '../../types/index.ts';
import {
  AlertTriangle,
  Banknote,
  Download,
  Loader2,
  Percent,
  Receipt,
  Search,
  Smartphone,
  Wallet
} from 'lucide-react';

type AdminTransaction = Transaction & { commissionFcfa: number; ownerPayoutFcfa: number };

const statusPillClass = (status: Transaction['status']): string => {
  if (status === 'SUCCESSFUL' || status === 'COMPLETED') return 'bg-emerald-100 text-emerald-800';
  if (status === 'FAILED' || status === 'REFUNDED') return 'bg-rose-100 text-rose-700';
  return 'bg-amber-100 text-amber-800';
};

/** `/admin/transactions` — Mobile Money logs and commission split tracking. */
export const AdminTransactionsPage: React.FC = () => {
  const addNotification = useAppStore((state) => state.addNotification);

  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providerFilter, setProviderFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  /** Télécharge le grand livre complet en CSV (route admin protégée par jeton). */
  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const blob = await api.exportPaymentsCsv();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transactions-vfc-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      addNotification('Export CSV du grand livre généré.', 'success');
    } catch (err: any) {
      addNotification(err.message || 'Export du grand livre impossible', 'error');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .adminGetTransactions()
      .then((data) => {
        if (cancelled) return;
        setTransactions(data ?? []);
        setError(null);
      })
      .catch((err: any) => {
        if (cancelled) return;
        const message = err?.message || 'Chargement des transactions impossible';
        setError(message);
        addNotification(message, 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addNotification]);

  const providerOf = (tx: AdminTransaction): string =>
    tx.paymentProvider || tx.paymentMethod || 'INCONNU';

  const totals = transactions.reduce(
    (acc, tx) => {
      acc.volume += tx.amountFcfa;
      acc.commission += tx.commissionFcfa;
      acc.payout += tx.ownerPayoutFcfa;
      return acc;
    },
    { volume: 0, commission: 0, payout: 0 }
  );

  const providerTotals = transactions.reduce<Record<string, { count: number; amount: number }>>(
    (acc, tx) => {
      const key = providerOf(tx);
      const current = acc[key] ?? { count: 0, amount: 0 };
      acc[key] = { count: current.count + 1, amount: current.amount + tx.amountFcfa };
      return acc;
    },
    {}
  );

  const providerKeys = Object.keys(providerTotals);
  const term = search.trim().toLowerCase();
  const visible = transactions.filter((tx) => {
    if (providerFilter !== 'ALL' && providerOf(tx) !== providerFilter) return false;
    if (!term) return true;
    return (
      tx.reference.toLowerCase().includes(term) ||
      (tx.clientName || '').toLowerCase().includes(term) ||
      tx.payerName.toLowerCase().includes(term)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 block">
            Trésorerie &amp; Grand livre Mobile Money
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-emerald-950 mt-1">
            Transactions &amp; répartition des commissions
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Suivi des encaissements locatifs et du partage commissions VFC / reversements propriétaires.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={exporting}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-900 text-white text-xs font-bold shadow-sm hover:bg-emerald-950 transition-colors disabled:opacity-60"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Exporter le grand livre (CSV)
        </button>
      </header>

      {loading ? (
        <div className="py-16 flex flex-col items-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-800" />
          <p className="mt-3 text-xs">Chargement du grand livre…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-white border border-amber-200 shadow-sm p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-700">{error}</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <Receipt className="w-7 h-7" />
          </div>
          <h2 className="font-serif text-lg font-bold text-emerald-950">Aucune transaction enregistrée</h2>
          <p className="text-xs text-slate-600 mt-2">
            Les encaissements Mobile Money apparaîtront ici dès le premier règlement.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total encaissé', value: totals.volume, icon: Wallet, tone: 'emerald' as const },
              { label: 'Commissions VFC', value: totals.commission, icon: Percent, tone: 'amber' as const },
              { label: 'Reversements propriétaires', value: totals.payout, icon: Banknote, tone: 'emerald' as const }
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl liquid-glass-card border border-white/60 shadow-sm p-5 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-1.5 text-lg font-bold text-emerald-950 font-mono tabular-nums break-words">
                    {formatFcfa(item.value)}
                  </p>
                </div>
                <span
                  className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                    item.tone === 'amber'
                      ? 'bg-amber-100 text-[#D97706]'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                </span>
              </div>
            ))}
          </div>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 font-serif text-base font-bold text-emerald-950">
              <Smartphone className="w-5 h-5 text-[#D97706]" />
              Répartition par opérateur
            </h2>
            <div className="flex flex-wrap gap-3">
              {providerKeys.map((key) => (
                <div
                  key={key}
                  className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 min-w-[10rem]"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {key}
                  </p>
                  <p className="text-sm font-bold text-emerald-950 font-mono tabular-nums mt-1">
                    {formatFcfa(providerTotals[key].amount)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {providerTotals[key].count} opération{providerTotals[key].count > 1 ? 's' : ''}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="w-full sm:w-64 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#D97706]"
            >
              <option value="ALL">Tous les opérateurs</option>
              {providerKeys.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une référence, un client…"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#D97706]"
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center">
              <p className="text-xs font-semibold text-slate-700">
                Aucune transaction ne correspond à ce filtre.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-white border border-slate-200 shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5">Référence VFC</th>
                    <th className="p-3.5">Client &amp; numéro</th>
                    <th className="p-3.5">Opérateur</th>
                    <th className="p-3.5">Objet</th>
                    <th className="p-3.5 text-right">Montant</th>
                    <th className="p-3.5 text-right">Commission VFC</th>
                    <th className="p-3.5 text-right">Reversement propriétaire</th>
                    <th className="p-3.5 text-center">Statut</th>
                    <th className="p-3.5">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/60">
                      <td className="p-3.5 font-mono font-bold text-emerald-950 whitespace-nowrap">
                        {tx.reference}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-900">
                          {tx.clientName || tx.payerName}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                          {tx.clientPhone || tx.payerPhone}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="font-semibold text-slate-800">{providerOf(tx)}</span>
                      </td>
                      <td className="p-3.5 text-slate-600 whitespace-nowrap">{tx.purpose}</td>
                      <td className="p-3.5 text-right font-mono tabular-nums font-black text-emerald-900 whitespace-nowrap">
                        {formatFcfa(tx.amountFcfa)}
                      </td>
                      <td className="p-3.5 text-right font-mono tabular-nums text-[#D97706] font-bold whitespace-nowrap">
                        {formatFcfa(tx.commissionFcfa)}
                      </td>
                      <td className="p-3.5 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatFcfa(tx.ownerPayoutFcfa)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${statusPillClass(tx.status)}`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400 text-[11px] whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};
