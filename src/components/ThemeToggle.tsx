"use client";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

// Two presentations sharing the same logic: "nav" matches the sidebar's
// other ig-nav-item rows (icon + label), "icon" is a bare icon button for
// tight spaces (mobile top bar, auth pages).
export default function ThemeToggle({ variant = "nav" }: { variant?: "nav" | "icon" }) {
  const { theme, toggleTheme } = useTheme();
  const icon = theme === "dark" ? <Sun size={20} strokeWidth={1.8} /> : <Moon size={20} strokeWidth={1.8} />;

  if (variant === "icon") {
    return (
      <button className="ig-theme-toggle-icon" onClick={toggleTheme} title="Switch theme" aria-label="Switch theme">
        {icon}
      </button>
    );
  }

  return (
    <button className="ig-nav-item" onClick={toggleTheme}>
      <span className="ig-nav-icon">{icon}</span>
      <span className="ig-nav-label">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
