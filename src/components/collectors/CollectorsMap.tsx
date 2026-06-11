import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, MapPin, Navigation, Truck } from "lucide-react";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LeafletMap } from "./LeafletMap";
import { RouteStopList } from "./RouteStopList";
import { CollectionSidebar } from "./CollectionSidebar";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import Web3 from "web3";
import { CORE_ABI, CORE_ADDRESS } from "@/lib/contracts";
import { ensureChain } from "@/lib/network";
import { Container, formatDuration } from "@/lib/collectors";
import { useCollectionRoute } from "@/hooks/useCollectionRoute";

const DROP_OFF = { latitude: 6.2455, longitude: -75.5612 };

export function CollectorsMap() {
    const route = useCollectionRoute();
    const navigate = useNavigate();
    const location = useLocation();
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [delivering, setDelivering] = useState(false);

    // When returning from the verify page, keep the optimized view.
    useEffect(() => {
        if (location.state?.preserveRoute) route.resume();
    }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps

    const openMaps = (lat: number, lng: number) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const url = `https://www.google.com/maps/dir/?api=1&origin=${pos.coords.latitude},${pos.coords.longitude}&destination=${lat},${lng}&travelmode=driving`;
                window.open(url, "_blank");
            },
            () => window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, "_blank")
        );
    };

    const handleCollect = (c: Container) => {
        // Verify the EXACT container of this stop (verify page reads state.container).
        navigate(`/verify-container/${c.id}`, { state: { container: c } });
    };

    const handleConfirmDelivery = async () => {
        if (route.collected.length === 0) {
            toast({ title: "Nothing to deliver", description: "Collect at least one container first." });
            return;
        }
        try {
            setDelivering(true);
            if (!(await ensureChain())) {
                toast({ variant: "destructive", title: "Wrong network", description: "Switch your wallet to Avalanche Fuji." });
                return;
            }
            const web3 = new Web3(window.ethereum);
            await window.ethereum.request({ method: "eth_requestAccounts" });
            const account = (await web3.eth.getAccounts())[0];
            const core = new web3.eth.Contract(CORE_ABI, CORE_ADDRESS);

            // Collections were already confirmed (with real photos/weights) on the
            // verify page; the batch only bundles the collected container ids.
            await core.methods.submitBatchDelivery(route.collected).send({ from: account });

            toast({ title: "Delivery confirmed!", description: "Today's batch was submitted on-chain." });
            route.reset();
        } catch (err) {
            console.error("Delivery failed:", err);
            toast({ variant: "destructive", title: "Delivery failed", description: "Could not submit the batch. Try again." });
        } finally {
            setDelivering(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 max-w-7xl mx-auto">
            <div className="lg:col-span-8 space-y-6">
                <PhaseBanner
                    phase={route.phase}
                    collectedCount={route.stats.collectedCount}
                    totalCount={route.stats.totalCount}
                    optimizing={route.optimizing}
                    onOptimize={route.optimize}
                    onNavigateDropoff={() => openMaps(DROP_OFF.latitude, DROP_OFF.longitude)}
                    onConfirmDelivery={handleConfirmDelivery}
                    delivering={delivering}
                />

                <Card className="shadow-md border-0 rounded-xl overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-eco-lime/10 to-eco-emerald/10">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="flex items-center text-2xl text-eco-forest">
                                    <MapPin className="h-6 w-6 mr-2 text-eco-emerald" />
                                    Collection Map
                                </CardTitle>
                                <CardDescription className="text-eco-forest/70">
                                    Waste collection routes in Medellín
                                </CardDescription>
                            </div>
                            <Button
                                size="lg"
                                disabled={route.optimizing || route.loading}
                                onClick={route.optimize}
                                className={route.optimized ? "bg-eco-emerald text-white hover:bg-eco-emerald-dark" : "bg-eco-forest text-white hover:bg-eco-forest-dark"}
                            >
                                <Navigation className="h-5 w-5 mr-2" />
                                {route.optimizing ? "Optimizing…" : route.optimized ? "Re-optimize" : "Optimize Route"}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4">
                        <LeafletMap
                            containers={route.route}
                            userLocation={route.userLocation}
                            showRoute={route.optimized}
                            selectedContainerId={selectedId}
                        />
                    </CardContent>
                </Card>

                <Card className="shadow-md border-0 rounded-xl">
                    <CardHeader className="bg-eco-forest/5">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="flex items-center text-2xl text-eco-forest">
                                    <Truck className="h-6 w-6 mr-2 text-eco-emerald" />
                                    Current Route
                                </CardTitle>
                                <CardDescription className="text-eco-forest/70">
                                    {route.optimized
                                        ? `${route.route.length} stops · ${route.stats.collectedCount} collected · Est. ${formatDuration(route.estimatedHours)} · ${route.totalDistance.toFixed(2)} km`
                                        : "Optimize a route to begin your collection journey."}
                                </CardDescription>
                            </div>
                            {route.optimized && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="text-eco-forest hover:bg-eco-forest/10">
                                            Reset Routes
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Reset collected stops?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This clears the collected progress for this route. It does not undo any on-chain transactions.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={route.reset}>Reset</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        {route.optimized ? (
                            <RouteStopList
                                stops={route.route}
                                isCollected={route.isCollected}
                                onNavigate={(c) => openMaps(c.latitude, c.longitude)}
                                onCollect={handleCollect}
                            />
                        ) : (
                            <div className="text-center text-eco-forest/60 italic py-6">
                                Optimize a route to view collection points.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="lg:col-span-4">
                <CollectionSidebar
                    containers={route.containers}
                    isCollected={route.isCollected}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    stats={route.stats}
                />
            </div>
        </div>
    );
}

/** Phase-aware banner: planning → collecting → delivery. */
function PhaseBanner({
    phase, collectedCount, totalCount, optimizing, onOptimize, onNavigateDropoff, onConfirmDelivery, delivering,
}: {
    phase: "planning" | "collecting" | "delivery";
    collectedCount: number;
    totalCount: number;
    optimizing: boolean;
    onOptimize: () => void;
    onNavigateDropoff: () => void;
    onConfirmDelivery: () => void;
    delivering: boolean;
}) {
    if (phase === "planning") {
        return (
            <Card className="bg-eco-forest/5 border-eco-forest/10 rounded-xl p-4 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-eco-forest flex items-center">
                            <Navigation className="h-5 w-5 mr-2 text-eco-emerald" />
                            Plan your route
                        </h3>
                        <p className="text-sm text-eco-forest/70">Optimize the collection route to get started.</p>
                    </div>
                    <Button onClick={onOptimize} disabled={optimizing} className="bg-eco-forest text-white hover:bg-eco-forest-dark">
                        {optimizing ? "Optimizing…" : "Optimize Route"}
                    </Button>
                </div>
            </Card>
        );
    }

    if (phase === "collecting") {
        const pct = totalCount ? Math.round((collectedCount / totalCount) * 100) : 0;
        return (
            <Card className="bg-eco-emerald/10 border-eco-emerald/20 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <Truck className="h-5 w-5 text-eco-emerald shrink-0" />
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-eco-forest">Collection in progress</h3>
                        <p className="text-sm text-eco-forest/70">
                            {collectedCount} of {totalCount} stops collected ({pct}%). Visit each stop and verify the pickup.
                        </p>
                    </div>
                </div>
            </Card>
        );
    }

    // delivery
    return (
        <Card className="bg-eco-emerald/10 border-eco-emerald/20 rounded-xl p-4 shadow-md animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h3 className="text-lg font-bold text-eco-forest flex items-center">
                        <CheckCircle className="h-5 w-5 mr-2 text-eco-emerald" />
                        All stops collected!
                    </h3>
                    <p className="text-sm text-eco-forest/70">Head to the drop-off center to finalize today's batch.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={onNavigateDropoff} className="bg-white text-eco-emerald hover:bg-eco-emerald/10">
                        Navigate to Drop-off
                    </Button>
                    <Button onClick={onConfirmDelivery} disabled={delivering} className="bg-eco-emerald text-white hover:bg-eco-emerald-dark">
                        {delivering ? "Confirming…" : "Confirm Delivery"}
                    </Button>
                </div>
            </div>
        </Card>
    );
}
