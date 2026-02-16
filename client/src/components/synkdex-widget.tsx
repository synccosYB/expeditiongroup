import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

const API_KEY = "sk_98854f09aa58cd8870ccde674a46a658a070627979ee7b02";
const SCRIPT_SELECTOR = `script[data-api-key="${API_KEY}"]`;

function removeSynkdex() {
  const scriptEl = document.querySelector(SCRIPT_SELECTOR);
  if (scriptEl) scriptEl.remove();
  const widgetEl = document.getElementById("synkdex-widget");
  if (widgetEl) widgetEl.remove();
}

export function SynkdexWidget() {
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    if (!user || !isAdmin) {
      removeSynkdex();
      return;
    }

    if (document.querySelector(SCRIPT_SELECTOR)) return;

    const s = document.createElement("script");
    s.src = "https://synkdex.com/widget.js";
    s.setAttribute("data-api-key", API_KEY);
    s.setAttribute("data-brand-name", "Synccos Inc.");
    s.setAttribute("data-brand-logo", "https://synkdex.com/synkdex-logo.webp");

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
