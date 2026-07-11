/// <reference types="vite/client" />

// Tipado de las variables de entorno usadas por la app (Tanda 6).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
