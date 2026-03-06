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

function isOverlayVisible(): boolean {
  const overlays = document.querySelectorAll(".sdx-overlay");
  for (let i = 0; i < overlays.length; i++) {
    const el = overlays[i] as HTMLElement;
    if (
      el.style.display !== "none" &&
      el.style.visibility !== "hidden" &&
      el.style.opacity !== "0"
    ) {
      return true;
    }
  }
  return false;
}

function dismissWidgetOverlay() {
  const overlays = document.querySelectorAll(".sdx-overlay");
  overlays.forEach((overlay) => {
    const el = overlay as HTMLElement;
    el.style.display = "none";
    el.style.visibility = "hidden";
    el.style.pointerEvents = "none";
    el.style.opacity = "0";
    el.style.zIndex = "-1";
  });

  const modals = document.querySelectorAll(".sdx-modal");
  modals.forEach((modal) => {
    const el = modal as HTMLElement;
    el.style.display = "none";
  });

  document.body.style.overflow = "";
  document.body.style.pointerEvents = "";
  document.documentElement.style.overflow = "";
}

function isCloseButton(target: HTMLElement): boolean {
  let el: HTMLElement | null = target;
  while (el) {
    if (
      el.classList.contains("sdx-close") ||
      el.classList.contains("sdx-close-btn") ||
      el.getAttribute("aria-label")?.toLowerCase().includes("close") ||
      el.getAttribute("data-action") === "close" ||
      el.getAttribute("title")?.toLowerCase().includes("close")
    ) {
      return true;
    }

    if (el.tagName === "BUTTON" || el.tagName === "A" || el.getAttribute("role") === "button") {
      const text = el.textContent?.trim();
      if (text === "×" || text === "✕" || text === "X" || text === "x" || text === "✖") {
        return true;
      }
    }

    if (el.classList.contains("sdx-overlay") || el.classList.contains("sdx-widget-btn")) {
      break;
    }
    el = el.parentElement;
  }
  return false;
}

function isBackdropClick(target: HTMLElement): boolean {
  return target.classList.contains("sdx-overlay");
}

function installCloseInterceptor(): (() => void) {
  const clickHandler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target) return;

    const inWidget = target.closest(".sdx-overlay") || target.closest(".sdx-modal");
    if (!inWidget) return;

    if (isCloseButton(target) || isBackdropClick(target)) {
      setTimeout(() => {
        if (isOverlayVisible()) {
          dismissWidgetOverlay();
        }
      }, 150);

      setTimeout(() => {
        if (isOverlayVisible()) {
          dismissWidgetOverlay();
        }
      }, 500);
    }
  };

  document.addEventListener("click", clickHandler, true);

  const touchHandler = (e: TouchEvent) => {
    const target = e.target as HTMLElement;
    if (!target) return;

    if (isBackdropClick(target)) {
      setTimeout(() => {
        if (isOverlayVisible()) {
          dismissWidgetOverlay();
        }
      }, 300);
    }
  };

  document.addEventListener("touchend", touchHandler, true);

  const escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape" && isOverlayVisible()) {
      setTimeout(() => {
        if (isOverlayVisible()) {
          dismissWidgetOverlay();
        }
      }, 150);
    }
  };

  document.addEventListener("keydown", escHandler, true);

  const stuckCheckInterval = setInterval(() => {
    const overlay = document.querySelector(".sdx-overlay") as HTMLElement | null;
    if (!overlay) return;

    const isVisible =
      overlay.style.display !== "none" &&
      overlay.style.visibility !== "hidden" &&
      overlay.style.opacity !== "0";

    if (!isVisible) return;

    const bodyBlocked =
      document.body.style.overflow === "hidden" ||
      document.body.style.pointerEvents === "none" ||
      document.documentElement.style.overflow === "hidden";

    const hasModal = overlay.querySelector(".sdx-modal, .sdx-body, #sdx-form-container, [role='dialog']");
    if (bodyBlocked && !hasModal) {
      dismissWidgetOverlay();
    }

    if (bodyBlocked && hasModal) {
      const successEl = overlay.querySelector(
        ".sdx-success, .sdx-thank-you, .sdx-complete, [class*='success'], [class*='thank']"
      );
      if (successEl) {
        dismissWidgetOverlay();
      }
    }
  }, 2000);

  const touchBlockCheck = setInterval(() => {
    const bodyBlocked =
      document.body.style.overflow === "hidden" ||
      document.body.style.pointerEvents === "none" ||
      document.documentElement.style.overflow === "hidden";

    if (!bodyBlocked) return;

    const overlay = document.querySelector(".sdx-overlay") as HTMLElement | null;
    const widgetBtn = document.querySelector(".sdx-widget-btn") as HTMLElement | null;

    if (!overlay && !widgetBtn && bodyBlocked) {
      document.body.style.overflow = "";
      document.body.style.pointerEvents = "";
      document.documentElement.style.overflow = "";
    }
  }, 3000);

  return () => {
    document.removeEventListener("click", clickHandler, true);
    document.removeEventListener("touchend", touchHandler, true);
    document.removeEventListener("keydown", escHandler, true);
    clearInterval(stuckCheckInterval);
    clearInterval(touchBlockCheck);
  };
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

    const removeCloseInterceptor = installCloseInterceptor();

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
            const inOverlay = node.closest(".sdx-overlay");
            if (inOverlay) {
              const className = node.className?.toString?.() || "";
              const textContent = node.textContent?.toLowerCase() || "";
              if (
                className.includes("success") ||
                className.includes("thank") ||
                className.includes("complete") ||
                (textContent.includes("thank you") && textContent.length < 200) ||
                (textContent.includes("submitted") && textContent.length < 200)
              ) {
                setTimeout(() => {
                  dismissWidgetOverlay();
                }, 3000);
              }
            }
          }
        }
        if (needsSanitize) break;

        for (let i = 0; i < mutation.removedNodes.length; i++) {
          const node = mutation.removedNodes[i];
          if (node instanceof HTMLElement) {
            if (
              node.classList.contains("sdx-modal") ||
              node.classList.contains("sdx-body") ||
              node.id === "sdx-form-container"
            ) {
              setTimeout(() => {
                if (isOverlayVisible()) {
                  const overlay = document.querySelector(".sdx-overlay");
                  const hasContent = overlay?.querySelector(".sdx-modal, .sdx-body, #sdx-form-container, [role='dialog']");
                  if (!hasContent) {
                    dismissWidgetOverlay();
                  }
                }
              }, 300);
            }
          }
        }
      }
      if (needsSanitize) sanitizeAll();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      removeCloseInterceptor();
      removeSynkdex();
      removeFetchInterceptor();
      removeXHRInterceptor();
    };
  }, [user, isAdmin, apiKey]);

  return null;
}
