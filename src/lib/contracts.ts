/**
 * Central on-chain configuration: contract addresses + ABIs.
 *
 * Addresses come from `VITE_*_ADDRESS` env vars, which the deploy script
 * (`Contracts/scripts/deploy.js`) writes into `.env` after each deployment.
 * The ABIs are the compiled artifacts copied into `src/lib/abi/` by that same
 * script, so they always match the deployed contracts.
 */
import type { AbiItem } from "web3-utils";
import ZyrcleTokenAbi from "./abi/ZyrcleToken.json";
import ZyrcleCertificateAbi from "./abi/ZyrcleCertificate.json";
import ZyrcleCoreAbi from "./abi/ZyrcleCore.json";

export const TOKEN_ADDRESS: string = import.meta.env.VITE_TOKEN_ADDRESS ?? "";
export const CERTIFICATE_ADDRESS: string = import.meta.env.VITE_CERTIFICATE_ADDRESS ?? "";
export const CORE_ADDRESS: string = import.meta.env.VITE_CORE_ADDRESS ?? "";

/** Expected chain id (43113 = Avalanche Fuji). Empty string if unset. */
export const CHAIN_ID: string = import.meta.env.VITE_CHAIN_ID ?? "";

export const TOKEN_ABI = ZyrcleTokenAbi as AbiItem[];
export const CERTIFICATE_ABI = ZyrcleCertificateAbi as AbiItem[];
export const CORE_ABI = ZyrcleCoreAbi as AbiItem[];

/** True when the deployed addresses have been configured (post-deploy). */
export const contractsConfigured = (): boolean =>
  Boolean(TOKEN_ADDRESS && CERTIFICATE_ADDRESS && CORE_ADDRESS);
