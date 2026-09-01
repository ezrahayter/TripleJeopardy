import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared/src', import.meta.url)),
    },
  },
  server: {
    // allow importing @shared from outside the web/ root during dev
    fs: { allow: ['..', '../..'] },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom', 'react-router'],
          supabase: ['@supabase/supabase-js'],
          'date-fns': ['date-fns'],
          'lucide-react': ['lucide-react'],
          radix: ['radix-ui', '@radix-ui/react-use-controllable-state', 'cmdk'],
          'day-picker': ['react-day-picker'],
          'dnd-kit': [
            '@dnd-kit/core',
            '@dnd-kit/modifiers',
            '@dnd-kit/sortable',
            '@dnd-kit/utilities',
          ],
          // media-chrome (kibo-ui/video-player) is vendored but not yet imported
          // anywhere; add `'media-chrome': ['media-chrome']` here once it is.
        },
      },
    },
  },
});
