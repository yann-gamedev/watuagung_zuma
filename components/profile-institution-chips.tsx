"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

export type ProfileInstitution = { name: string; description: string };

type OpenPopover = { index: number; mode: "hover" | "focus" | "pinned" } | null;
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ProfileInstitutionChips({ items }: { items: ProfileInstitution[] }) {
  const rootRef = useRef<HTMLUListElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState<OpenPopover>(null);
  const [position, setPosition] = useState({ left: 12, top: 12, width: 280, side: "below" as "above" | "below" });
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  const clearTimers = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    hoverTimer.current = null;
    closeTimer.current = null;
  }, []);

  const positionPopover = useCallback(() => {
    if (!open || !tooltipRef.current || !buttonRefs.current[open.index] || !rootRef.current) return;
    const button = buttonRefs.current[open.index]!;
    const tooltip = tooltipRef.current;
    const card = rootRef.current.closest(".profile-card");
    if (!card) return;

    const margin = 12;
    const gap = 8;
    const cardRect = card.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const availableWidth = Math.max(0, Math.min(280, viewportWidth - margin * 2, cardRect.width - margin * 2));
    const minLeft = Math.max(margin, cardRect.left + margin);
    const maxLeft = Math.min(viewportWidth - margin - availableWidth, cardRect.right - margin - availableWidth);
    const left = Math.max(minLeft, Math.min(buttonRect.left + (buttonRect.width - availableWidth) / 2, maxLeft));

    tooltip.style.width = `${availableWidth}px`;
    const height = tooltip.getBoundingClientRect().height;
    const aboveTop = buttonRect.top - height - gap;
    const belowTop = buttonRect.bottom + gap;
    const fitsAbove = aboveTop >= margin;
    const fitsBelow = belowTop + height <= viewportHeight - margin;
    const side = fitsBelow || !fitsAbove ? "below" : "above";
    const idealTop = side === "above" ? aboveTop : belowTop;
    const top = Math.max(margin, Math.min(idealTop, viewportHeight - height - margin));
    setPosition({ left, top, width: availableWidth, side });
  }, [open]);

  useLayoutEffect(() => {
    positionPopover();
  }, [positionPopover]);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => positionPopover();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearTimers();
        setOpen(null);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target) || tooltipRef.current?.contains(target)) return;
      clearTimers();
      setOpen(null);
    };
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, positionPopover, clearTimers]);

  return (
    <>
      <ul className="profile-chips" ref={rootRef}>
        {items.map((item, index) => {
          const isOpen = open?.index === index;
          const id = `profile-institution-tooltip-${index}`;
          return (
            <li className="profile-chip-wrap" key={item.name}>
              <button
                aria-controls={id}
                aria-expanded={isOpen}
                className="profile-chip-button"
                onBlur={() => {
                  if (open?.index === index && open.mode !== "pinned") setOpen(null);
                }}
                onClick={() => {
                  clearTimers();
                  setOpen((current) => current?.index === index && current.mode === "pinned" ? null : { index, mode: "pinned" });
                }}
                onFocus={() => setOpen((current) => current?.mode === "pinned" ? current : { index, mode: "focus" })}
                onPointerEnter={(event) => {
                  if (event.pointerType === "touch" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
                  if (closeTimer.current) clearTimeout(closeTimer.current);
                  hoverTimer.current = setTimeout(() => setOpen((current) => {
                    if (current?.mode === "pinned") return current;
                    return { index, mode: buttonRefs.current[index] === document.activeElement ? "focus" : "hover" };
                  }), 100);
                }}
                onPointerLeave={() => {
                  if (hoverTimer.current) clearTimeout(hoverTimer.current);
                  if (open?.index === index && open.mode === "hover" && buttonRefs.current[index] !== document.activeElement) {
                    closeTimer.current = setTimeout(() => setOpen((current) => current?.index === index && current.mode === "hover" ? null : current), 140);
                  }
                }}
                ref={(element) => { buttonRefs.current[index] = element; }}
                type="button"
              >
                {item.name}
              </button>
            </li>
          );
        })}
      </ul>
      {mounted && open && items[open.index] && createPortal(
        <div
          className="profile-institution-tooltip is-open"
          data-side={position.side}
          id={`profile-institution-tooltip-${open.index}`}
          ref={tooltipRef}
          role="tooltip"
          style={{ left: position.left, top: position.top, width: position.width }}
          onPointerEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current); }}
          onPointerLeave={() => {
            if (open.mode === "hover") closeTimer.current = setTimeout(() => setOpen((current) => current?.index === open.index && current.mode === "hover" ? null : current), 140);
          }}
        >
          <strong>{items[open.index].name}</strong>
          <span>{items[open.index].description}</span>
        </div>,
        document.body,
      )}
    </>
  );
}
