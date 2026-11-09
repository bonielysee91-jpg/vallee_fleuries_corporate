import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { api, formatFcfa } from '../../services/api.ts';
import { Booking, Property } from '../../types/index.ts';
import {
  BedDouble,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin
} from 'lucide-react';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** `/dashboard/calendar` — gestionnaire de disponibilité du portefeuille. */
export const CalendarPage: React.FC = () => {
  const addNotification = useAppStore((state) => state.addNotification);

  const [properties, setProperties] = useState<Property[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [cursor, setCursor] = useState(() => new Date());

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([api.getProperties(), api.getBookings()])
      .then(([propList, bookingList]) => {
        if (!active) return;
        setProperties(propList);
        setBookings(bookingList);
        const first = propList[0];
        setSelectedId((prev) => prev || first?.id || '');
      })
      .catch((err) => {
        addNotification(
          err instanceof Error ? err.message : 'Chargement du calendrier impossible',
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

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1)
  ];

  const selectedProperty = useMemo(
    () => properties.find((prop) => prop.id === selectedId) ?? null,
    [properties, selectedId]
  );

  const propertyBookings = useMemo(
    () => bookings.filter((booking) => booking.propertyId === selectedId),
    [bookings, selectedId]
  );

  const activeBookings = useMemo(
    () => propertyBookings.filter((booking) => booking.status !== 'CANCELLED'),
    [propertyBookings]
  );

  const upcoming = useMemo(
    () =>
      [...propertyBookings].sort(
        (a, b) => new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime()
      ),
    [propertyBookings]
  );

  const bookingForDay = (day: number): Booking | null => {
    const target = new Date(year, month, day);
    return (
      activeBookings.find((booking) => {
        const checkIn = new Date(booking.checkInDate);
        const checkOut = new Date(booking.checkOutDate);
        const start = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
        const end = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
        return start <= target && target <= end;
      }) ?? null
    );
  };

  const monthTitle = cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const shiftMonth = (delta: number) =>
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  const inputClass =
    'w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#D97706]';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-emerald-950">
            Calendrier des disponibilités
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Visualisez les réservations et les périodes disponibles de vos biens.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-xs text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
          Chargement du calendrier…
        </div>
      ) : properties.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <CalendarDays className="w-8 h-8 mx-auto text-slate-300" />
          <h2 className="mt-3 font-serif text-lg font-bold text-emerald-950">
            Aucun bien publié
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Publiez un bien pour gérer son calendrier de disponibilité.
          </p>
        </div>
      ) : (
        <>
          <div className="liquid-glass-card rounded-2xl border border-white/60 shadow-sm p-4 sm:p-5 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Bien immobilier
              </label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className={inputClass}
              >
                <option value="">Sélectionnez un bien</option>
                {properties.map((prop) => (
                  <option key={prop.id} value={prop.id}>
                    {prop.title} — {prop.commune}
                  </option>
                ))}
              </select>
            </div>

            {selectedProperty && (
              <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                {selectedProperty.commune} · {selectedProperty.neighborhood}
                <span className="mx-1 text-slate-300">|</span>
                <BedDouble className="w-3.5 h-3.5 text-emerald-700" />
                {selectedProperty.bedrooms} ch. · {selectedProperty.bathrooms} sdb
              </p>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Mois précédent
              </button>
              <p className="font-serif text-base font-bold text-emerald-950 capitalize">
                {monthTitle}
              </p>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Mois suivant
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {WEEKDAYS.map((label) => (
                <div
                  key={label}
                  className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 py-1"
                >
                  {label}
                </div>
              ))}

              {cells.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="h-16 sm:h-20" />;
                }
                const booking = bookingForDay(day);
                const reserved = Boolean(booking);
                return (
                  <div
                    key={`day-${day}`}
                    title={
                      booking
                        ? `Réservé — ${booking.bookingNumber} · ${booking.tenantName}`
                        : 'Disponible'
                    }
                    className={`h-16 sm:h-20 rounded-xl border p-1.5 flex flex-col justify-between transition-colors ${
                      reserved
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-emerald-100 bg-emerald-50/60'
                    }`}
                  >
                    <span
                      className={`text-[11px] font-bold font-mono tabular-nums ${
                        reserved ? 'text-amber-700' : 'text-emerald-800'
                      }`}
                    >
                      {day}
                    </span>
                    <span
                      className={`text-[9px] font-semibold uppercase tracking-wide ${
                        reserved ? 'text-amber-700' : 'text-emerald-600'
                      }`}
                    >
                      {reserved ? 'Réservé' : 'Libre'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 pt-1">
              <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <span className="w-3 h-3 rounded-sm border border-emerald-200 bg-emerald-50/80" />
                Disponible
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <span className="w-3 h-3 rounded-sm border border-amber-300 bg-amber-100" />
                Réservé
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-3">
            <h2 className="font-serif text-lg font-bold text-emerald-950">
              Réservations à venir
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-xs text-slate-500">
                Aucune réservation enregistrée pour ce bien.
              </p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((booking) => (
                  <li
                    key={booking.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-emerald-950 font-mono tabular-nums">
                        {booking.bookingNumber}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {booking.tenantName} · {booking.tenantPhone}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {new Date(booking.checkInDate).toLocaleDateString('fr-FR')} →{' '}
                        {new Date(booking.checkOutDate).toLocaleDateString('fr-FR')} ·{' '}
                        {booking.numberOfNights} mois
                      </p>
                    </div>
                    <span className="text-xs font-bold text-emerald-950 font-mono tabular-nums">
                      {formatFcfa(booking.totalAmountFcfa)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};
