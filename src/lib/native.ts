import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

/** Inside the Android app (Capacitor shell). */
export const isNativeApp = Capacitor.isNativePlatform();

/**
 * Android back button: close an open sheet/dialog first, then go back in the app;
 * on a top-level screen it leaves the app (like other Android apps).
 */
export function setupNativeApp() {
  if (!isNativeApp) return;
  void App.addListener("backButton", ({ canGoBack }) => {
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]');
    const dialog = dialogs[dialogs.length - 1];
    if (dialog) {
      // Its own close button if it has one (e.g. the live chat panel), else Escape (sheets).
      const closeButton = dialog.querySelector<HTMLElement>('button[aria-label^="Close"]');
      if (closeButton) closeButton.click();
      else window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      return;
    }
    const topLevel = /^\/(chats|feed|live|notifications)?$/.test(location.pathname);
    if (canGoBack && !topLevel) history.back();
    else void App.exitApp();
  });
}
