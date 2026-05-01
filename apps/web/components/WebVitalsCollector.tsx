"use client";

// WebVitalsCollector — captura Core Web Vitals reales del cliente. Lote G.
//
// Implementación nativa con PerformanceObserver (sin dep web-vitals).
//   - LCP: Largest Contentful Paint del PerformanceObserver entry.
//   - INP: aproximación con event timings (más fiel: PerformanceEventTiming).
//   - CLS: suma de layout-shift entries (sin user input).
//   - FCP / TTFB: extra opcional.
//
// Sample 10% en cliente con Math.random() < 0.1 — solo enviamos ese
// porcentaje al backend para no saturar BD bajo tráfico real.
//
// Send con sendBeacon (si está disponible) cuando la página se cierra,
// para asegurar entrega aún si el usuario navega rápido.

import { useEffect } from "react";

const SAMPLE_RATE = 0.1; // 10%

interface VitalSamplePayload {
  nombre: "LCP" | "INP" | "CLS" | "FCP" | "TTFB";
  valor: number;
  ruta: string;
  deviceType: "mobile" | "desktop" | "tablet";
  connectionType?: string | null;
}

interface WindowWithCollector extends Window {
  __hablaWebVitalsInit?: boolean;
}

function detectarDevice(): "mobile" | "desktop" | "tablet" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobile|android|iphone|ipod/.test(ua)) return "mobile";
  return "desktop";
}

interface NetworkInformationLike {
  effectiveType?: string;
}

function detectarConnection(): string | null {
  if (typeof navigator === "undefined") return null;
  const conn = (navigator as Navigator & { connection?: NetworkInformationLike })
    .connection;
  return conn?.effectiveType ?? null;
}

function enviarSamples(samples: VitalSamplePayload[]) {
  if (samples.length === 0) return;
  const payload = JSON.stringify({ samples });
  const url = "/api/v1/vitals";

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    try {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    } catch {
      // fallback
    }
  }
  // fallback con fetch keepalive
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

interface PerfEntryWithValue extends PerformanceEntry {
  value?: number;
  hadRecentInput?: boolean;
}

interface PerformanceEventTimingLike extends PerformanceEntry {
  interactionId?: number;
}

export function WebVitalsCollector() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as WindowWithCollector;
    if (w.__hablaWebVitalsInit) return;
    w.__hablaWebVitalsInit = true;

    // Sample 10%
    if (Math.random() >= SAMPLE_RATE) return;

    const ruta = window.location.pathname;
    const device = detectarDevice();
    const connection = detectarConnection();
    const samples: VitalSamplePayload[] = [];

    // LCP — last Largest Contentful Paint entry observed
    let lcpValor = 0;
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1] as PerformanceEntry & {
          startTime?: number;
        };
        if (last && typeof last.startTime === "number") {
          lcpValor = last.startTime;
        }
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      // browser no soporta — skip
    }

    // CLS — suma de layout-shift sin recent input
    let clsValor = 0;
    try {
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerfEntryWithValue[]) {
          if (entry.hadRecentInput) continue;
          if (typeof entry.value === "number") {
            clsValor += entry.value;
          }
        }
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });
    } catch {
      // skip
    }

    // INP — peor duración de event timing (aproximación)
    let inpValor = 0;
    try {
      const inpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceEventTimingLike[]) {
          if (entry.duration > inpValor) {
            inpValor = entry.duration;
          }
        }
      });
      inpObserver.observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
    } catch {
      // skip
    }

    // FCP + TTFB del Navigation Timing (paint entries)
    let fcpValor = 0;
    let ttfbValor = 0;
    try {
      const paintEntries = performance.getEntriesByType("paint");
      const fcp = paintEntries.find((p) => p.name === "first-contentful-paint");
      if (fcp) fcpValor = fcp.startTime;
      const navEntry = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming | undefined;
      if (navEntry && typeof navEntry.responseStart === "number") {
        ttfbValor = navEntry.responseStart;
      }
    } catch {
      // skip
    }

    // Reportar al ocultar la pestaña (más confiable que beforeunload)
    function reportar() {
      if (lcpValor > 0) {
        samples.push({
          nombre: "LCP",
          valor: Math.round(lcpValor),
          ruta,
          deviceType: device,
          connectionType: connection,
        });
      }
      if (clsValor > 0) {
        samples.push({
          nombre: "CLS",
          valor: Number(clsValor.toFixed(4)),
          ruta,
          deviceType: device,
          connectionType: connection,
        });
      }
      if (inpValor > 0) {
        samples.push({
          nombre: "INP",
          valor: Math.round(inpValor),
          ruta,
          deviceType: device,
          connectionType: connection,
        });
      }
      if (fcpValor > 0) {
        samples.push({
          nombre: "FCP",
          valor: Math.round(fcpValor),
          ruta,
          deviceType: device,
          connectionType: connection,
        });
      }
      if (ttfbValor > 0) {
        samples.push({
          nombre: "TTFB",
          valor: Math.round(ttfbValor),
          ruta,
          deviceType: device,
          connectionType: connection,
        });
      }
      if (samples.length > 0) {
        enviarSamples(samples.splice(0));
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        reportar();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    // Pagehide cubre algunos browsers donde visibilitychange no llega
    window.addEventListener("pagehide", reportar);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", reportar);
    };
  }, []);

  return null;
}
