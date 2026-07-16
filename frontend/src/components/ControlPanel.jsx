import { useEffect, useState } from "react";
import "./ControlPanel.css";

// Thin scroll-progress gauge across the top, ported from the portfolio site.
export default function ControlPanel() {
  const [scrollPct, setScrollPct] = useState(0);

  useEffect(() => {
    function updateScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setScrollPct(pct);
    }
    updateScroll();
    window.addEventListener("scroll", () => requestAnimationFrame(updateScroll), { passive: true });
    window.addEventListener("resize", updateScroll);

    return () => {
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
    };
  }, []);

  return <div id="scrollProgress" style={{ width: `${scrollPct}%` }} />;
}
