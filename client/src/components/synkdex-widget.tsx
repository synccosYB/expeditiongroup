import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

declare global {
  interface Window {
    __synkdexWidgetLoaded?: boolean;
    __synkdexOrigFetch?: typeof fetch;
    __synkdexOrigXHROpen?: typeof XMLHttpRequest.prototype.open;
  }
}

const SYNKDEX_URL = "https://synkdex.com";

function rewriteUrl(url: string): string {
  if (url.startsWith(SYNKDEX_URL + "/api/")) {
    return url.replace(SYNKDEX_URL, window.location.origin);
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
  const scripts = document.querySelectorAll('script[data-api-key]');
  scripts.forEach((el) => el.remove());
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

function sanitizeOverlayPointerEvents(el: Element) {
  if (el.classList.contains("sdx-overlay")) {
    const children = el.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement;
      if (
        !child.classList.contains("sdx-modal") &&
        !child.classList.contains("sdx-body") &&
        !child.classList.contains("sdx-widget-btn") &&
        child.id !== "sdx-form-container" &&
        !child.getAttribute("role")
      ) {
        child.style.pointerEvents = "none";
      }
    }
  }
}

export function SynkdexWidget() {
  const { user, isAdmin } = useAuth();
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !isAdmin) return;
    fetch("/api/synkdex-config", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setApiKey(data.apiKey || null))
      .catch(() => setApiKey(null));
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || !isAdmin || !apiKey) {
      removeSynkdex();
      removeFetchInterceptor();
      removeXHRInterceptor();
      return;
    }

    const selector = `script[data-api-key="${apiKey}"]`;
    if (document.querySelector(selector)) return;

    removeSynkdex();

    installFetchInterceptor();
    installXHRInterceptor();

    const s = document.createElement("script");
    s.src = `${SYNKDEX_URL}/widget.js`;
    s.setAttribute("data-api-key", apiKey);
    s.setAttribute("data-api-url", window.location.origin);
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

    const sanitizeAll = () => {
      document.querySelectorAll(".sdx-overlay").forEach(sanitizeOverlayPointerEvents);
    };

    sanitizeAll();

    const observer = new MutationObserver((mutations) => {
      let needsSanitize = false;
      for (const mutation of mutations) {
        for (let i = 0; i < mutation.addedNodes.length; i++) {
          const node = mutation.addedNodes[i];
          if (node instanceof HTMLElement) {
            if (node.classList.contains("sdx-overlay") || node.querySelector(".sdx-overlay")) {
              needsSanitize = true;
              break;
            }
          }
        }
        if (needsSanitize) break;
      }
      if (needsSanitize) sanitizeAll();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      removeSynkdex();
      removeFetchInterceptor();
      removeXHRInterceptor();
    };
  }, [user, isAdmin, apiKey]);

  return null;
}
