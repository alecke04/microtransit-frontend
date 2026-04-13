/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        fpuPurple: '#501D83',    // FPU Primary Purple
        fpuCyan: '#009FDF',      // FPU Secondary Cyan
        fpuDark: '#2E1A4A',      // FPU Dark Purple
        fpuBase: '#1D1626',      // FPU Base Dark
        fpuGray: '#B6BABC',      // FPU Gray
        fpuMedium: '#586066',    // FPU Medium Gray
        fpuLight: '#57C0EA',     // FPU Light Cyan
        fpuBg: '#E5F5FC',        // FPU Cyan Background
        fpuBgLight: '#D0EBF7',   // FPU Light Cyan BG
      },
      animation: {
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        glow: 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(255, 80, 0, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(255, 80, 0, 0.8)' },
        },
      },
    },
  },
  plugins: [],
};
