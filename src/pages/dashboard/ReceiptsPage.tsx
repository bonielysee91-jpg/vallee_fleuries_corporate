import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { api, formatFcfa } from '../../services/api.ts';
import { QuittanceLoyer } from '../../types/index.ts';
import { FileText, Loader2, Printer, Sparkles, Wand2 } from 'lucide-react';

const MONTHS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre'
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

const emptyForm = () => ({
  tenantName: '',
  tenantPhone: '',
  propertyTitle: '',
  commune: '',
  monthIndex: new Date().getMonth(),
  year: new Date().getFullYear(),
  rentAmountFcfa: 0,
  chargesFcfa: 0,
  paymentDate: new Date().toISOString().slice(0, 10)
});

/** `/dashboard/receipts` — générateur de quittances de loyer (PDF / impression). */
export const ReceiptsPage: React.FC = () => {
  const addNotification = useAppStore((state) => state.addNotification);
  const openQuittanceModal = useAppStore((state) => state.openQuittanceModal);

  const [quittances, setQuittances] = useState<QuittanceLoyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getQuittances()
      .then((data) => {
        if (active) setQuittances(data);
      })
      .catch((err) => {
        addNotification(
          err instanceof Error ? err.message : 'Chargement des quittances impossible',
          'error'
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [addNotification]);

  const update = <K extends keyof ReturnType<typeof emptyForm>>(
    key: K,
    value: ReturnType<typeof emptyForm>[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const periodMonth = `${MONTHS_FR[form.monthIndex]} ${form.year}`;

  const totalPaidFcfa = useMemo(
    () => Number(form.rentAmountFcfa || 0) + Number(form.chargesFcfa || 0),
    [form.rentAmountFcfa, form.chargesFcfa]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.tenantName.trim() || !form.propertyTitle.trim()) {
      addNotification('Renseignez au minimum le locataire et le bien', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Partial<QuittanceLoyer> = {
        tenantName: form.tenantName,
        tenantPhone: form.tenantPhone,
        propertyTitle: form.propertyTitle,
        commune: form.commune,
        month: periodMonth,
        periodMonth,
        year: form.year,
        rentAmountFcfa: Number(form.rentAmountFcfa),
        chargesFcfa: Number(form.chargesFcfa),
        totalPaidFcfa,
        paymentDate: form.paymentDate,
        quittanceNumber: undefined,
        transactionReference: 'MANUEL'
      };
      const created = await api.generateQuittance(payload);
      setQuittances((prev) => [created, ...prev]);
      addNotification('Quittance générée avec succès', 'success');
      setForm(emptyForm());
    } catch (err) {
      addNotification(
        err instanceof Error ? err.message : 'Erreur lors de la génération',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#D97706]';
  const labelClass =
    'block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-emerald-950">
            Quittances de loyer
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Générez et conservez les reçus numériques de loyer de vos locataires.
          </p>
        </div>
        <button
          type="button"
          onClick={openQuittanceModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
        >
          <Wand2 className="w-4 h-4" />
          Éditer via l'assistant
        </button>
      </header>

      <form
        onSubmit={handleSubmit}
        className="liquid-glass-card rounded-2xl border border-white/60 shadow-sm p-4 sm:p-6 space-y-4"
      >
        <h2 className="font-serif text-lg font-bold text-emerald-950">
          Nouvelle quittance
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Locataire</label>
            <input
              value={form.tenantName}
              onChange={(e) => update('tenantName', e.target.value)}
              placeholder="Ex : Aïcha Koné"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Téléphone</label>
            <input
              value={form.tenantPhone}
              onChange={(e) => update('tenantPhone', e.target.value)}
              placeholder="+225 07 00 00 00 00"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Bien / Adresse</label>
            <input
              value={form.propertyTitle}
              onChange={(e) => update('propertyTitle', e.target.value)}
              placeholder="Ex : Résidence Les Palmiers"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Commune</label>
            <input
              value={form.commune}
              onChange={(e) => update('commune', e.target.value)}
              placeholder="Ex : Cocody"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Mois</label>
            <select
              value={form.monthIndex}
              onChange={(e) => update('monthIndex', Number(e.target.value))}
              className={inputClass}
            >
              {MONTHS_FR.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Année</label>
            <select
              value={form.year}
              onChange={(e) => update('year', Number(e.target.value))}
              className={inputClass}
            >
              {YEARS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Loyer hors charges (FCFA)</label>
            <input
              type="number"
              value={form.rentAmountFcfa}
              onChange={(e) => update('rentAmountFcfa', Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Charges (FCFA)</label>
            <input
              type="number"
              value={form.chargesFcfa}
              onChange={(e) => update('chargesFcfa', Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Date de paiement</label>
            <input
              type="date"
              value={form.paymentDate}
              onChange={(e) => update('paymentDate', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Total perçu</label>
            <p className="px-3 py-2 text-xs rounded-xl border border-amber-200 bg-amber-50 font-bold text-amber-700 font-mono tabular-nums">
              {formatFcfa(totalPaidFcfa)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Période : {periodMonth}
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-semibold shadow-md transition-colors disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            Générer la quittance
          </button>
        </div>
      </form>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-3">
        <h2 className="font-serif text-lg font-bold text-emerald-950">
          Registre des quittances émises
        </h2>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
            Chargement des quittances…
          </div>
        ) : quittances.length === 0 ? (
          <div className="py-10 text-center">
            <FileText className="w-8 h-8 mx-auto text-slate-300" />
            <h3 className="mt-3 font-serif text-base font-bold text-emerald-950">
              Aucune quittance émise
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Les quittances générées apparaîtront ici, prêtes à être imprimées.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {quittances.map((receipt) => (
              <li
                key={receipt.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-emerald-950 font-mono tabular-nums">
                    {receipt.quittanceNumber}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {receipt.periodMonth || receipt.month} · {receipt.tenantName}
                  </p>
                  <p className="text-[11px] text-slate-500">{receipt.propertyTitle}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-emerald-950 font-mono tabular-nums">
                    {formatFcfa(receipt.totalPaidFcfa)}
                  </span>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimer / PDF
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
