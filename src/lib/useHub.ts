"use client";
import { useEffect, useLayoutEffect } from "react";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// The Gaming hub is always dark. Force it while you're there and put your own
// light/dark choice back when you leave (it is never saved over your setting).
export function useForceDarkInGame(isGame: boolean) {
  useIsoLayoutEffect(() => {
    const root = document.documentElement;
    if (isGame) {
      root.setAttribute("data-forced-dark", "1");
      root.setAttribute("data-theme", "dark");
    } else if (root.hasAttribute("data-forced-dark")) {
      root.removeAttribute("data-forced-dark");
      let t: string | null = null;
      try { t = localStorage.getItem("emerge-theme"); } catch { /* ignore */ }
      if (t !== "light" && t !== "dark") t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.setAttribute("data-theme", t);
    }
  }, [isGame]);
}
