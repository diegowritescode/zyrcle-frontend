import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Navigation } from "lucide-react";
import { Container, statusSeverity } from "@/lib/collectors";

interface RouteStopListProps {
    /** Stops in route order. */
    stops: Container[];
    isCollected: (id: number) => boolean;
    onNavigate: (c: Container) => void;
    onCollect: (c: Container) => void;
}

/** Ordered list of collection stops with per-stop navigate / collect actions. */
export function RouteStopList({ stops, isCollected, onNavigate, onCollect }: RouteStopListProps) {
    if (stops.length === 0) {
        return (
            <div className="text-center text-eco-forest/60 italic py-6">
                No collection points available.
            </div>
        );
    }

    const firstPending = stops.find((c) => !isCollected(c.id));

    return (
        <Accordion
            type="single"
            collapsible
            defaultValue={firstPending ? `stop-${firstPending.id}` : undefined}
            className="space-y-3"
        >
            {stops.map((c, index) => {
                const collected = isCollected(c.id);
                const sev = statusSeverity(c.status);
                return (
                    <AccordionItem
                        key={c.id}
                        value={`stop-${c.id}`}
                        className={`border rounded-lg shadow-sm transition-all ${collected ? "bg-gray-50 opacity-80" : "bg-white"}`}
                    >
                        <AccordionTrigger
                            className={`px-4 py-3 hover:bg-eco-forest/5 ${collected ? "text-gray-600" : "text-eco-forest"}`}
                        >
                            <div className="flex justify-between items-center w-full font-semibold">
                                <div className="flex items-center space-x-3 truncate">
                                    <span
                                        className={`w-6 h-6 flex items-center justify-center rounded-full text-sm ${collected ? "bg-gray-200 text-gray-600" : "bg-eco-emerald text-white"}`}
                                    >
                                        {collected ? "✓" : index + 1}
                                    </span>
                                    <span className="truncate">{c.address}</span>
                                </div>
                                <Badge className={`${sev.className} font-medium`}>{sev.label}</Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className={`px-4 py-4 space-y-4 ${collected ? "text-gray-600" : "text-eco-forest"}`}>
                            <div className="flex justify-between text-sm">
                                <span className="font-medium">{c.type}</span>
                                <span>Weight: {c.estimatedWeight} kg</span>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm">
                                    <span>Fill Level</span>
                                    <span className="font-medium">{c.fillPercentage}%</span>
                                </div>
                                <Progress value={c.fillPercentage} className="h-3 mt-1 bg-eco-emerald/20" />
                            </div>
                            {collected ? (
                                <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 font-medium py-2">
                                    <CheckCircle className="h-5 w-5" />
                                    Collected
                                </div>
                            ) : (
                                <div className="flex space-x-2">
                                    <Button
                                        onClick={() => onNavigate(c)}
                                        variant="outline"
                                        className="flex-1"
                                    >
                                        <Navigation className="h-5 w-5 mr-2" />
                                        Navigate
                                    </Button>
                                    <Button
                                        onClick={() => onCollect(c)}
                                        className="flex-1 bg-eco-emerald hover:bg-eco-emerald-dark text-white"
                                    >
                                        <CheckCircle className="h-5 w-5 mr-2" />
                                        Collect &amp; Verify
                                    </Button>
                                </div>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                );
            })}
        </Accordion>
    );
}
