import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      /* ────────────────────────────────────────────
       *  COLORS — Deep Dark Mode + Neon Accents
       * ──────────────────────────────────────────── */
      colors: {
        // ── Deep Dark Backgrounds ──
        dark: {
          DEFAULT: "#030712",
          50: "#0d1321",
          100: "#0a1128",
          200: "#111d3f",
          300: "#162550",
          400: "#1e2d5a",
          500: "#1a1f3a",
          600: "#0f172a",
          700: "#0b1120",
          800: "#070c16",
          900: "#030712",
          950: "#010409",
        },

        // ── Neon Blue (Primary) ──
        neon: {
          blue: "#00d4ff",
          "blue-light": "#33ddff",
          "blue-dark": "#00a3c7",
          "blue-muted": "rgba(0, 212, 255, 0.5)",
          purple: "#a855f7",
          "purple-light": "#c084fc",
          "purple-dark": "#7c3aed",
          "purple-muted": "rgba(168, 85, 247, 0.5)",
        },

        // ── Status / Semantic ──
        status: {
          success: "#10b981",
          warning: "#f59e0b",
          danger: "#ef4444",
          info: "#06b6d4",
        },

        // ── Glass surface colors (rgba) ──
        glass: {
          DEFAULT: "rgba(255, 255, 255, 0.05)",
          light: "rgba(255, 255, 255, 0.08)",
          medium: "rgba(255, 255, 255, 0.12)",
          heavy: "rgba(255, 255, 255, 0.18)",
          border: "rgba(255, 255, 255, 0.08)",
          "border-light": "rgba(255, 255, 255, 0.15)",
        },
      },

      /* ────────────────────────────────────────────
       *  BOX SHADOWS — Neon Glow + Glass Depth
       * ──────────────────────────────────────────── */
      boxShadow: {
        // Neon Blue glow
        "neon-blue-sm":
          "0 0 10px rgba(0, 212, 255, 0.2)",
        "neon-blue":
          "0 0 20px rgba(0, 212, 255, 0.3), 0 0 60px rgba(0, 212, 255, 0.1)",
        "neon-blue-lg":
          "0 0 30px rgba(0, 212, 255, 0.4), 0 0 80px rgba(0, 212, 255, 0.15)",

        // Neon Purple glow
        "neon-purple-sm":
          "0 0 10px rgba(168, 85, 247, 0.2)",
        "neon-purple":
          "0 0 20px rgba(168, 85, 247, 0.3), 0 0 60px rgba(168, 85, 247, 0.1)",
        "neon-purple-lg":
          "0 0 30px rgba(168, 85, 247, 0.4), 0 0 80px rgba(168, 85, 247, 0.15)",

        // Glass shadows (depth + inner highlight)
        glass:
          "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        "glass-lg":
          "0 16px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        "glass-glow-blue":
          "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(0, 212, 255, 0.15)",
        "glass-glow-purple":
          "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(168, 85, 247, 0.15)",

        // Inner glow (top edge highlight)
        "inner-glow":
          "inset 0 1px 1px rgba(255, 255, 255, 0.06)",
      },

      /* ────────────────────────────────────────────
       *  BACKDROP BLUR — Glassmorphism
       * ──────────────────────────────────────────── */
      backdropBlur: {
        xs: "2px",
        glass: "12px",
        "glass-lg": "20px",
        "glass-xl": "32px",
      },

      /* ────────────────────────────────────────────
       *  ANIMATIONS & KEYFRAMES
       * ──────────────────────────────────────────── */
      animation: {
        "pulse-neon": "pulse-neon 2s ease-in-out infinite",
        glow: "glow 2s ease-in-out infinite alternate",
        "radar-sweep": "radar-sweep 4s linear infinite",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "fade-in-up": "fade-in-up 0.5s ease-out forwards",
        "slide-in-right": "slide-in-right 0.3s ease-out forwards",
        shimmer: "shimmer 2s linear infinite",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        "pulse-neon": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        glow: {
          from: {
            boxShadow:
              "0 0 10px rgba(0, 212, 255, 0.2), 0 0 20px rgba(0, 212, 255, 0.1)",
          },
          to: {
            boxShadow:
              "0 0 20px rgba(0, 212, 255, 0.4), 0 0 40px rgba(0, 212, 255, 0.2), 0 0 60px rgba(0, 212, 255, 0.1)",
          },
        },
        "radar-sweep": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(-12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },

      /* ────────────────────────────────────────────
       *  GRADIENTS
       * ──────────────────────────────────────────── */
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-neon": "linear-gradient(135deg, #00d4ff, #a855f7)",
        "gradient-neon-vertical": "linear-gradient(180deg, #00d4ff, #a855f7)",
        "gradient-dark": "linear-gradient(180deg, #030712, #0a1128)",
        "gradient-glass":
          "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
        "gradient-mesh":
          "radial-gradient(at 40% 20%, rgba(0, 212, 255, 0.08) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(168, 85, 247, 0.06) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(0, 212, 255, 0.04) 0px, transparent 50%)",
      },

      /* ────────────────────────────────────────────
       *  BORDER RADIUS
       * ──────────────────────────────────────────── */
      borderRadius: {
        glass: "16px",
        "glass-lg": "24px",
      },

      /* ────────────────────────────────────────────
       *  FONTS
       * ──────────────────────────────────────────── */
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
