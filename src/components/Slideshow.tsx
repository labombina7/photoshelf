'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Props {
  photoIds: number[];
  startIndex: number;
  onClose: () => void;
}

const INTERVALS = [3, 5, 10, 30] as const;
type Interval = typeof INTERVALS[number];

export default function Slideshow({ photoIds, startIndex, onClose }: Props) {
  const [playIndex, setPlayIndex] = useState(startIndex);
  const [playing, setPlaying] = useState(true);
  const [interval_, setInterval_] = useState<Interval>(5);
  const [hudVisible, setHudVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  // Dual-slot crossfade: slot 0 and slot 1 alternate as active
  const [slotActive, setSlotActive] = useState(0); // index of the visible slot
  const [slots, setSlots] = useState([
    { id: photoIds[startIndex] },
    { id: photoIds[startIndex] },
  ]);
  const [transitioning, setTransitioning] = useState(false);

  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressStartRef = useRef<number>(Date.now());
  const progressRafRef = useRef<number>(0);
  const transitioningRef = useRef(false);
  const playIndexRef = useRef(playIndex);

  useEffect(() => { playIndexRef.current = playIndex; }, [playIndex]);
  useEffect(() => { transitioningRef.current = transitioning; }, [transitioning]);

  // Crossfade to a new photo
  const goTo = useCallback((newPlayIndex: number) => {
    if (transitioningRef.current) return;
    const newId = photoIds[newPlayIndex];
    setSlots(prev => {
      const next = [...prev] as typeof prev;
      const inactiveSlot = 1 - (slotActive);
      next[inactiveSlot] = { id: newId };
      return next;
    });
    setTransitioning(true);
    transitioningRef.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSlotActive(s => 1 - s);
        setPlayIndex(newPlayIndex);
        setTimeout(() => {
          setTransitioning(false);
          transitioningRef.current = false;
        }, 520);
      });
    });
  }, [photoIds, slotActive]);

  // Preload next image
  useEffect(() => {
    const nextIdx = (playIndex + 1) % photoIds.length;
    const img = new window.Image();
    img.src = `/api/photos/${photoIds[nextIdx]}/thumbnail?size=1920&fit=inside`;
  }, [playIndex, photoIds]);

  // Auto-advance
  useEffect(() => {
    if (!playing) return;
    const ms = interval_ * 1000;
    const timer = setInterval(() => {
      if (!transitioningRef.current) {
        const next = (playIndexRef.current + 1) % photoIds.length;
        goTo(next);
      }
    }, ms);
    return () => clearInterval(timer);
  }, [playing, interval_, photoIds.length, goTo]);

  // Progress bar
  useEffect(() => {
    if (!playing) {
      setProgress(0);
      cancelAnimationFrame(progressRafRef.current);
      return;
    }
    const ms = interval_ * 1000;
    progressStartRef.current = Date.now();

    function tick() {
      const elapsed = Date.now() - progressStartRef.current;
      setProgress(Math.min(elapsed / ms, 1));
      if (elapsed < ms) progressRafRef.current = requestAnimationFrame(tick);
    }
    progressRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(progressRafRef.current);
  }, [playing, interval_, playIndex]);

  // HUD auto-hide
  const showHud = useCallback(() => {
    setHudVisible(true);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => setHudVisible(false), 3000);
  }, []);

  useEffect(() => {
    showHud();
    return () => { if (hudTimerRef.current) clearTimeout(hudTimerRef.current); };
  }, [showHud]);

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case 'Escape': onClose(); break;
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          setPlaying(p => !p);
          showHud();
          break;
        case 'ArrowLeft':
          goTo((playIndexRef.current - 1 + photoIds.length) % photoIds.length);
          showHud();
          break;
        case 'ArrowRight':
          goTo((playIndexRef.current + 1) % photoIds.length);
          showHud();
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, photoIds.length, showHud, goTo]);

  return (
    <div
      className="slideshow-overlay"
      onMouseMove={showHud}
      onTouchStart={showHud}
    >
      {/* Dual-slot crossfade */}
      <div className="slideshow-photo-wrap">
        {slots.map((slot, i) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={i}
            src={`/api/photos/${slot.id}/thumbnail?size=1920&fit=inside`}
            alt=""
            className={`slideshow-img ${i === slotActive ? 'slideshow-img--active' : 'slideshow-img--inactive'}`}
            draggable={false}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div className={`slideshow-progress-wrap${hudVisible ? '' : ' slideshow-hud--hidden'}`}>
        <div
          className="slideshow-progress-fill"
          style={{ width: `${progress * 100}%`, transition: playing ? 'none' : undefined }}
        />
      </div>

      {/* HUD */}
      <div className={`slideshow-hud${hudVisible ? '' : ' slideshow-hud--hidden'}`}>
        <div className="slideshow-hud-inner">
          <button
            className="slideshow-btn"
            onClick={() => goTo((playIndex - 1 + photoIds.length) % photoIds.length)}
            title="Anterior"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
          </button>

          <button
            className="slideshow-btn"
            onClick={() => { setPlaying(p => !p); showHud(); }}
            title={playing ? 'Pausar' : 'Reproducir'}
          >
            {playing
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            }
          </button>

          <button
            className="slideshow-btn"
            onClick={() => goTo((playIndex + 1) % photoIds.length)}
            title="Siguiente"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
          </button>

          <span className="slideshow-counter">{playIndex + 1} / {photoIds.length}</span>

          <div className="slideshow-interval-group">
            {INTERVALS.map(s => (
              <button
                key={s}
                className={`slideshow-interval-btn${interval_ === s ? ' active' : ''}`}
                onClick={() => { setInterval_(s); showHud(); }}
              >
                {s}s
              </button>
            ))}
          </div>

          <button
            className="slideshow-btn slideshow-btn--close"
            onClick={onClose}
            title="Salir de presentación"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
