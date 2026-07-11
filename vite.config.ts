import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuración mínima: build estático en dist/, sin pasos extra de despliegue.
export default defineConfig({
  plugins: [react()],
});
