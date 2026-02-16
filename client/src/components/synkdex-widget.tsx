import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

declare global {
  interface Window {
    __synkdexWidgetLoaded?: boolean;
  }
}

const API_KEY = "sk_b6387eab3b7ebf486a52f9aae18ed1ee48ffbda30a922566";
const SYNKDEX_URL = "https://synkdex.com";
const SCRIPT_SELECTOR = `script[data-api-key="${API_KEY}"]`;

function removeSynkdex() {
  const scriptEl = document.querySelector(SCRIPT_SELECTOR);
  if (scriptEl) scriptEl.remove();
  const widgetEl = document.getElementById("synkdex-widget");
  if (widgetEl) widgetEl.remove();
  const overlays = document.querySelectorAll(".sdx-overlay");
  overlays.forEach((el) => el.remove());
  const buttons = document.querySelectorAll(".sdx-widget-btn");
  buttons.forEach((el) => el.remove());
  const styles = document.querySelectorAll("style");
  styles.forEach((el) => {
    if (el.textContent && el.textContent.includes("sdx-widget-btn")) {
      el.remove();
    }
  });
  window.__synkdexWidgetLoaded = false;
}

export function SynkdexWidget() {
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    if (!user || !isAdmin) {
      removeSynkdex();
      return;
    }

    if (document.querySelector(SCRIPT_SELECTOR)) return;

    removeSynkdex();

    const s = document.createElement("script");
    s.src = `${SYNKDEX_URL}/widget.js`;
    s.setAttribute("data-api-key", API_KEY);
    s.setAttribute("data-api-url", SYNKDEX_URL);
    s.setAttribute("data-brand-name", "Expedition Group");
    s.setAttribute("data-brand-logo", `${SYNKDEX_URL}/synkdex-logo.webp`);

    const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ");
    if (displayName) {
      s.setAttribute("data-user-name", displayName);
    }
    if (user.email) {
      s.setAttribute("data-user-email", user.email);
    }

    document.body.appendChild(s);

    return () => {
      removeSynkdex();
    };
  }, [user, isAdmin]);

  return null;
}
