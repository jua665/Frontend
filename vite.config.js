import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // Asegúrate de exponer tu aplicación en todas las interfaces
    port: 10000,      // El puerto que Render espera
  },
})
