import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arc, arcTestnet } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'
import { requireChain } from './onchain-facts'

const arcRpc = requireChain(arc.id).rpcUrls[0]
const arcTestnetRpc = requireChain(arcTestnet.id).rpcUrls[0]

registerChain(arc.id, arcRpc)
registerChain(arcTestnet.id, arcTestnetRpc)

export const config = createConfig({
  chains: [arc, arcTestnet, mainnet],
  connectors: [injected()],
  transports: {
    [arc.id]: http(arcRpc),
    [arcTestnet.id]: http(arcTestnetRpc),
    [mainnet.id]: http(),
  },
})
