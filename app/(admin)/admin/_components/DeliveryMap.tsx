"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";
import type { LatLngExpression, Map as LeafletMap } from "leaflet";

export type MapPoint = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  kind: "shop" | "quartier" | "stop";
  /** Numéro affiché dans la pastille (ordre de passage d'une tournée) */
  badge?: string;
  draggable?: boolean;
  muted?: boolean;
};

type Props = {
  points: MapPoint[];
  /** Tracé de l'itinéraire (tournée) */
  route?: { lat: number; lng: number }[];
  onMove?: (id: string, lat: number, lng: number) => void;
  /** Clic sur la carte (ex : placer la boutique) */
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
};

const CONAKRY: LatLngExpression = [9.585, -13.64];

const STYLES: Record<MapPoint["kind"], string> = {
  shop: "background:#8B1A3A;color:#fff;width:30px;height:30px;font-size:15px",
  quartier: "background:#fff;color:#8B1A3A;border:2px solid #8B1A3A;width:14px;height:14px",
  stop: "background:#4f46e5;color:#fff;width:24px;height:24px;font-size:12px;font-weight:600",
};

/** Mini-carte OpenStreetMap (Leaflet, sans clé d'API). Chargée côté navigateur uniquement. */
export function DeliveryMap({ points, route, onMove, onMapClick, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const callbacks = useRef({ onMove, onMapClick });
  const fitted = useRef(false);

  useEffect(() => {
    callbacks.current = { onMove, onMapClick };
  }, [onMove, onMapClick]);

  // Création de la carte (une seule fois)
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { zoomControl: true }).setView(CONAKRY, 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.on("click", (e) => callbacks.current.onMapClick?.(e.latlng.lat, e.latlng.lng));
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      // Déclenche le premier dessin
      containerRef.current.dispatchEvent(new Event("map-ready"));
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // (Re)dessin des points et de l'itinéraire
  useEffect(() => {
    const container = containerRef.current;
    const draw = () =>
      import("leaflet").then((L) => {
        const map = mapRef.current;
        const layer = layerRef.current;
        if (!map || !layer) return;
        layer.clearLayers();

        if (route && route.length > 1) {
          L.polyline(route.map((p) => [p.lat, p.lng] as [number, number]), { color: "#4f46e5", weight: 3, dashArray: "6 6" }).addTo(layer);
        }

        for (const point of points) {
          const icon = L.divIcon({
            className: "",
            html: `<div style="${STYLES[point.kind]};border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.35);opacity:${point.muted ? 0.45 : 1}">${point.kind === "shop" ? "🏬" : point.badge ?? ""}</div>`,
            iconSize: point.kind === "shop" ? [30, 30] : point.kind === "stop" ? [24, 24] : [14, 14],
            iconAnchor: point.kind === "shop" ? [15, 15] : point.kind === "stop" ? [12, 12] : [7, 7],
          });
          const marker = L.marker([point.lat, point.lng], { icon, draggable: Boolean(point.draggable) })
            .bindTooltip(point.label, { direction: "top", offset: [0, -8] })
            .addTo(layer);
          if (point.draggable) {
            marker.on("dragend", () => {
              const { lat, lng } = marker.getLatLng();
              callbacks.current.onMove?.(point.id, Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5);
            });
          }
        }

        // Cadre ajusté une seule fois (ne pas « sauter » après chaque déplacement)
        if (!fitted.current && points.length > 0) {
          map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [30, 30], maxZoom: 14 });
          fitted.current = true;
        }
      });

    draw();
    container?.addEventListener("map-ready", draw);
    return () => container?.removeEventListener("map-ready", draw);
  }, [points, route]);

  return <div ref={containerRef} className={className ?? "h-80 w-full rounded-xl border border-[var(--color-border)]"} />;
}
