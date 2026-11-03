import { arc, arcTestnet } from 'viem/chains'
import { getAddress, isAddress } from 'viem'
import { getUsdc, requireChain } from '@/onchain-facts'

export type EscrowChainId = typeof arc.id | typeof arcTestnet.id

const requested = Number(import.meta.env.VITE_ESCROW_CHAIN_ID ?? arcTestnet.id)
export const ESCROW_CHAIN_ID: EscrowChainId = requested === arc.id ? arc.id : arcTestnet.id

export const CHAIN_FACTS = requireChain(ESCROW_CHAIN_ID)
export const IS_MAINNET = !CHAIN_FACTS.isTestnet

interface StoredDeployment {
  address: string
  block?: string
}

const STORE_KEY = `zeus-escrow-deployment-v1:${ESCROW_CHAIN_ID}`

function readStored(): StoredDeployment | undefined {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as StoredDeployment) : undefined
  } catch {
    return undefined
  }
}

export function saveDeployment(address: string, block?: bigint) {
  localStorage.setItem(STORE_KEY, JSON.stringify({ address, block: block?.toString() } satisfies StoredDeployment))
}

export function clearSavedDeployment() {
  localStorage.removeItem(STORE_KEY)
}

const stored = readStored()

const envAddress = String(import.meta.env.VITE_ZEUS_ESCROW_ADDRESS ?? '').trim()
const rawAddress = isAddress(envAddress) ? envAddress : (stored?.address ?? '')
export const ESCROW_ADDRESS: `0x${string}` | undefined = isAddress(rawAddress) ? getAddress(rawAddress) : undefined
export const ADDRESS_FROM_ENV = isAddress(envAddress)

const envBlock = String(import.meta.env.VITE_ZEUS_ESCROW_DEPLOY_BLOCK ?? '').trim()
const rawBlock = /^\d+$/.test(envBlock) ? envBlock : ADDRESS_FROM_ENV ? '' : (stored?.block ?? '')
export const DEPLOY_BLOCK: bigint | undefined = /^\d+$/.test(rawBlock) ? BigInt(rawBlock) : undefined

const usdc = getUsdc(ESCROW_CHAIN_ID)
if (!usdc) throw new Error(`USDC is not registered for chain ${ESCROW_CHAIN_ID}`)
export const USDC_ADDRESS = usdc.address as `0x${string}`
