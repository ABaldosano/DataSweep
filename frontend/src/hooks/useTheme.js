import { useEffect, useState } from "react";

const STORAGE_KEY = "datasweep-theme";
const THEME_COLORS = { light: "#ffffff", dark: "#0a0a0a" };

function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem(STORAGE_KEY) || "light";
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);

    const meta = document.getElementById("themeColorMeta");
    if (meta) meta.setAttribute("content", THEME_COLORS[theme] || THEME_COLORS.light);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  return { theme, toggleTheme };
}
