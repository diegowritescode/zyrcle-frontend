import { useEffect, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Minus, Plus, Trash2 } from "lucide-react";
import Web3 from "web3";
import { CORE_ABI, CORE_ADDRESS, TOKEN_ABI, TOKEN_ADDRESS } from "@/lib/contracts";
import { ensureChain } from "@/lib/network";

interface Product {
    id: number;
    name: string;
    description: string;
    uri: string;
    image: string;
    price: number;
    level: string;
}

interface CartLine extends Product {
    quantity: number;
}

const certificateProducts: Product[] = [
    {
        id: 1,
        name: "Gold Carbon Certificate",
        description: "Awarded for preventing 2 tons of CO₂ emissions.",
        uri: "ipfs://bafkreidtbeo2bu2tb5ztwifnnsd4fxumhevfbkto37grwvl6kdo2mowp2e",
        image: "https://gateway.pinata.cloud/ipfs/bafybeiecfedwjacjezbd7nnnelox7jylusy2tvst62dqxhbdu5c6z72lji",
        price: 200,
        level: "Gold",
    },
    {
        id: 2,
        name: "Silver Carbon Certificate",
        description: "Awarded for preventing 1 ton of CO₂ emissions.",
        uri: "ipfs://bafkreibc3z3545claecbpjhvu3nmxb7o3ewqafavpt4xst3kk6nuf4glui",
        image: "https://gateway.pinata.cloud/ipfs/bafybeid375zofvzjsyjpqqlr4svnmzgypu4ssutvlfbewqzfpfxa3ofuk4",
        price: 100,
        level: "Silver",
    },
    {
        id: 3,
        name: "Bronze Carbon Certificate",
        description: "Awarded for preventing 500kg of CO₂ emissions.",
        uri: "ipfs://bafkreiepxu3mqhu47q35p2fw2eb4gqtkogi3xnko7nxq7z4azwvt64rbgu",
        image: "https://gateway.pinata.cloud/ipfs/bafybeiezq2dekmilwfel2faqfhjsdtytkadz7457vr446z5opov3uzw3na",
        price: 50,
        level: "Bronze",
    },
];

