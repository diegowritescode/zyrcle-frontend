import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card } from "@/components/ui/card";
import "leaflet-routing-machine";
import type { Container, LatLng } from "@/lib/collectors";

import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";

const DefaultIcon = L.Icon.extend({});
const defaultIcon = new DefaultIcon({
    iconUrl: icon,
    iconRetinaUrl: iconRetinaUrl,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

const colombiaBounds = L.latLngBounds([-4.2, -79.5], [13.5, -66.8]);

interface LeafletMapProps {
    /** Containers to plot, in route order. */
    containers: Container[];
    /** Collector's current location (route start), if known. */
    userLocation?: LatLng | null;
    /** Draw the optimized route line through the points. */
    showRoute?: boolean;
    /** Container id whose popup should open. */
    selectedContainerId?: number | null;
}

/**
 * Presentational Leaflet map. All data (containers, user location, whether to
 * draw the route) comes from props — the parent owns fetching, so the map and
 * the route list always show the same thing.
 */
export function LeafletMap({
    containers,
    userLocation = null,
    showRoute = false,
    selectedContainerId = null,
}: LeafletMapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const leafletMapRef = useRef<L.Map | null>(null);
    const overlayRef = useRef<L.LayerGroup | null>(null);
    const routeRef = useRef<any>(null);

    // Create the map once.
    useEffect(() => {
        if (!mapRef.current || leafletMapRef.current) return;
        const map = L.map(mapRef.current).setView([6.2442, -75.5812], 12);
        map.setMaxBounds(colombiaBounds);
        map.setMinZoom(6);
        map.on("drag", () => map.panInsideBounds(colombiaBounds, { animate: false }));
        L.tileLayer(
            "https://tile.jawg.io/jawg-lagoon/{z}/{x}/{y}{r}.png?access-token=ukQ7o1P66GDJoHfBJ42xX7Oe6AvwLpqv9qQAxWPqrMnqPAKmrni9vApSJstgctS3",
            {
                attribution:
                    '&copy; <a href="https://jawg.io" target="_blank"><b>Jawg</b> Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 22,
            }
        ).addTo(map);
        overlayRef.current = L.layerGroup().addTo(map);
        leafletMapRef.current = map;

        return () => {
            map.remove();
            leafletMapRef.current = null;
            overlayRef.current = null;
            routeRef.current = null;
        };
    }, []);

    // Redraw markers + route whenever the data changes.
    useEffect(() => {
        const map = leafletMapRef.current;
        const overlay = overlayRef.current;
        if (!map || !overlay) return;

        overlay.clearLayers();
        if (routeRef.current) {
            map.removeControl(routeRef.current);
            routeRef.current = null;
        }

        if (userLocation) {
            L.marker([userLocation.latitude, userLocation.longitude], {
                icon: L.icon({
                    iconUrl: "https://cdn-icons-png.flaticon.com/512/64/64113.png",
                    iconSize: [30, 30],
                    iconAnchor: [15, 30],
                    popupAnchor: [0, -30],
                }),
            })
                .bindPopup("Tu ubicación")
                .addTo(overlay);
        }

        containers.forEach((c, i) => {
            const marker = L.marker([c.latitude, c.longitude])
                .bindPopup(`<b>${i + 1}. ${c.type ?? "Contenedor"}</b><br/>${c.address}`)
                .addTo(overlay);
            if (selectedContainerId === c.id) marker.openPopup();
        });

        if (showRoute && containers.length > 0) {
            const waypoints = [
                ...(userLocation ? [L.latLng(userLocation.latitude, userLocation.longitude)] : []),
                ...containers.map((c) => L.latLng(c.latitude, c.longitude)),
            ];
            routeRef.current = (L as any).Routing.control({
                waypoints,
                show: false,
                addWaypoints: false,
                draggableWaypoints: false,
                routeWhileDragging: false,
                fitSelectedRoutes: true,
                lineOptions: { styles: [{ color: "#10B981", weight: 5, opacity: 0.8 }] },
                createMarker: () => null, // markers already drawn above
            }).addTo(map);
            // The routing-machine itinerary panel is hidden; drop its DOM node.
            document.querySelector(".leaflet-routing-container")?.remove();
        } else if (containers.length > 0) {
            const bounds = L.latLngBounds(containers.map((c) => [c.latitude, c.longitude] as [number, number]));
            if (userLocation) bounds.extend([userLocation.latitude, userLocation.longitude]);
            map.fitBounds(bounds.pad(0.2));
        }
    }, [containers, userLocation, showRoute, selectedContainerId]);

    return (
        <Card className="p-0 overflow-hidden">
            <div ref={mapRef} style={{ height: "600px", width: "100%" }} className="z-0" />
        </Card>
    );
}
