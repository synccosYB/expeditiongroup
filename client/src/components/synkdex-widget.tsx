import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

declare global {
  interface Window {
    __synkdexWidgetLoaded?: boolean;
    __synkdexOrigFetch?: typeof fetch;
    __synkdexOrigXHROpen?: typeof XMLHttpRequest.prototype.open;
  }
}

const API_KEY = "sk_b6387eab3b7ebf486a52f9aae18ed1ee48ffbda30a922566";
const SYNKDEX_URL = "https://synkdex.com";
const SCRIPT_SELECTOR = `script[data-api-key="${API_KEY}"]`;

function getProxyBase() {
  return `${window.location.origin}/api/widget`;
}

function rewriteUrl(url: string): string {
  if (url.startsWith(SYNKDEX_URL + "/api/")) {
    return url.replace(SYNKDEX_URL, getProxyBase());
  }
  return url;
}

function installFetchInterceptor() {
  if (window.__synkdexOrigFetch) return;

  window.__synkdexOrigFetch = window.fetch;

  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === "string") {
      input = rewriteUrl(input);
    } else if (input instanceof Request) {
      const newUrl = rewriteUrl(input.url);
      if (newUrl !== input.url) {
        input = new Request(newUrl, input);
      }
    } else if (input instanceof URL) {
      const newUrl = rewriteUrl(input.toString());
      if (newUrl !== input.toString()) {
        input = newUrl;
      }
    }
    return window.__synkdexOrigFetch!.call(window, input, init);
  };
}

function installXHRInterceptor() {
  if (window.__synkdexOrigXHROpen) return;

  window.__synkdexOrigXHROpen = XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: any[]
  ) {
    const urlStr = typeof url === "string" ? url : url.toString();
    const rewritten = rewriteUrl(urlStr);
    return window.__synkdexOrigXHROpen!.apply(this, [
      method,
      rewritten,
      ...rest,
    ] as any);
  };
}

function removeFetchInterceptor() {
  if (window.__synkdexOrigFetch) {
    window.fetch = window.__synkdexOrigFetch;
    delete window.__synkdexOrigFetch;
  }
}

function removeXHRInterceptor() {
  if (window.__synkdexOrigXHROpen) {
    XMLHttpRequest.prototype.open = window.__synkdexOrigXHROpen;
    delete window.__synkdexOrigXHROpen;
  }
}

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
      removeFetchInterceptor();
      removeXHRInterceptor();
      return;
    }

    if (document.querySelector(SCRIPT_SELECTOR)) return;

    removeSynkdex();

    installFetchInterceptor();
    installXHRInterceptor();

    const s = document.createElement("script");
    s.src = `${SYNKDEX_URL}/widget.js`;
    s.setAttribute("data-api-key", API_KEY);
    s.setAttribute("data-api-url", getProxyBase());
    s.setAttribute("data-brand-name", "Expedition Group");
    s.setAttribute("data-brand-logo", `${SYNKDEX_URL}/synkdex-logo.webp`);

    const displayName = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ");
    if (displayName) {
      s.setAttribute("data-user-name", displayName);
    }
    if (user.email) {
      s.setAttribute("data-user-email", user.email);
    }

    document.body.appendChild(s);

    return () => {
      removeSynkdex();
      removeFetchInterceptor();
      removeXHRInterceptor();
    };
  }, [user, isAdmin]);

  return null;
}
