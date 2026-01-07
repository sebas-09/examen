import { useEffect, useMemo, useState } from "react";

export function useCountdown(
  isRunning: boolean,
  startMs: number,
  deadlineMs: number,
  onEnd: () => void
) {
  // now inicia desde startMs (valor puro que viene de props/estado)
  const [now, setNow] = useState<number>(startMs);

  useEffect(() => {
    if (!isRunning) return;

    const t = setInterval(() => {
      // Date.now() aquí está OK: es callback (no render)
      setNow(Date.now());
    }, 250);

    return () => clearInterval(t);
  }, [isRunning]);

  const secondsLeft = useMemo(() => {
    if (!isRunning) return 0;
    const diff = deadlineMs - now;
    return Math.max(0, Math.ceil(diff / 1000));
  }, [isRunning, deadlineMs, now]);

  useEffect(() => {
    if (!isRunning) return;
    if (secondsLeft === 0) onEnd();
  }, [isRunning, secondsLeft, onEnd]);

  return { secondsLeft };
}

export function formatMMSS(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
