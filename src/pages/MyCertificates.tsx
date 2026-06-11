import { useEffect, useState } from "react";
import Web3 from "web3";
import { CERTIFICATE_ABI, CERTIFICATE_ADDRESS } from "@/lib/contracts";
import { ensureChain } from "@/lib/network";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ipfs = (uri: string) =>
    `https://gateway.pinata.cloud/ipfs/${uri.replace("ipfs://", "")}`;

export default function MyCertificates() {
    const [certificates, setCertificates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCertificates = async () => {
            try {
                if (!window.ethereum || !CERTIFICATE_ADDRESS) {
                    setLoading(false);
                    return;
                }
                await ensureChain();
                const web3 = new Web3(window.ethereum);
                await window.ethereum.request({ method: "eth_requestAccounts" });
                const accounts = await web3.eth.getAccounts();
                const user = accounts[0];
                const contract = new web3.eth.Contract(CERTIFICATE_ABI, CERTIFICATE_ADDRESS);

                // Enumerate the user's tokens directly — no event scanning, so we
                // are immune to the 2048-block getLogs limit on public RPCs.
                const count = Number(await contract.methods.balanceOf(user).call());

                const results = await Promise.all(
                    Array.from({ length: count }, (_, i) => i).map(async (i) => {
                        try {
                            const tokenId = await contract.methods.tokenOfOwnerByIndex(user, i).call();
                            const uri: string = await contract.methods.tokenURI(tokenId).call();
                            const response = await fetch(ipfs(uri));
                            if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
                            const metadata = JSON.parse(await response.text());
                            return { tokenId: Number(tokenId), ...metadata };
                        } catch (innerErr) {
                            console.warn(`Error processing token index ${i}:`, innerErr);
                            return null;
                        }
                    })
                );

                setCertificates(results.filter((r) => r !== null));
            } catch (err) {
                console.error("Error fetching certificates:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchCertificates();
    }, []);

    return (
        <div className="min-h-screen flex flex-col bg-white">
            <Navbar />
            <main className="flex-grow px-4 py-8 max-w-6xl mx-auto">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-eco-forest mb-2 flex items-center">
                        🏛️ My Carbon Certificates
                    </h2>
                    <p className="text-sm text-eco-forest/70">
                        These are the NFTs you have minted for your sustainability contributions.
                    </p>
                </div>

                {loading ? (
                    <p className="text-eco-forest/60">Loading your certificates...</p>
                ) : certificates.length === 0 ? (
                    <p className="text-eco-forest/60">You haven't minted any certificates yet.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {certificates.map((cert) => (
                            <Card key={cert.tokenId} className="overflow-hidden shadow-md">
                                <img src={ipfs(cert.image)} alt={cert.name} className="w-full h-48 object-cover" />
                                <CardHeader>
                                    <CardTitle className="text-lg text-eco-forest">{cert.name}</CardTitle>
                                    <CardDescription className="text-eco-forest/70">Token ID: {cert.tokenId}</CardDescription>
                                </CardHeader>
                                <CardContent className="text-sm text-eco-forest">
                                    <p className="mb-2">{cert.description}</p>
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => window.open(ipfs(cert.image), "_blank")}
                                    >
                                        View Certificate
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
}
