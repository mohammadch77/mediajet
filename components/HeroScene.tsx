"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

const ITEMS: [string, string][] = [
  ["PSD", "#6B5BFF"], ["PNG", "#38E1FF"], ["AI", "#FF6B35"], ["MP4", "#8A7CFF"],
  ["MP3", "#38E1FF"], ["FIG", "#6B5BFF"], ["3D", "#FF6B35"], ["PPTX", "#8A7CFF"],
  ["TTF", "#38E1FF"], ["EPS", "#6B5BFF"], ["Freepik", "#FF6B35"], ["Envato", "#8A7CFF"],
  ["Adobe", "#38E1FF"], ["Shutter", "#6B5BFF"], ["Flaticon", "#FF6B35"], ["UI8", "#8A7CFF"],
];

function makeCardTexture(label: string, color: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const ctx = c.getContext("2d")!;
  const grd = ctx.createRadialGradient(128, 110, 10, 128, 128, 95);
  grd.addColorStop(0, color + "99");
  grd.addColorStop(1, color + "00");
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 256, 256);
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  rr(38, 68, 180, 120, 28);
  ctx.fillStyle = "rgba(20,24,51,.92)"; ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
  const hl = ctx.createLinearGradient(38, 68, 218, 128);
  hl.addColorStop(0, "rgba(255,255,255,.18)");
  hl.addColorStop(1, "rgba(255,255,255,0)");
  rr(38, 68, 180, 50, 28); ctx.fillStyle = hl; ctx.fill();
  ctx.fillStyle = "#EEF0FB";
  ctx.font = label.length > 4 ? "bold 30px Space Grotesk, sans-serif" : "bold 44px Space Grotesk, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(label, 128, 128);
  return new THREE.CanvasTexture(c);
}

export default function HeroScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);
    camera.position.z = 9;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    scene.add(new THREE.AmbientLight(0x8a7cff, 0.7));
    const l1 = new THREE.PointLight(0x6b5bff, 2, 50); l1.position.set(-6, 5, 6); scene.add(l1);
    const l2 = new THREE.PointLight(0xff6b35, 1.6, 50); l2.position.set(6, -4, 5); scene.add(l2);
    const l3 = new THREE.PointLight(0x38e1ff, 1.4, 50); l3.position.set(0, 4, -4); scene.add(l3);

    const group = new THREE.Group(); scene.add(group);

    const isMobile = innerWidth < 700;
    const activeItems = isMobile ? ITEMS.slice(0, 10) : ITEMS;
    const shards: THREE.Sprite[] = [];

    activeItems.forEach((it, i) => {
      const tex = makeCardTexture(it[0], it[1]);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
      const sprite = new THREE.Sprite(mat);
      const spread = isMobile ? 0.7 : 1;
      const s = (1.05 + Math.random() * 0.35) * spread;
      sprite.scale.set(s, s, 1);
      const side = i % 2 === 0 ? -1 : 1;
      const col = Math.floor(i / 2);
      const ax = side * (3.3 + (col % 2) * 1.4 + Math.random() * 0.3) * spread;
      const ay = (col - 3.5) * 1.05;
      const az = ((col % 3) - 1) * 1.6 - 1;
      sprite.userData.assembled = new THREE.Vector3(ax, ay, az);
      sprite.userData.scattered = new THREE.Vector3(
        (Math.random() - 0.5) * 17, (Math.random() - 0.5) * 11, (Math.random() - 0.5) * 8
      );
      sprite.position.copy(sprite.userData.scattered);
      sprite.material.opacity = 0;
      group.add(sprite);
      shards.push(sprite);
    });

    let scrollP = 0;
    const onScroll = () => {
      const h = canvas.parentElement?.offsetHeight ?? innerHeight;
      scrollP = Math.min(1, Math.max(0, scrollY / (h * 0.9)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    let mx = 0, my = 0;
    const onMouse = (e: MouseEvent) => {
      mx = e.clientX / innerWidth - 0.5;
      my = e.clientY / innerHeight - 0.5;
    };
    window.addEventListener("mousemove", onMouse);

    const onResize = () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    const tmp = new THREE.Vector3();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = scrollP < 0.5 ? scrollP / 0.5 : 1 - (scrollP - 0.5) / 0.5;
      shards.forEach((c) => {
        tmp.copy(c.userData.scattered).lerp(c.userData.assembled, t);
        c.position.lerp(tmp, 0.08);
        c.material.opacity += (0.5 + t * 0.5 - c.material.opacity) * 0.06;
      });
      group.rotation.y = group.rotation.y * 0.98 + mx * 0.6 * 0.02 + 0.0015;
      camera.position.x += (mx * 1.2 - camera.position.x) * 0.05;
      camera.position.y += (-my * 1.2 - camera.position.y) * 0.05;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0" />;
}
