/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_REACTIVE_CHAIN_ID: string
  readonly VITE_LASNA_CHAIN_ID: string
  readonly VITE_ORIGIN_POSITION_ADDRESS: string
  readonly VITE_REACTIVE_MANAGER_ADDRESS: string
  readonly VITE_DESTINATION_HANDLER_ADDRESS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  ethereum?: any
}