import React, { useEffect, useState } from 'react';
import { api, SystemArchitecture, SchemaField } from '../services/api.ts';
import {
  Database,
  Server,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Table2,
  ListTree,
  Layers,
  Link2
} from 'lucide-react';

/** Renders the Prisma modifier suffixes (`@id`, `@unique`, `?`, `[]`) for a field. */
const fieldModifiers = (field: SchemaField): string[] => {
  const badges: string[] = [];
  if (field.isId) badges.push('@id');
  if (field.isUnique) badges.push('@unique');
  if (field.isList) badges.push('[]');
  else if (!field.isRequired) badges.push('?');
  return badges;
};

/**
 * `/architecture` — public readout of the live Neon PostgreSQL schema.
 * Mirrors the « Neon DB Schema » panel: connection identity, the real Prisma
 * datamodel (19+ models & enums) and the tables actually present in the cloud.
 */
export const SystemArchitecturePage: React.FC = () => {
  const [data, setData] = useState<SystemArchitecture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getSystemArchitecture()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Lecture du schéma Neon impossible');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header>
        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 block">
          Socle technique Vallées Fleuries Corporate
        </span>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-emerald-950 mt-1">
          Architecture &amp; Schéma de la base Neon
        </h1>
        <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
          Structure de données qui garantit l'intégrité du registre immobilier, la sécurité des
          transactions Mobile Money et l'authentification stricte des visiteurs et de
          l'administration.
        </p>
      </header>

      {loading ? (
        <div className="py-20 flex flex-col items-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-800" />
          <p className="mt-3 text-xs">Interrogation de la base Neon…</p>
        </div>
      ) : error || !data ? (
        <div className="rounded-3xl bg-white border border-amber-200 shadow-sm p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-700">
            {error || 'Schéma indisponible pour le moment.'}
          </p>
        </div>
      ) : (
        <>
          {/* Connection identity panel */}
          <section className="relative rounded-3xl overflow-hidden bg-emerald-950 text-white p-6 sm:p-8 shadow-xl border border-emerald-900">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#F59E0B_1px,transparent_1px)] [background-size:18px_18px]" />
            <div className="relative z-10 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <Database className="w-4 h-4" />
                  Connexion base de données {data.provider}
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${
                    data.databaseReachable
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      data.databaseReachable ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  {data.databaseReachable ? 'Cloud joignable' : 'Cloud injoignable'}
                </span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {[
                  { label: 'Hôte', value: data.neon.host, icon: Server },
                  { label: 'Base de données', value: data.neon.database, icon: Database },
                  { label: 'Région', value: data.neon.region, icon: Layers },
                  { label: 'Chiffrement', value: data.neon.ssl ? 'SSL requis' : 'SSL désactivé', icon: ShieldCheck }
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/80 flex items-center gap-1.5">
                      <item.icon className="w-3.5 h-3.5" />
                      {item.label}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-white break-words">{item.value}</p>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-emerald-200/70 font-mono">{data.orm}</p>
            </div>
          </section>

          {/* Structural KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Modèles Prisma', value: data.counts.models, icon: Table2 },
              { label: 'Énumérations', value: data.counts.enums, icon: ListTree },
              { label: 'Tables Neon en ligne', value: data.counts.liveTables, icon: Database }
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-2xl liquid-glass-card border border-white/60 shadow-sm p-5 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {kpi.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-emerald-950 font-mono tabular-nums">
                    {kpi.value}
                  </p>
                </div>
                <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <kpi.icon className="w-5 h-5" />
                </span>
              </div>
            ))}
          </div>

          {/* Prisma datamodel */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Table2 className="w-5 h-5 text-emerald-700" />
              <h2 className="font-serif text-lg font-bold text-emerald-950">
                Modèles relationnels ({data.models.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.models.map((model) => (
                <article
                  key={model.name}
                  className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col"
                >
                  <header className="px-4 py-3 bg-emerald-950 text-white flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold truncate">{model.name}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-200">
                        <Layers className="w-3 h-3" />
                        {model.fieldCount}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-300">
                        <Link2 className="w-3 h-3" />
                        {model.relationCount}
                      </span>
                    </span>
                  </header>

                  <ul className="p-4 space-y-1.5 text-[11px] font-mono flex-1">
                    {model.fields.map((field) => (
                      <li key={field.name} className="flex items-baseline justify-between gap-3">
                        <span className="text-slate-700 truncate">{field.name}</span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          <span className="text-emerald-800 font-semibold">{field.type}</span>
                          {fieldModifiers(field).map((badge) => (
                            <span
                              key={badge}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                badge === '@id'
                                  ? 'bg-amber-100 text-amber-800'
                                  : badge === '@unique'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {badge}
                            </span>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          {/* Enums */}
          {data.enums.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <ListTree className="w-5 h-5 text-emerald-700" />
                <h2 className="font-serif text-lg font-bold text-emerald-950">
                  Énumérations ({data.enums.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.enums.map((enumDef) => (
                  <article
                    key={enumDef.name}
                    className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 space-y-2"
                  >
                    <h3 className="font-mono text-xs font-bold text-emerald-950">{enumDef.name}</h3>
                    <ul className="flex flex-wrap gap-1.5">
                      {enumDef.values.map((value) => (
                        <li
                          key={value}
                          className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-mono text-emerald-900"
                        >
                          {value}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Live tables actually present in Neon */}
          {data.liveTables.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-700" />
                <h2 className="font-serif text-lg font-bold text-emerald-950">
                  Tables détectées dans Neon ({data.liveTables.length})
                </h2>
              </div>
              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 flex flex-wrap gap-1.5">
                {data.liveTables.map((table) => (
                  <span
                    key={table}
                    className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700"
                  >
                    {table}
                  </span>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};
