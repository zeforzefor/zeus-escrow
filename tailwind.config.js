import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))

export default {
  content: [`${root}index.html`, `${root}src/**/*.{js,ts,jsx,tsx}`],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#050B1C',
          900: '#081330',
          800: '#0D1B40',
          700: '#14275A',
        },
        electric: {
          DEFAULT: '#2F6BFF',
          soft: '#5B8CFF',
          deep: '#1E4FD6',
        },
        gold: {
          DEFAULT: '#F5C451',
          soft: '#FBE0A0',
          deep: '#C9962B',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
