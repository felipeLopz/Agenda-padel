import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Build estático en dist/. Con vite-plugin-pwa la app queda instalable (manifest + service
// worker) y funciona offline. IMPORTANTE: NO se agrega runtimeCaching, así las llamadas a
// Supabase (auth y datos) van SIEMPRE a la red y nunca se sirven cacheadas/viejas.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Auto-update: al publicar una versión nueva, el service worker baja el nuevo cache en
      // segundo plano, se activa (skipWaiting/clientsClaim) y en la próxima recarga el usuario
      // ya tiene la última versión. Nunca queda pegado a una versión vieja cacheada.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Estos assets estáticos (íconos) también se precachean para que estén offline.
      includeAssets: ['apple-touch-icon.png', 'favicon-48x48.png'],
      manifest: {
        name: 'Agenda de Pádel',
        short_name: 'Pádel',
        description: 'Agenda de clases de pádel: turnos, alumnos y cobros.',
        lang: 'es-AR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        // Colores acordes a la paleta "Estadio Nocturno" (navy).
        theme_color: '#050912',
        background_color: '#050c2e',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          // "maskable": Android lo recorta a círculo/squircle; tiene margen de seguridad.
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache del "app shell": HTML/JS/CSS/íconos → la app abre aunque no haya internet.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // SPA: cualquier navegación cae a index.html (no afecta a los fetch de Supabase).
        navigateFallback: '/index.html',
        // Limpia caches de versiones anteriores al actualizar.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: {
        // No registrar el SW en desarrollo (npm run dev), solo en el build de producción.
        enabled: false,
      },
    }),
  ],
});
