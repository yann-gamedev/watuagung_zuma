"use client";

import { useEffect } from "react";

const leaveMessage = "Ada perubahan belum disimpan. Tinggalkan halaman?";

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const leave = (event: Event) => { if (!window.confirm(leaveMessage)) event.preventDefault(); };
    // Navigation API menjaga Back/Forward SPA pada browser pendukung; sebelum unload tetap native.
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    const navigate = (event: Event) => {
      const transition = event as Event & { destination: { sameDocument: boolean; url: string } };
      if (transition.destination.sameDocument && transition.destination.url !== location.href) leave(event);
    };
    const click = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0 || anchor.href === location.href) return;
      if (!window.confirm(leaveMessage)) { event.preventDefault(); event.stopImmediatePropagation(); }
      else {
        window.removeEventListener("beforeunload", unload);
        navigation?.removeEventListener("navigate", navigate);
        event.preventDefault(); event.stopImmediatePropagation();
        location.assign(anchor.href);
      }
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("admin-before-leave", leave);
    document.addEventListener("click", click, true);
    navigation?.addEventListener("navigate", navigate);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("admin-before-leave", leave);
      document.removeEventListener("click", click, true);
      navigation?.removeEventListener("navigate", navigate);
    };
  }, [dirty]);
}
