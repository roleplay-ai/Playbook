import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";

/**
 * Fires a single, lightweight confetti burst when `trigger` becomes truthy.
 * Brand colors. One-shot per mount (guarded by ref).
 */
export function CompletionBurst({ trigger }: { trigger: boolean }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!trigger || firedRef.current) return;
    firedRef.current = true;

    const colors = ["#FFCE00", "#623CEA", "#F68A29", "#3699FC", "#23CE6B"];

    // Two soft bursts from each side, professional not childish
    const shoot = (originX: number) => {
      confetti({
        particleCount: 60,
        spread: 65,
        startVelocity: 38,
        origin: { x: originX, y: 0.35 },
        colors,
        ticks: 180,
        scalar: 0.9,
        disableForReducedMotion: true,
      });
    };
    shoot(0.25);
    setTimeout(() => shoot(0.75), 120);
  }, [trigger]);

  return null;
}
