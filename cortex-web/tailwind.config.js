export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0b1020',
          900: '#121a33',
          800: '#1b2650'
        },
        cortex: {
          50: '#f4f7ff',
          100: '#e7eeff',
          200: '#c8d7ff',
          300: '#9db8ff',
          400: '#6f95ff',
          500: '#3f6fff',
          600: '#1f4fe6',
          700: '#173bb0',
          800: '#122a7d',
          900: '#0f225f'
        },
        accent: {
          500: '#ff6b35'
        }
      },
      boxShadow: {
        glass: '0 10px 30px rgba(0,0,0,0.25)'
      }
    }
  },
  plugins: []
};
