import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0D1B2A',
        secondary: '#F4A261',
        tertiary: '#E9C46A',
      },
    },
  },
})