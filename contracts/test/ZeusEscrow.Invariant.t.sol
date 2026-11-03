// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ZeusEscrow} from "../ZeusEscrow.sol";
import {MockUSDC} from "./ZeusEscrow.t.sol";

contract EscrowHandler is Test {
    ZeusEscrow public esc;
    MockUSDC public usdc;
    address[3] public payers;
    address[3] public payees;
    uint256 public ghostIn;
    uint256 public ghostOut;
    uint256 public settled;

    constructor(ZeusEscrow e, MockUSDC t) {
        esc = e;
        usdc = t;
        for (uint256 i; i < 3; i++) {
            payers[i] = address(uint160(0x1000 + i));
            payees[i] = address(uint160(0x2000 + i));
            vm.prank(payers[i]);
            t.approve(address(e), type(uint256).max);
        }
    }

    function create(uint256 p, uint256 q, uint256 amount, uint256 dl) external {
        address payer = payers[p % 3];
        address payee = payees[q % 3];
        amount = bound(amount, 1, 1e12);
        uint64 deadline = uint64(block.timestamp + bound(dl, 1, 30 days));
        usdc.mint(payer, amount);
        vm.prank(payer);
        esc.createDeal(payee, amount, deadline, "t");
        ghostIn += amount;
    }

    function act(uint256 kind, uint256 idSeed, uint256 callerSeed) external {
        uint256 next = esc.nextDealId();
        if (next == 1) return;
        uint256 id = bound(idSeed, 1, next - 1);
        uint256 amount = esc.getDeal(id).amount;
        address caller = callerSeed % 2 == 0 ? payers[(callerSeed / 2) % 3] : payees[(callerSeed / 2) % 3];
        kind = kind % 3;
        vm.prank(caller);
        if (kind == 0) {
            try esc.release(id) {
                ghostOut += amount;
                settled++;
            } catch {}
        } else if (kind == 1) {
            try esc.refund(id) {
                ghostOut += amount;
                settled++;
            } catch {}
        } else {
            try esc.cancel(id) {
                ghostOut += amount;
                settled++;
            } catch {}
        }
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 0, 10 days));
    }

    function allHolders() external view returns (address[7] memory h) {
        for (uint256 i; i < 3; i++) {
            h[i] = payers[i];
            h[i + 3] = payees[i];
        }
        h[6] = address(esc);
    }
}

contract ZeusEscrowInvariantTest is Test {
    MockUSDC internal usdc;
    ZeusEscrow internal esc;
    EscrowHandler internal handler;

    function setUp() public {
        vm.warp(1_000_000);
        usdc = new MockUSDC();
        esc = new ZeusEscrow(address(usdc));
        handler = new EscrowHandler(esc, usdc);
        targetContract(address(handler));
    }

    function invariant_BalanceEqualsSumOfActiveDeals() public view {
        uint256 sum;
        uint256 n = esc.nextDealId();
        for (uint256 id = 1; id < n; id++) {
            ZeusEscrow.Deal memory d = esc.getDeal(id);
            if (d.status == ZeusEscrow.Status.Active) sum += d.amount;
        }
        assertEq(usdc.balanceOf(address(esc)), sum);
    }

    function invariant_BalanceEqualsInMinusOut() public view {
        assertEq(usdc.balanceOf(address(esc)), handler.ghostIn() - handler.ghostOut());
    }

    function invariant_TokensConserved() public view {
        address[7] memory h = handler.allHolders();
        uint256 total;
        for (uint256 i; i < 7; i++) {
            total += usdc.balanceOf(h[i]);
        }
        assertEq(total, usdc.totalSupply());
    }

    function invariant_IdsAreDense() public view {
        uint256 n = esc.nextDealId();
        for (uint256 id = 1; id < n; id++) {
            assertTrue(esc.getDeal(id).status != ZeusEscrow.Status.None);
        }
    }
}
