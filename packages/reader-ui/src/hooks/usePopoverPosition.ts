import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

/** Keep selection menus visible, including when their note form grows. */
export function usePopoverPosition(position: { x: number; y: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({
    left: position.x,
    top: position.y,
  });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const viewport = window.visualViewport;
    const place = () => {
      const margin = 16;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const originX = viewport?.offsetLeft ?? 0;
      const originY = viewport?.offsetTop ?? 0;
      const bounds = element.getBoundingClientRect();
      const clamp = (value: number, min: number, max: number) =>
        Math.max(min, Math.min(value, Math.max(min, max)));
      setStyle({
        left: clamp(
          position.x - bounds.width / 2,
          originX + margin,
          originX + width - bounds.width - margin,
        ),
        top: clamp(
          position.y - bounds.height - 10,
          originY + margin,
          originY + height - bounds.height - margin,
        ),
        maxHeight: Math.max(0, height - margin * 2),
        overflowY: "auto",
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    viewport?.addEventListener("resize", place);
    viewport?.addEventListener("scroll", place);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      viewport?.removeEventListener("resize", place);
      viewport?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  }, [position.x, position.y]);
  return { ref, style };
}
