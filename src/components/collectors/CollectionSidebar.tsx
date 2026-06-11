import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart3, Layers, Recycle, Truck } from "lucide-react";
import { Container, statusSeverity } from "@/lib/collectors";

interface SessionStats {
    collectedCount: number;
    totalCount: number;
    collectedWeight: number;
    co2Saved: number;
}

interface CollectionSidebarProps {
    containers: Container[];
    isCollected: (id: number) => boolean;
    selectedId: number | null;
    onSelect: (id: number) => void;
    stats: SessionStats;
}

const StatTile = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
    <div className="bg-eco-forest/10 p-4 rounded-lg shadow-sm">
        <p className="text-xs text-eco-forest/60">{label}</p>
        <p className="text-lg font-bold text-eco-forest flex items-center">
            {icon}
            {value}
        </p>
    </div>
);

/** Sidebar: collection points sorted by fill level + real this-route stats. */
export function CollectionSidebar({ containers, isCollected, selectedId, onSelect, stats }: CollectionSidebarProps) {
    const byFill = [...containers].sort((a, b) => b.fillPercentage - a.fillPercentage);

    return (
        <div className="space-y-6">
            <Card className="shadow-md border-0 rounded-xl">
                <CardHeader className="bg-eco-forest/5">
                    <CardTitle className="flex items-center text-xl text-eco-forest">
                        <Layers className="h-5 w-5 mr-2 text-eco-emerald" />
                        Collection Points
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {byFill.map((c) => {
                            const sev = statusSeverity(c.status);
                            const done = isCollected(c.id);
                            return (
                                <div
                                    key={c.id}
                                    onClick={() => onSelect(c.id)}
                                    className={`p-4 cursor-pointer transition-colors hover:bg-eco-forest/10 ${selectedId === c.id ? "bg-eco-forest/10" : ""} ${done ? "opacity-60" : ""}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="space-y-1 min-w-0">
                                            <h4 className="font-semibold text-eco-forest truncate max-w-[200px]">
                                                {c.address}
                                            </h4>
                                            <p className="text-sm text-eco-forest/60">
                                                {c.type} · {new Date(c.lastUpdated).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <Badge className={`${sev.className} flex items-center space-x-1 shrink-0`}>
                                            <Recycle className="h-4 w-4" />
                                            <span>{c.fillPercentage}%</span>
                                        </Badge>
                                    </div>
                                    <Progress value={c.fillPercentage} className="h-2 mt-2 bg-eco-emerald/20" />
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-md border-0 rounded-xl">
                <CardHeader className="bg-eco-forest/5">
                    <CardTitle className="flex items-center text-xl text-eco-forest">
                        <BarChart3 className="h-5 w-5 mr-2 text-eco-emerald" />
                        This Route
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <StatTile
                            label="Collected"
                            value={`${stats.collectedCount}/${stats.totalCount}`}
                            icon={<Layers className="h-4 w-4 mr-2 text-eco-emerald" />}
                        />
                        <StatTile
                            label="Weight"
                            value={`${stats.collectedWeight} kg`}
                            icon={<Truck className="h-4 w-4 mr-2 text-eco-emerald" />}
                        />
                    </div>
                    <div className="bg-gradient-to-r from-eco-lime/80 to-eco-emerald/80 p-4 rounded-lg text-white shadow-sm">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">CO₂ Equivalent Saved</p>
                            <p className="text-lg font-bold flex items-center">
                                <Recycle className="h-5 w-5 mr-2" />
                                {stats.co2Saved} kg
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
