import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';

/** `*` fallback — unknown route. */
export const NotFoundPage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
      <div className="w-full max-w-lg rounded-2xl liquid-glass-emerald border border-white/20 shadow-lg p-10 text-center">
        <p className="font-serif text-6xl font-bold text-amber-400">404</p>
        <h1 className="font-serif text-xl font-bold text-white mt-3">
          Cette page n'existe pas ou a été déplacée.
        </h1>
        <p className="text-xs text-emerald-100/80 mt-2">
          Le lien est peut-être obsolète, ou l'adresse a été saisie de manière incorrecte.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-emerald-950 text-xs font-semibold shadow-md hover:bg-emerald-50 transition-colors"
          >
            <Home className="w-4 h-4" />
            Retour à l'accueil
          </Link>
          <Link
            to="/properties"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 text-emerald-950 text-xs font-semibold shadow-md hover:bg-amber-300 transition-colors"
          >
            <Compass className="w-4 h-4" />
            Explorer les biens
          </Link>
        </div>
      </div>
    </div>
  );
};
