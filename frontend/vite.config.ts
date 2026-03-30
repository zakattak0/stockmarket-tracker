import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  envDir: "..",
  envPrefix: ["VITE_", "STOCK_", "MARKETAUX_", "GEMINI_", "ALPHAVANTAGE_"],
  base: "/stockmarket-tracker/",
  plugins: [react()],
})
