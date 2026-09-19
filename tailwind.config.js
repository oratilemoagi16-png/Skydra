/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy bridge — values resolve to the --skydra-* semantic tokens.
        // Prefer the semantic utilities below for new code.
        drone: {
          primary: 'rgb(var(--drone-primary) / <alpha-value>)',
          secondary: 'rgb(var(--drone-secondary) / <alpha-value>)',
          accent: 'rgb(var(--drone-accent) / <alpha-value>)',
          dark: 'rgb(var(--drone-dark) / <alpha-value>)',
          surface: 'rgb(var(--drone-surface) / <alpha-value>)',
          muted: 'rgb(var(--drone-muted) / <alpha-value>)',
        },
        // Skydra semantic tokens (see src/index.css)
        canvas: 'rgb(var(--skydra-bg) / <alpha-value>)',
        surface: 'rgb(var(--skydra-surface) / <alpha-value>)',
        elevated: 'rgb(var(--skydra-elevated) / <alpha-value>)',
        ink: 'rgb(var(--skydra-text) / <alpha-value>)',
        muted: 'rgb(var(--skydra-muted) / <alpha-value>)',
        faint: 'rgb(var(--skydra-faint) / <alpha-value>)',
        line: 'rgb(var(--skydra-border) / <alpha-value>)',
        'line-strong': 'rgb(var(--skydra-border-strong) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--skydra-accent) / <alpha-value>)',
          hover: 'rgb(var(--skydra-accent-hover) / <alpha-value>)',
          ink: 'rgb(var(--skydra-accent-ink) / <alpha-value>)',
        },
        danger: 'rgb(var(--skydra-danger) / <alpha-value>)',
        warning: 'rgb(var(--skydra-warning) / <alpha-value>)',
        success: 'rgb(var(--skydra-success) / <alpha-value>)',
        focus: 'rgb(var(--skydra-focus) / <alpha-value>)',
        track: 'rgb(var(--skydra-track) / <alpha-value>)',
      },
      fontFamily: {
        sans: 'var(--skydra-font-sans)',
        mono: 'var(--skydra-font-mono)',
      },
      boxShadow: {
        overlay: 'var(--skydra-shadow-overlay)',
        dock: 'var(--skydra-shadow-dock)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
