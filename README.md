# Zeus Escrow

A USDC escrow app on Arc for deals between crypto projects and promoters (KOLs, raid teams, listing services). A project locks USDC for a promoter, releases it when the work is delivered, or takes it back after the deadline. The promoter can cancel at any time and the USDC returns to the project. No fees and no admin keys.

Built with [Arc Studio](https://studio.arc.io)

## Live on Arc mainnet

- Contract: [`0x58676757a73976f47eA03A4D82f8720008444A1F`](https://explorer.arc.io/address/0x58676757a73976f47eA03A4D82f8720008444A1F)
- First deal created and funded with USDC: [`0x35948e8ff3ad49af3a51e0e7b6c6792fdf6c8d3cefc48e24aecd13c9357bf0d4`](https://explorer.arc.io/tx/0x35948e8ff3ad49af3a51e0e7b6c6792fdf6c8d3cefc48e24aecd13c9357bf0d4)
- First deal released to the payee: [`0x15a861d3a8c3a1aedd1831d08efcdcf044556b878834a06c6d1be7b06653b94e`](https://explorer.arc.io/tx/0x15a861d3a8c3a1aedd1831d08efcdcf044556b878834a06c6d1be7b06653b94e)

Tested end to end on Arc Testnet first: release, refund after the deadline, and payee cancel.

## What you can do

- Connect a wallet and create a deal with a payee address, amount, deadline and title.
- Share a link for each deal so the payee can see its live status.
- See your deals as payer and as payee, with Release, Refund and Cancel buttons where allowed.
- See every transaction with a link to the Arc explorer.

## Tech stack

React, Vite, TypeScript, Tailwind CSS, wagmi, viem, ConnectKit. Solidity 0.8.28 with OpenZeppelin and Foundry.

## Development

Prerequisites: [Bun](https://bun.sh) and [Foundry](https://book.getfoundry.sh).

```bash
bun install
git clone --depth 1 https://github.com/foundry-rs/forge-std lib/forge-std   # test dependency
bun run dev
```

Styles are compiled to a static `public/zeus.css` automatically on every `bun run dev` start and every `bun run build`. Nothing extra to run.

Other commands:

```bash
bun run build             # production build
bun run preview           # serve the production build locally
bun run contracts:build   # compile the contract
bun run contracts:bytecode # copy the compiled bytecode into the app for /deploy
bun run contracts:test    # run the Foundry tests
bun run lint              # lint
bun run typecheck         # typecheck
```

### Environment variables

| Name | Purpose |
| --- | --- |
| `VITE_ZEUS_ESCROW_ADDRESS` | Address of the deployed `ZeusEscrow` contract. Optional if you deployed from `/deploy` and saved it in your browser. |
| `VITE_ZEUS_ESCROW_DEPLOY_BLOCK` | Optional. Block the contract was deployed at, so the deal page can list every transaction for a deal. |
| `VITE_ESCROW_CHAIN_ID` | Optional. `5042002` (Arc Testnet, default) or `5042` (Arc mainnet). |

## Deploying the contract

Open `/deploy` in the app, connect your wallet and press **Deploy ZeusEscrow**. Your wallet signs one transaction, and the page shows the deployed address and an explorer link. The only constructor argument is the USDC address on Arc, `0x3600000000000000000000000000000000000000`. No private key ever touches the app.

Press **Use this contract in the app** to save the address in your browser, or add it to `.env` to make it permanent and restart the dev server.

The app defaults to Arc Testnet. Set `VITE_ESCROW_CHAIN_ID=5042` to use Arc mainnet, which moves real funds. Have the contract independently reviewed before you do.

If you change `contracts/ZeusEscrow.sol`, run `bun run contracts:build` and then `bun run contracts:bytecode` so the `/deploy` page deploys the new code.

## License

Copyright (c) 2026 Zeus Tools. All rights reserved. The source is published for review only. No permission is granted to copy, modify or redistribute it. See [LICENSE](LICENSE).