export function ProductGrid() {
    const [cart, setCart] = useState<CartLine[]>([]);
    const [cartOpen, setCartOpen] = useState(false);
    const [mintedIds, setMintedIds] = useState<string[]>([]);
    const [balance, setBalance] = useState<number>(0);
    const [status, setStatus] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const loadBalance = async () => {
            if (!window.ethereum || !TOKEN_ADDRESS) return;
            try {
                await ensureChain();
                const web3 = new Web3(window.ethereum);
                const accounts = await web3.eth.getAccounts();
                if (accounts.length === 0) return;
                const token = new web3.eth.Contract(TOKEN_ABI, TOKEN_ADDRESS);
                const raw = await token.methods.balanceOf(accounts[0]).call();
                setBalance(Number(web3.utils.fromWei(raw.toString(), "ether")));
            } catch (err) {
                console.warn("Could not load ZYR balance:", err);
            }
        };
        loadBalance();
    }, []);

    const totalItems = cart.reduce((n, l) => n + l.quantity, 0);
    const totalPrice = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);

    const addToCart = (product: Product) => {
        setCart((prev) => {
            const existing = prev.find((l) => l.id === product.id);
            if (existing) {
                return prev.map((l) => (l.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
            }
            return [...prev, { ...product, quantity: 1 }];
        });
        setMintedIds([]);
    };

    const changeQty = (id: number, delta: number) => {
        setCart((prev) =>
            prev
                .map((l) => (l.id === id ? { ...l, quantity: l.quantity + delta } : l))
                .filter((l) => l.quantity > 0)
        );
    };

    const removeLine = (id: number) => setCart((prev) => prev.filter((l) => l.id !== id));

    const handleCheckout = async () => {
        setStatus(null);
        setMintedIds([]);
        if (cart.length === 0) return;

        if (!window.ethereum) {
            setStatus("No Ethereum wallet detected. Please install MetaMask.");
            return;
        }
        if (!CORE_ADDRESS || !TOKEN_ADDRESS) {
            setStatus("Contracts are not configured yet.");
            return;
        }
        if (balance < totalPrice) {
            setStatus(`Not enough ZYR. You need ${totalPrice} but have ${balance}. Recycle to earn more!`);
            return;
        }

        // Flatten the cart into one URI per certificate to mint (respects quantities).
        const toMint = cart.flatMap((l) => Array(l.quantity).fill(l.uri)) as string[];

        try {
            setBusy(true);
            if (!(await ensureChain())) {
                setStatus("Please switch your wallet to the Avalanche Fuji network.");
                return;
            }
            const web3 = new Web3(window.ethereum);
            await window.ethereum.request({ method: "eth_requestAccounts" });
            const account = (await web3.eth.getAccounts())[0];
            const token = new web3.eth.Contract(TOKEN_ABI, TOKEN_ADDRESS);
            const core = new web3.eth.Contract(CORE_ABI, CORE_ADDRESS);

            // 1) One approval covering the whole cart total.
            setStatus("Approving ZYR payment…");
            const totalWei = web3.utils.toWei(totalPrice.toString(), "ether");
            await token.methods.approve(CORE_ADDRESS, totalWei).send({ from: account });

            // 2) Mint each certificate (Core charges ZYR per item and holds MINTER_ROLE).
            const minted: string[] = [];
            for (let i = 0; i < toMint.length; i++) {
                setStatus(`Minting certificate ${i + 1} of ${toMint.length}…`);
                const result: any = await core.methods.purchaseCertificate(toMint[i]).send({ from: account });
                const ev = Object.values(result.events || {}).find(
                    (e: any) => e.event === "CertificatePurchased"
                ) as any;
                if (ev?.returnValues?.certificateId != null) minted.push(ev.returnValues.certificateId.toString());
            }

            setMintedIds(minted);
            setBalance((b) => b - totalPrice);
            setCart([]);
            setStatus(null);
        } catch (err: any) {
            console.error("Checkout failed:", err);
            setStatus(
                err?.message?.includes("Certificate not for sale")
                    ? "One of the certificates is not for sale on-chain."
                    : "Checkout failed or was rejected. Any certificates already minted are in your wallet."
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-eco-forest">Carbon Credit Certificates</h2>
                <span className="text-sm font-medium text-eco-forest/80">Balance: {balance} ZYR</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {certificateProducts.map((product) => (
                    <Card key={product.id} className="overflow-hidden">
                        <img src={product.image} alt={product.name} className="w-full h-64 object-cover" />
                        <CardHeader className="p-4">
                            <h3 className="font-semibold text-lg text-eco-forest">{product.name}</h3>
                            <p className="text-sm text-eco-forest/70">{product.description}</p>
                        </CardHeader>
                        <CardContent className="px-4">{product.price} ZYR</CardContent>
                        <CardFooter className="p-4 pt-0">
                            <Button className="w-full bg-eco-emerald text-white" onClick={() => addToCart(product)}>
                                Add to Cart
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            {totalItems > 0 && (
                <div className="fixed bottom-6 right-6 z-50">
                    <Button onClick={() => setCartOpen(true)} className="bg-eco-forest text-white rounded-full p-4 shadow-lg">
                        🛒 {totalItems}
                    </Button>
                </div>
            )}

            <Dialog open={cartOpen} onOpenChange={setCartOpen}>
                <DialogContent className="rounded-xl shadow-xl">
                    <DialogHeader>
                        <DialogTitle>Your Cart</DialogTitle>
                    </DialogHeader>

                    {cart.length === 0 ? (
                        <p className="py-6 text-center text-eco-forest/60">Your cart is empty.</p>
                    ) : (
                        <>
                            <div className="divide-y">
                                {cart.map((item) => (
                                    <div key={item.id} className="flex justify-between items-center py-3">
                                        <div className="min-w-0">
                                            <h4 className="font-medium text-eco-forest truncate">{item.name}</h4>
                                            <p className="text-sm text-eco-forest/60">{item.price} ZYR each</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => changeQty(item.id, -1)}>
                                                <Minus className="h-3 w-3" />
                                            </Button>
                                            <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => changeQty(item.id, 1)}>
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeLine(item.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between items-center pt-3 font-semibold text-eco-forest">
                                <span>Total ({totalItems} {totalItems === 1 ? "item" : "items"})</span>
                                <span>{totalPrice} ZYR</span>
                            </div>

                            <Button onClick={handleCheckout} disabled={busy} className="mt-2 w-full bg-eco-emerald text-white">
                                {busy ? "Processing…" : `Buy ${totalItems} with ZYR`}
                            </Button>
                        </>
                    )}

                    {status && <p className="mt-3 text-center text-sm text-eco-forest/80">{status}</p>}

                    {mintedIds.length > 0 && (
                        <div className="mt-4 text-center text-green-600">
                            ✅ Minted {mintedIds.length} certificate{mintedIds.length > 1 ? "s" : ""}! Token IDs: {mintedIds.join(", ")}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
