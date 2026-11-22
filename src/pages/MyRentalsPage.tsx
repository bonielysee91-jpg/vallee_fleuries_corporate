import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore.ts';
import { api, formatFcfa } from '../services/api.ts';
import { Booking, LeaseAgreement, VisitAppointment, VisitStatus } from '../types/index.ts';
import {
  Building2,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  MessageSquare,
  Compass,
  FileText,
  ArrowRight,
  AlertTriangle,
  XCircle,
  type LucideIcon
} from 'lucide-react';

/** Présentation des statuts d'une demande de visite côté client. */
const VISIT_STATUS_META: Record<VisitStatus, { label: string; className: string; Icon: LucideIcon }> = {
  PENDING: { label: 'En attente', className: 'bg-amber-100 text-amber-800', Icon: Clock },
  CONFIRMED: { label: 'Acceptée', className: 'bg-emerald-100 text-emerald-800', Icon: CheckCircle2 },
  COMPLETED: { label: 'Effectuée', className: 'bg-blue-100 text-blue-800', Icon: CalendarCheck },
  CANCELLED: { label: 'Refusée', className: 'bg-rose-100 text-rose-700', Icon: XCircle }
};

/** `/my-rentals` — active long-term leases and short-stay bookings of the tenant. */
export const MyRentalsPage: React.FC = () => {
  const setView = useAppStore((state) => state.setView);
  const [tab, setTab] = useState<'LEASES' | 'BOOKINGS' | 'VISITS'>('LEASES');
  const [leases, setLeases] = useState<LeaseAgreement[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [visits, setVisits] = useState<VisitAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getMyRentals(), api.getMyVisits()])
      .then(([rentals, myVisits]) => {
        if (cancelled) return;
        setLeases(rentals.leases ?? []);
        setBookings(rentals.bookings ?? []);
        setVisits(myVisits ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Chargement impossible');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const formatDate = (value?: string) =>
    value ? new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

  const renderLease = (lease: LeaseAgreement) => (
    <article key={lease.id} className="liquid-glass-card rounded-3xl p-5 border border-white/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-black uppercase tracking-wide">
            <FileText className="w-3 h-3" />
            Bail {lease.leaseNumber}
          </span>
          <h3 className="font-serif text-base font-bold text-slate-900 mt-2">
            {lease.propertyTitle || 'Résidence locative'}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            Du {formatDate(lease.startDate)} au {formatDate(lease.endDate)}
          </p>
        </div>
        <span
          className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
            lease.status === 'ACTIVE'
              ? 'bg-emerald-900 text-amber-400'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {lease.status}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Loyer mensuel', value: formatFcfa(lease.monthlyRentFcfa) },
          { label: 'Caution', value: formatFcfa(lease.depositAmountFcfa) },
          { label: 'Avance', value: formatFcfa(lease.advanceAmountFcfa) },
          { label: 'Total entrée', value: formatFcfa(lease.totalMoveInFcfa) }
        ].map((item) => (
          <div key={item.label} className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2.5">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {item.label}
            </dt>
            <dd className="text-xs font-bold text-emerald-900 mt-0.5">{item.value}</dd>
          </div>
        ))}
      </dl>

      {lease.contractPdfUrl && (
        <a
          href={lease.contractPdfUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 hover:text-emerald-600"
        >
          Télécharger le contrat certifié
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      )}
    </article>
  );

  const renderBooking = (booking: Booking) => (
    <article key={booking.id} className="liquid-glass-card rounded-3xl p-5 border border-white/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wide">
            <CalendarCheck className="w-3 h-3" />
            Réservation {booking.bookingNumber}
          </span>
          <h3 className="font-serif text-base font-bold text-slate-900 mt-2">
            {booking.propertyTitle || 'Bien locatif'}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-700" />
            {booking.propertyCommune || 'Abidjan'}
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-wide">
          {booking.status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Arrivée</p>
          <p className="text-xs font-bold text-slate-900 mt-0.5">{formatDate(booking.checkInDate)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Départ</p>
          <p className="text-xs font-bold text-slate-900 mt-0.5">{formatDate(booking.checkOutDate)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Réservations</p>
          <p className="text-xs font-bold text-slate-900 mt-0.5">{booking.numberOfNights}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total</p>
          <p className="text-xs font-bold text-emerald-900 mt-0.5">
            {formatFcfa(booking.totalAmountFcfa)}
          </p>
        </div>
      </div>
    </article>
  );

  const renderVisit = (visit: VisitAppointment) => {
    const meta = VISIT_STATUS_META[visit.status];
    return (
      <article key={visit.id} className="liquid-glass-card rounded-3xl p-5 border border-white/60">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-black uppercase tracking-wide">
              <CalendarClock className="w-3 h-3" />
              Demande de visite
            </span>
            <h3 className="font-serif text-base font-bold text-slate-900 mt-2">
              {visit.propertyTitle || 'Bien immobilier'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-700" />
              {visit.commune || 'Abidjan'} · {formatDate(visit.scheduledDate)}
              {visit.scheduledTime ? ` · ${visit.scheduledTime}` : ''}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide ${meta.className}`}
          >
            <meta.Icon className="w-3 h-3" />
            {meta.label}
          </span>
        </div>

        {visit.adminMessage ? (
          <div className="mt-4 rounded-2xl bg-emerald-950 text-white p-4 border border-emerald-900">
            <p className="text-[10px] font-black uppercase tracking-wide text-amber-400 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Message de l'administrateur
            </p>
            <p className="text-xs text-emerald-50/90 mt-1.5 leading-relaxed">{visit.adminMessage}</p>
          </div>
        ) : (
          <p className="mt-4 text-[11px] text-slate-500">
            {visit.status === 'PENDING'
              ? "Votre demande est en cours d'examen par la Direction. La réponse s'affichera ici."
              : 'Aucun message complémentaire.'}
          </p>
        )}
      </article>
    );
  };

  const visible: Array<LeaseAgreement | Booking | VisitAppointment> =
    tab === 'LEASES' ? leases : tab === 'BOOKINGS' ? bookings : visits;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">
          Mes locations & séjours
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Baux longue durée en cours et réservations de biens locatifs.
        </p>
      </header>

      <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-100 w-fit">
        {([
          { id: 'LEASES' as const, label: `Baux (${leases.length})`, icon: FileText },
          { id: 'BOOKINGS' as const, label: `Séjours (${bookings.length})`, icon: CalendarCheck },
          { id: 'VISITS' as const, label: `Visites (${visits.length})`, icon: CalendarClock }
        ]).map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${
              tab === item.id ? 'bg-white text-emerald-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <item.icon className="w-3.5 h-3.5" />
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-800" />
          <p className="mt-3 text-xs">Chargement de vos contrats…</p>
        </div>
      ) : error ? (
        <div className="liquid-glass-card rounded-3xl p-8 text-center border border-amber-200">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-700">{error}</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="liquid-glass-card rounded-3xl p-10 text-center border border-white/60">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <Building2 className="w-7 h-7" />
          </div>
          <h2 className="font-serif text-lg font-bold text-slate-900">
            {tab === 'LEASES'
              ? 'Aucun bail actif'
              : tab === 'BOOKINGS'
              ? 'Aucun séjour réservé'
              : 'Aucune demande de visite'}
          </h2>
          <p className="text-xs text-slate-500 mt-2 mb-6">
            {tab === 'VISITS'
              ? "Programmez une visite depuis la fiche d'un bien : vous suivrez ici sa validation par la Direction."
              : 'Explorez le catalogue pour trouver votre prochaine résidence à Abidjan.'}
          </p>
          <button
            onClick={() => setView('properties')}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-900 to-emerald-800 text-amber-400 text-xs font-bold"
          >
            <Compass className="w-4 h-4" />
            Explorer les biens disponibles
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((item) =>
            'leaseNumber' in item
              ? renderLease(item as LeaseAgreement)
              : 'bookingNumber' in item
              ? renderBooking(item as Booking)
              : renderVisit(item as VisitAppointment)
          )}
        </div>
      )}
    </div>
  );
};
