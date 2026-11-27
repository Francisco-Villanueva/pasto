"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Icon } from "@/components/ui";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Video de la portada. Arranca solo (sin sonido y en bucle), salvo que el usuario pida
 * menos movimiento: entonces queda el póster y se reproduce con el botón.
 * En escritorio va a la derecha del texto; en el celular, de fondo en la mitad de abajo.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia(REDUCED_MOTION).matches) return;
    video.play().catch(() => {
      // El navegador bloqueó la reproducción automática: queda el póster y el botón.
    });
  }, []);

  function toggle() {
    const video = ref.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  }

  return (
    <div className="ld-hero__video">
      <video
        ref={ref}
        src="/video/pasto-hero.mp4"
        poster="/video/pasto-hero-poster.jpg"
        muted
        loop
        playsInline
        preload="none"
        width={720}
        height={1280}
        aria-label="Burrito de PASTO cortado al medio, con quinoa, verdes, calabaza y cebolla morada"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button type="button" className="ld-hero__video-toggle" onClick={toggle}>
        <Icon icon={playing ? Pause : Play} size={14} />
        {playing ? "Pausar" : "Reproducir"}
      </button>
    </div>
  );
}
