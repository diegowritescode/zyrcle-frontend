import { useCallback } from "react";
import { Scanner, IDetectedBarcode } from "@yudiel/react-qr-scanner";

interface QRCodeScannerProps {
    onScan: (result: string) => void;
}

export default function QRCodeScanner({ onScan }: QRCodeScannerProps) {
    const handleScan = useCallback((codes: IDetectedBarcode[]) => {
        const value = codes[0]?.rawValue;
        if (value) {
            onScan(value);
        }
    }, [onScan]);

    return (
        <div className="relative w-full max-w-md mx-auto">
            <Scanner
                constraints={{ facingMode: "environment" }}
                onScan={handleScan}
                styles={{ container: { width: "100%" }, video: { borderRadius: "0.5rem", width: "100%" } }}
            />
            <div className="absolute inset-0 border-4 border-eco-emerald/50 rounded-lg pointer-events-none" />
        </div>
    );
}
