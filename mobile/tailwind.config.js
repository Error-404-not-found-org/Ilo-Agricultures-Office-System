/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        outfit: ["Outfit_400Regular"],
        "outfit-medium": ["Outfit_500Medium"],
        "outfit-semibold": ["Outfit_600SemiBold"],
        "outfit-bold": ["Outfit_700Bold"],
        "outfit-extrabold": ["Outfit_800ExtraBold"],
        "outfit-black": ["Outfit_900Black"],
      },
      colors: {
        primary: {
          DEFAULT: '#00643B',
          dark: '#10b981'
        },
        bg: {
          DEFAULT: '#f8fafc',
          dark: '#090d16'
        },
        card: {
          DEFAULT: '#ffffff',
          dark: '#111827'
        },
        border: {
          DEFAULT: '#f1f5f9',
          dark: '#1f2937'
        }
      }
    },
  },
  plugins: [],
};
