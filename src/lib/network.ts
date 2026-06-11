/**
 * Network guard: make sure the wallet is on the chain the contracts are
 * deployed to (Avalanche Fuji by default, from VITE_CHAIN_ID).
 *
 * Contract reads/writes go through `window.ethereum`, so if MetaMask is on the
 * wrong network the deployed addresses have no code and calls fail with
 * "Parameter decoding error / Returned values aren't valid". Calling
 * `ensureChain()` before interacting fixes that by switching (or adding) the
 * network.
 */
import { CHAIN_ID } from "./contracts";

const TARGET_CHAIN_ID = Number(CHAIN_ID || "43113");

// Parameters used to add the chain to MetaMask if the user doesn't have it yet.
const CHAIN_PARAMS: Record<number, any> = {
    43113: {
        chainId: "0xa869",
        chainName: "Avalanche Fuji C-Chain",
        nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
        rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
        blockExplorerUrls: ["https://testnet.snowtrace.io"],
    },
};

const toHex = (id: number) => "0x" + id.toString(16);

/**
 * Ensure the wallet is connected to the target chain. Returns true if we are on
 * (or successfully switched to) the right network, false otherwise.
 */
export async function ensureChain(): Promise<boolean> {
    const eth = (window as any).ethereum;
    if (!eth) return false;

    const current = await eth.request({ method: "eth_chainId" });
    if (parseInt(current, 16) === TARGET_CHAIN_ID) return true;

    try {
        await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: toHex(TARGET_CHAIN_ID) }],
        });
        return true;
    } catch (err: any) {
        // 4902 = chain not added to the wallet yet.
        if (err?.code === 4902 && CHAIN_PARAMS[TARGET_CHAIN_ID]) {
            try {
                await eth.request({
                    method: "wallet_addEthereumChain",
                    params: [CHAIN_PARAMS[TARGET_CHAIN_ID]],
                });
                return true;
            } catch {
                return false;
            }
        }
        return false;
    }
}
