import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import {
    Container,
    LatLng,
    loadCollected,
    saveCollected,
    routeDistanceKm,
    estimateHours,
} from "@/lib/collectors";

type Phase = "planning" | "collecting" | "delivery";

/**
 * Single source of truth for the collector dashboard.
 *
 * Owns the container data, the (optionally optimized) route order, the set of
 * collected stops (persisted), and all derived values. The map and the route
 * list both consume the SAME ordered `route`, so they can no longer diverge.
 */
export function useCollectionRoute() {
    const [containers, setContainers] = useState<Container[]>([]);
    const [route, setRoute] = useState<Container[]>([]);
    const [collected, setCollected] = useState<number[]>(() => loadCollected());
    const [userLocation, setUserLocation] = useState<LatLng | null>(null);
    const [optimized, setOptimized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [optimizing, setOptimizing] = useState(false);

    // Initial load: fetch the containers once.
    useEffect(() => {
        let active = true;
        fetch(`${API_BASE_URL}/api/rutas/quemadas`)
            .then((res) => res.json())
            .then((data: Container[]) => {
                if (!active) return;
                setContainers(data);
                setRoute(data);
            })
            .catch((err) => console.error("Failed to load containers:", err))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, []);

    // Re-read collected from storage on mount (e.g. when returning from verify).
    useEffect(() => {
        setCollected(loadCollected());
    }, []);

    const persist = useCallback((ids: number[]) => {
        setCollected(ids);
        saveCollected(ids);
    }, []);

    const markCollected = useCallback(
        (id: number) => {
            if (!collected.includes(id)) persist([...collected, id]);
        },
        [collected, persist]
    );

    const reset = useCallback(() => persist([]), [persist]);

    /** Ask the backend (Gemini) for an optimized order; fall back to fill-level sort. */
    const optimize = useCallback(async () => {
        setOptimizing(true);
        const applyFallback = () => {
            setRoute([...containers].sort((a, b) => b.fillPercentage - a.fillPercentage));
            setOptimized(true);
        };

        const getLocation = () =>
            new Promise<LatLng | null>((resolve) => {
                if (!navigator.geolocation) return resolve(null);
                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                    () => resolve(null),
                    { timeout: 8000 }
                );
            });

        try {
            const loc = await getLocation();
            setUserLocation(loc);
            if (!loc) {
                applyFallback();
                return;
            }
            const res = await fetch(`${API_BASE_URL}/api/rutas/optimizar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(loc),
            });
            if (!res.ok) throw new Error("optimize endpoint failed");
            const ordered: Container[] = await res.json();
            setRoute(ordered.length ? ordered : containers);
            setOptimized(true);
        } catch (err) {
            console.warn("Route optimization failed, using fill-level order:", err);
            applyFallback();
        } finally {
            setOptimizing(false);
        }
    }, [containers]);

    /** Keep the optimized view when returning from the verify page. */
    const resume = useCallback(() => setOptimized(true), []);

    const pending = useMemo(
        () => route.filter((c) => !collected.includes(c.id)),
        [route, collected]
    );

    const allCollected = useMemo(
        () => route.length > 0 && route.every((c) => collected.includes(c.id)),
        [route, collected]
    );

    const phase: Phase = !optimized ? "planning" : allCollected ? "delivery" : "collecting";

    const totalDistance = useMemo(
        () => routeDistanceKm(userLocation, route.map((c) => ({ latitude: c.latitude, longitude: c.longitude }))),
        [userLocation, route]
    );

    // Session stats from real data: what has actually been collected this route.
    const collectedContainers = useMemo(
        () => containers.filter((c) => collected.includes(c.id)),
        [containers, collected]
    );
    const stats = useMemo(() => {
        const weight = collectedContainers.reduce((sum, c) => sum + (c.estimatedWeight || 0), 0);
        return {
            collectedCount: collectedContainers.length,
            totalCount: route.length,
            collectedWeight: Number(weight.toFixed(1)),
            co2Saved: Number((weight * 0.18).toFixed(1)),
        };
    }, [collectedContainers, route.length]);

    return {
        containers,
        route,
        pending,
        collected,
        userLocation,
        optimized,
        optimizing,
        loading,
        phase,
        allCollected,
        totalDistance,
        estimatedHours: estimateHours(totalDistance),
        stats,
        optimize,
        resume,
        markCollected,
        reset,
        isCollected: (id: number) => collected.includes(id),
    };
}
