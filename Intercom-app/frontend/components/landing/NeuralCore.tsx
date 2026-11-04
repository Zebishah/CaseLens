'use client';

import { useEffect, useRef } from 'react';

/** A locally rendered particle field; no video, remote assets, or WebGL dependency. */
export function NeuralCore({ paused = false }: { paused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let visible = true;
    let width = 0;
    let height = 0;
    let rotation = rotationRef.current;
    let lastTime = 0;
    const pointer = { x: 0, y: 0 };
    const points = Array.from({ length: 2200 }, (_, index) => {
      const y = 1 - (index / 2199) * 2;
      const radius = Math.sqrt(1 - y * y);
      const angle = index * Math.PI * (3 - Math.sqrt(5));
      return { x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius, index };
    });

    function draw(time: number) {
      if (!canvas || !context) return;
      const delta = lastTime ? Math.min(time - lastTime, 40) : 16;
      lastTime = time;
      if (!motion.matches && !paused) rotation += delta * 0.000065;
      rotationRef.current = rotation;
      context.clearRect(0, 0, width, height);
      const radius = Math.min(width * 0.37, height * 0.405);
      const centerX = width / 2;
      const centerY = height / 2;
      const turn = rotation + pointer.x * 0.13;
      const tilt = -0.2 + pointer.y * 0.08;
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      const glow = context.createRadialGradient(centerX, centerY, radius * 0.25, centerX, centerY, radius * 1.4);
      glow.addColorStop(0, 'rgba(56, 207, 255, 0.12)');
      glow.addColorStop(0.65, 'rgba(20, 159, 196, 0.08)');
      glow.addColorStop(1, 'rgba(20, 159, 196, 0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      const projected = points.map((point) => {
        const wave = 1 + 0.065 * Math.sin(point.y * 9 + rotation * 7) + 0.035 * Math.cos(point.z * 8 + rotation * 5);
        const x = point.x * cos - point.z * sin;
        const z = point.x * sin + point.z * cos;
        const y = point.y * Math.cos(tilt) - z * Math.sin(tilt);
        const depth = point.y * Math.sin(tilt) + z * Math.cos(tilt);
        const perspective = 3.3 / (3.3 - depth * 0.45);
        return { x: centerX + x * radius * wave * perspective, y: centerY + y * radius * wave * perspective, depth, index: point.index };
      }).sort((a, b) => a.depth - b.depth);

      for (const point of projected) {
        const front = (point.depth + 1) / 2;
        context.beginPath();
        context.arc(point.x, point.y, 0.45 + front * 1.05, 0, Math.PI * 2);
        context.fillStyle = point.index % 9 === 0
          ? `rgba(0, 106, 134, ${0.15 + front * 0.65})`
          : `rgba(${20 + Math.round(front * 36)}, ${159 + Math.round(front * 48)}, ${196 + Math.round(front * 59)}, ${0.12 + front * 0.65})`;
        context.fill();
      }

      // Fine latitude threads give the particle cloud a sculptural surface.
      for (let latitude = -5; latitude <= 5; latitude++) {
        const y = latitude / 6;
        const ringRadius = Math.sqrt(1 - y * y);
        context.beginPath();
        for (let step = 0; step <= 150; step++) {
          const angle = (step / 150) * Math.PI * 2;
          const px = Math.cos(angle) * ringRadius;
          const pz = Math.sin(angle) * ringRadius;
          const x = px * cos - pz * sin;
          const z = px * sin + pz * cos;
          const py = y * Math.cos(tilt) - z * Math.sin(tilt);
          const depth = y * Math.sin(tilt) + z * Math.cos(tilt);
          const wave = 1 + 0.065 * Math.sin(y * 9 + rotation * 7) + 0.035 * Math.cos(pz * 8 + rotation * 5);
          const perspective = 3.3 / (3.3 - depth * 0.45);
          const screenX = centerX + x * radius * wave * perspective;
          const screenY = centerY + py * radius * wave * perspective;
          if (step === 0) context.moveTo(screenX, screenY);
          else context.lineTo(screenX, screenY);
        }
        context.strokeStyle = 'rgba(0, 106, 134, 0.12)';
        context.lineWidth = 0.65;
        context.stroke();
      }
      if (visible && !motion.matches && !paused) frame = requestAnimationFrame(draw);
    }

    const resize = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      cancelAnimationFrame(frame);
      draw(0);
    });
    resize.observe(canvas);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
      cancelAnimationFrame(frame);
      if (visible) { lastTime = 0; draw(0); }
    });
    observer.observe(canvas);
    const onVisibility = () => {
      visible = !document.hidden && canvas.getBoundingClientRect().bottom > 0 && canvas.getBoundingClientRect().top < window.innerHeight;
      cancelAnimationFrame(frame);
      if (visible) { lastTime = 0; draw(0); }
    };
    const onPointer = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - bounds.left) / bounds.width - 0.5;
      pointer.y = (event.clientY - bounds.top) / bounds.height - 0.5;
    };
    const onMotion = () => { cancelAnimationFrame(frame); lastTime = 0; draw(0); };
    canvas.addEventListener('pointermove', onPointer);
    document.addEventListener('visibilitychange', onVisibility);
    motion.addEventListener('change', onMotion);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      canvas.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
      motion.removeEventListener('change', onMotion);
    };
  }, [paused]);

  return <canvas ref={canvasRef} className="neural-core" aria-hidden="true" />;
}
