import { parseAbi } from 'viem'

export const escrowAbi = parseAbi([
  'struct Deal { address payer; address payee; uint256 amount; uint64 deadline; string title; uint8 status; }',
  'function createDeal(address payee, uint256 amount, uint64 deadline, string title) returns (uint256 dealId)',
  'function release(uint256 dealId)',
  'function refund(uint256 dealId)',
  'function cancel(uint256 dealId)',
  'function getDeal(uint256 dealId) view returns (Deal deal)',
  'function getDealIdsByPayer(address payer) view returns (uint256[] dealIds)',
  'function getDealIdsByPayee(address payee) view returns (uint256[] dealIds)',
  'function nextDealId() view returns (uint256)',
  'function usdc() view returns (address)',
  'constructor(address usdcAddress)',
  'error ZeroTokenAddress()',
  'error InvalidPayee()',
  'error InvalidAmount()',
  'error InvalidDeadline()',
  'error InvalidTitle()',
  'error IncorrectDepositAmount()',
  'error UnknownDeal(uint256 dealId)',
  'error DealNotActive(uint256 dealId)',
  'error OnlyPayer()',
  'error OnlyPayee()',
  'error DeadlineNotPassed()',
  'event DealCreated(uint256 indexed dealId, address indexed payer, address indexed payee, uint256 amount, uint64 deadline, string title)',
  'event DealReleased(uint256 indexed dealId, address indexed payer, address indexed payee, uint256 amount)',
  'event DealRefunded(uint256 indexed dealId, address indexed payer, address indexed payee, uint256 amount)',
  'event DealCancelled(uint256 indexed dealId, address indexed payee, address indexed payer, uint256 amount)',
])

export const STATUS = {
  None: 0,
  Active: 1,
  Released: 2,
  Refunded: 3,
  Cancelled: 4,
} as const

export type DealStatus = (typeof STATUS)[keyof typeof STATUS]

export interface Deal {
  id: bigint
  payer: `0x${string}`
  payee: `0x${string}`
  amount: bigint
  deadline: bigint
  title: string
  status: DealStatus
}
