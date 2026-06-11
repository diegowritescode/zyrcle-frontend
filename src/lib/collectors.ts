/**
 * Shared types + helpers for the collector flow.
 */

export interface Container {
    id: number;
    address: string;
    type: string;
    estimatedWeight: number;
    fillPercentage: number;
    status: string;
    lastUpdated: string;
    latitude: number;
    longitude: number;
}

export interface LatLng {
    latitude: number;
    longitude: number;
}

/** localStorage key for the set of collected container ids (single source of truth). */
export const COLLECTED_KEY = "zyrcle:collected";

export const loadCollected = (): number[] => {
    try {
        const raw = localStorage.getItem(COLLECTED_KEY);
        return raw ? (JSON.parse(raw) as number[]).map(Number) : [];
    } catch {
        return [];
    }
};

export const saveCollected = (ids: number[]) =>
    localStorage.setItem(COLLECTED_KEY, JSON.stringify(ids));

/**
 * Map the backend's Spanish fill statuses to a severity + Tailwind classes.
 * (The old code only knew English labels, so every badge rendered gray.)
 */
export function statusSeverity(status: string): { label: string; className: string } {
    switch (status?.toLowerCase()) {
        case "lleno":
        case "full":
        case "urgent":
            return { label: status, className: "text-red-600 bg-red-100" };
        case "medio":
        case "medium":
        case "high":
            return { label: status, className: "text-amber-600 bg-amber-100" };
        case "disponible":
        case "available":
        case "low":
            return { label: status, className: "text-emerald-600 bg-emerald-100" };
        default:
            return { label: status || "—", className: "text-gray-600 bg-gray-100" };
    }
}

/** Haversine distance in km between two coordinates. */
export function haversineKm(a: LatLng, b: LatLng): number {
    const R = 6371;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const h =
        Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Total distance (km) of a path that starts at `start` and visits each point in order. */
export function routeDistanceKm(start: LatLng | null, points: LatLng[]): number {
    const stops = start ? [start, ...points] : points;
    let total = 0;
    for (let i = 0; i < stops.length - 1; i++) {
        total += haversineKm(stops[i], stops[i + 1]);
    }
    return total;
}

/** Rough drive time (hours) at an average urban speed. */
export const estimateHours = (distanceKm: number, avgSpeedKmh = 30) => distanceKm / avgSpeedKmh;

/** Format hours as "Xh Ym". */
export function formatDuration(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours % 1) * 60);
    return `${h}h ${m}m`;
}
