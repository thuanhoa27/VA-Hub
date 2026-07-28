/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/app/**/*.{js,jsx}', './src/components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Palette OnPoint — trung khop :root trong engine.css.
        // Doi mau: sua CA 2 cho (scripts/_source/shell.html va file nay).
        op: {
          red: '#C51B1E',
          redD: '#991B1E',
          redL: '#FBEAEA',
          blue: '#1F5AA6',
          blueD: '#163B66',
          blueL: '#EAF2FB',
          ink: '#383835',
          ink2: '#667085',
          bg: '#F5F7FA',
          line: '#D9DEE5',
          pos: '#16855B',
          neg: '#B42318',
          warn: '#D97706',
        },
      },
      fontFamily: {
        sans: ['Aptos', 'Segoe UI', 'Arial', 'sans-serif'],
      },
    },
  },
  // Tailwind chi dung cho VO app (header, trang /runs). Man hinh phan tich
  // van dung engine.css goc -> preflight se pha layout do nen phai tat.
  corePlugins: { preflight: false },
  plugins: [],
};
