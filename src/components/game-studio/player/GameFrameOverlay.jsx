import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Keep overlays out of the scrollable story, but anchored to the visible game frame.
export default function GameFrameOverlay({ anchor, theme, children }) {
  const [bounds, setBounds] = useState(null);
  useLayoutEffect(() => {
    const element = anchor.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const left = Math.max(0, rect.left), top = Math.max(0, rect.top);
      const right = Math.min(window.innerWidth, rect.right);
      const bottom = Math.min(window.innerHeight, rect.bottom);
      setBounds({ left, top, width: Math.max(0, right-left), height: Math.max(0, bottom-top) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [anchor]);
  if (!bounds || !bounds.width || !bounds.height) return null;
  return createPortal(<div data-reading-theme={theme.id} style={{ ...theme.vars, ...bounds, position:'fixed', background:'transparent', zIndex:60, overflow:'hidden', borderRadius:16 }}>{children}</div>, document.body);
}
