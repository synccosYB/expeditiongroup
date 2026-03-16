const WIDGET_SELECTORS = [
  ".sdx-widget-btn",
  ".sdx-overlay",
  "#synkdex-widget",
  "[class*='sdx-']",
  "[id*='synkdex']",
  "script[data-api-key][src*='synkdex']",
];

interface RemovedElement {
  element: Node;
  parent: Node;
  nextSibling: Node | null;
}

let removedElements: RemovedElement[] = [];
let isHandlingPrint = false;

function removeWidgetElements(): void {
  removedElements = [];
  WIDGET_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (el.parentNode) {
        removedElements.push({
          element: el,
          parent: el.parentNode,
          nextSibling: el.nextSibling,
        });
        el.parentNode.removeChild(el);
      }
    });
  });

  const iframes = document.querySelectorAll("iframe");
  iframes.forEach((iframe) => {
    const src = iframe.src || "";
    const id = iframe.id || "";
    const className = iframe.className || "";
    if (
      src.includes("synkdex") ||
      id.includes("synkdex") ||
      id.includes("sdx") ||
      className.includes("sdx")
    ) {
      if (iframe.parentNode) {
        removedElements.push({
          element: iframe,
          parent: iframe.parentNode,
          nextSibling: iframe.nextSibling,
        });
        iframe.parentNode.removeChild(iframe);
      }
    }
  });
}

function restoreWidgetElements(): void {
  for (let i = removedElements.length - 1; i >= 0; i--) {
    const { element, parent, nextSibling } = removedElements[i];
    try {
      if (parent && document.contains(parent)) {
        if (nextSibling && parent.contains(nextSibling)) {
          parent.insertBefore(element, nextSibling);
        } else {
          parent.appendChild(element);
        }
      }
    } catch {
    }
  }
  removedElements = [];
}

function handleBeforePrint(): void {
  if (isHandlingPrint) return;
  isHandlingPrint = true;
  removeWidgetElements();
}

function handleAfterPrint(): void {
  restoreWidgetElements();
  isHandlingPrint = false;
}

let listenersInstalled = false;

function handleVisibilityRestore(): void {
  if (document.visibilityState === "visible" && isHandlingPrint && removedElements.length > 0) {
    setTimeout(() => {
      if (isHandlingPrint) {
        handleAfterPrint();
      }
    }, 500);
  }
}

function handleFocusRestore(): void {
  if (isHandlingPrint && removedElements.length > 0) {
    setTimeout(() => {
      if (isHandlingPrint) {
        handleAfterPrint();
      }
    }, 500);
  }
}

export function installPrintListeners(): () => void {
  if (listenersInstalled) return () => {};
  listenersInstalled = true;

  window.addEventListener("beforeprint", handleBeforePrint);
  window.addEventListener("afterprint", handleAfterPrint);
  document.addEventListener("visibilitychange", handleVisibilityRestore);
  window.addEventListener("focus", handleFocusRestore);

  return () => {
    window.removeEventListener("beforeprint", handleBeforePrint);
    window.removeEventListener("afterprint", handleAfterPrint);
    document.removeEventListener("visibilitychange", handleVisibilityRestore);
    window.removeEventListener("focus", handleFocusRestore);
    listenersInstalled = false;
  };
}

export function handlePrintWithWidgetRemoval(options: {
  documentTitle?: string;
}): void {
  const originalTitle = document.title;
  if (options.documentTitle) {
    document.title = options.documentTitle;
  }

  const htmlEl = document.documentElement;
  const wasDark = htmlEl.classList.contains("dark");
  if (wasDark) {
    htmlEl.classList.remove("dark");
  }

  removeWidgetElements();

  const restore = () => {
    restoreWidgetElements();
    if (wasDark) {
      htmlEl.classList.add("dark");
    }
    document.title = originalTitle;
    isHandlingPrint = false;
  };

  isHandlingPrint = true;
  window.addEventListener("afterprint", restore, { once: true });

  setTimeout(() => {
    window.print();
  }, 150);
}
