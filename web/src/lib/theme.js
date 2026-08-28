export const THEME_OPTIONS = [
  {
    value: "breedsmart",
    label: "BreedSmart Light",
    description: "Bright branded surfaces for daytime work.",
  },
  {
    value: "breedsmart-dark",
    label: "BreedSmart Dark",
    description: "Forest-based dark surfaces with BreedSmart semantics.",
  },
];

const THEME_VALUES = new Set(THEME_OPTIONS.map((theme) => theme.value));

export const normalizeTheme = (theme) => {
  if (theme === "emerald") return "breedsmart";
  if (["night", "forest", "black", "dracula"].includes(theme)) {
    return "breedsmart-dark";
  }
  if (theme === "lofi") return "breedsmart";
  return THEME_VALUES.has(theme) ? theme : "breedsmart";
};

export const getStoredTheme = () =>
  normalizeTheme(localStorage.getItem("theme"));

export const isDarkTheme = (theme) =>
  normalizeTheme(theme) === "breedsmart-dark";

export const applyTheme = (nextTheme) => {
  const theme = normalizeTheme(nextTheme);
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("dark", isDarkTheme(theme));
  localStorage.setItem("theme", theme);
  window.dispatchEvent(new Event("theme-change"));
  return theme;
};
