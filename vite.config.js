import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // Permite que la aplicación sea accesible desde cualquier interfaz de red
    port: 10000,      // El puerto que Render espera
  }
})
