import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore.ts';
import { api } from '../../services/api.ts';
import { X, Calendar, Clock, Video, UserCheck, MessageSquare, CheckCircle, ExternalLink } from 'lucide-react';

export const VisitModal: React.FC = () => {
  const { isVisitModalOpen, closeVisitModal, selectedPropertyId, addNotification, currentUser } = useAppStore();
  const [property, setProperty] = useState<any>(null);
  const [visitType, setVisitType] = useState<'PHYSICAL' | 'VIDEO_CALL'>('PHYSICAL');
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [time, setTime] = useState('15:00');
  const [name, setName] = useState(currentUser?.fullName ?? '');
  const [phone, setPhone] = useState(currentUser?.phoneNumber ?? '');
  const [email, setEmail] = useState(currentUser?.email ?? '');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedVisit, setConfirmedVisit] = useState<any>(null);

  React.useEffect(() => {
    if (selectedPropertyId && isVisitModalOpen) {
      api.getPropertyById(selectedPropertyId).then(setProperty);
    }
  }, [selectedPropertyId, isVisitModalOpen]);

  if (!isVisitModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const created = await api.scheduleVisit({
        propertyId: selectedPropertyId || 'prop_vfc_01',
        userName: name,
        clientPhone: phone,
        clientEmail: email,
        scheduledDate: date,
        scheduledTime: time,
        visitType,
        notes
      });
      setConfirmedVisit(created);
      addNotification('Visite confirmée avec succès dans l\'agenda VFC !', 'success');
    } catch (err: any) {
      addNotification(err.message || 'Erreur lors de la programmation', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg liquid-glass-card bg-white/95 rounded-2xl shadow-2xl border border-white/60 overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <h3 className="text-lg font-bold text-emerald-950 font-serif">
              {confirmedVisit ? 'Visite Confirmée' : 'Programmer une Visite Exclusive'}
            </h3>
            <p className="text-xs text-slate-500">
              {property ? property.title : 'Propriété sélectionnée'}
            </p>
          </div>
          <button
            onClick={closeVisitModal}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {confirmedVisit ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Rendez-vous Enregistré</h4>
                <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                  Votre demande pour le {new Date(confirmedVisit.scheduledDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {confirmedVisit.scheduledTime} est assignée à {property?.agent?.fullName ?? property?.landlord?.fullName ?? 'la Conciergerie Vallées Fleuries'}.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-left text-xs space-y-1.5 text-emerald-900">
                <div className="font-semibold">Détails de transmission :</div>
                <div>· Type : {confirmedVisit.visitType === 'PHYSICAL' ? 'Visite sur site avec accompagnement privé' : 'Visite vidéo guidée en direct'}</div>
                <div>· Propriété : {confirmedVisit.propertyTitle}</div>
                <div>· Client : {confirmedVisit.userName} ({confirmedVisit.clientPhone})</div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <a
                  href={confirmedVisit.whatsAppNotifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all"
                >
                  <MessageSquare className="w-4 h-4 fill-white" />
                  <span>Ouvrir la notification WhatsApp agent</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  onClick={closeVisitModal}
                  className="w-full py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Fermer
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Visit Type Toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Format du rendez-vous
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setVisitType('PHYSICAL')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                      visitType === 'PHYSICAL'
                        ? 'bg-white text-emerald-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span>Visite Physique sur Site</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisitType('VIDEO_CALL')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                      visitType === 'VIDEO_CALL'
                        ? 'bg-white text-emerald-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Video className="w-4 h-4 text-amber-600" />
                    <span>Visite Guidée Vidéo</span>
                  </button>
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date souhaitée
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Créneau horaire
                  </label>
                  <select
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  >
                    <option value="10:00">10:00 - Matin</option>
                    <option value="11:30">11:30 - Matin</option>
                    <option value="14:00">14:00 - Début d'après-midi</option>
                    <option value="15:30">15:30 - Après-midi</option>
                    <option value="17:00">17:00 - Fin de journée</option>
                  </select>
                </div>
              </div>

              {/* Client Info */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nom & Prénoms complets
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    placeholder="Ex: M. Kouamé Jean"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Téléphone mobile (avec indicatif)
                    </label>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                      placeholder="+225 07 00 00 00 00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Courriel professionnel
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                      placeholder="nom@entreprise.ci"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Consignes particulières / Présence architecte (optionnel)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    placeholder="Ex: Visite pour estimation d'aménagement ou signature du bail..."
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white font-semibold text-xs tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Calendar className="w-4 h-4 text-amber-300" />
                  <span>{isSubmitting ? 'Confirmation en cours...' : 'Confirmer le Rendez-vous'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
