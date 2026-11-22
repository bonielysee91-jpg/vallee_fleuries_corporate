import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    build: {
      // Découpage des dépendances en chunks « vendor » stables : le navigateur les
      // télécharge en parallèle puis les met en cache durablement d'un déploiement à
      // l'autre (leur hash ne change que si la librairie évolue), au lieu de recharger
      // tout le bundle à chaque mise à jour du code applicatif.
      rollupOptions: {
        output: {
          // Vite 8 (Rolldown) exige la forme fonctionnelle de `manualChunks`.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return;
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('zustand')) return 'vendor-zustand';
            if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
              return 'vendor-react';
            }
          },
        },
      },
    },
    server: {
      host:true,
      port:5000,
      allowedhosts:true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
