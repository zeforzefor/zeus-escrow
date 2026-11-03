// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ZeusEscrow} from "../ZeusEscrow.sol";
import {ZeusEscrowBase, MockUSDC, OddToken} from "./ZeusEscrow.t.sol";

interface IReenter {
    function reenter() external;
}

contract ReentrantToken is MockUSDC {
    IReenter public hook;
    bool public armed;

    function arm(address h) external {
        hook = IReenter(h);
        armed = true;
    }

    function _fire() internal {
        if (armed) {
            armed = false;
            hook.reenter();
        }
    }

    function transfer(address to, uint256 amount) public override returns (bool r) {
        r = super.transfer(to, amount);
        _fire();
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool r) {
        r = super.transferFrom(from, to, amount);
        _fire();
    }
}

contract Attacker is IReenter {
    ZeusEscrow public esc;
    ReentrantToken public tok;
    bytes public payload;
    bool public ok;
    bytes public ret;
    uint256 public calls;
    uint256 public watchId;
    uint8 public seenStatus;

    constructor(ZeusEscrow e, ReentrantToken t) {
        esc = e;
        tok = t;
        t.approve(address(e), type(uint256).max);
    }

    function setPayload(bytes calldata p, uint256 watch) external {
        payload = p;
        watchId = watch;
    }

    function create(address payee, uint256 amount, uint64 dl, string calldata title) external returns (uint256) {
        return esc.createDeal(payee, amount, dl, title);
    }

    function release(uint256 id) external {
        esc.release(id);
    }

    function refund(uint256 id) external {
        esc.refund(id);
    }

    function cancel(uint256 id) external {
        esc.cancel(id);
    }

    function reenter() external {
        calls++;
        (ok, ret) = address(esc).call(payload);
        try esc.getDeal(watchId) returns (ZeusEscrow.Deal memory d) {
            seenStatus = uint8(d.status);
        } catch {}
    }

    function errSelector() external view returns (bytes4) {
        bytes memory r = ret;
        return r.length >= 4 ? bytes4(r) : bytes4(0);
    }
}

contract ZeusEscrowExtraTest is ZeusEscrowBase {
    ReentrantToken internal rt;
    ZeusEscrow internal re;
    Attacker internal atk;

    function _setupReentrancy() internal {
        rt = new ReentrantToken();
        re = new ZeusEscrow(address(rt));
        atk = new Attacker(re, rt);
        rt.mint(address(atk), 1_000e6);
        rt.mint(alice, 1_000e6);
        vm.prank(alice);
        rt.approve(address(re), type(uint256).max);
    }

    function test_Reentrancy_ReleaseBlocked() public {
        _setupReentrancy();

        vm.prank(alice);
        re.createDeal(carol, 50e6, _deadline(), "honest");
        uint256 id = atk.create(bob, AMOUNT, _deadline(), TITLE);
        assertEq(id, 2);

        atk.setPayload(abi.encodeCall(ZeusEscrow.release, (id)), id);
        rt.arm(address(atk));
        atk.release(id);

        assertEq(atk.calls(), 1, "hook fired");
        assertFalse(atk.ok(), "re-entry must fail");
        assertEq(atk.errSelector(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(atk.seenStatus(), uint8(ZeusEscrow.Status.Released), "state updated before transfer");
        assertEq(rt.balanceOf(bob), AMOUNT, "paid exactly once");
        assertEq(rt.balanceOf(address(re)), 50e6, "other deal untouched");
    }

    function test_Reentrancy_ReleaseOtherDealBlocked() public {
        _setupReentrancy();
        uint256 a = atk.create(bob, AMOUNT, _deadline(), "one");
        uint256 b = atk.create(carol, 40e6, _deadline(), "two");
        atk.setPayload(abi.encodeCall(ZeusEscrow.release, (b)), b);
        rt.arm(address(atk));
        atk.release(a);
        assertFalse(atk.ok());
        assertEq(atk.errSelector(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(atk.seenStatus(), uint8(ZeusEscrow.Status.Active));
        assertEq(rt.balanceOf(carol), 0);
        assertEq(rt.balanceOf(address(re)), 40e6);
    }

    function test_Reentrancy_RefundBlocked() public {
        _setupReentrancy();
        uint256 id = atk.create(bob, AMOUNT, _deadline(), TITLE);
        vm.warp(_deadline() + 1);
        atk.setPayload(abi.encodeCall(ZeusEscrow.refund, (id)), id);
        rt.arm(address(atk));
        atk.refund(id);

        assertFalse(atk.ok());
        assertEq(atk.errSelector(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(atk.seenStatus(), uint8(ZeusEscrow.Status.Refunded));
        assertEq(rt.balanceOf(address(atk)), 1_000e6, "refunded exactly once");
        assertEq(rt.balanceOf(address(re)), 0);
    }

    function test_Reentrancy_CancelBlocked() public {
        _setupReentrancy();
        vm.prank(alice);
        uint256 id = re.createDeal(address(atk), AMOUNT, _deadline(), TITLE);
        atk.setPayload(abi.encodeCall(ZeusEscrow.cancel, (id)), id);
        rt.arm(address(atk));
        atk.cancel(id);

        assertFalse(atk.ok());
        assertEq(atk.errSelector(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(atk.seenStatus(), uint8(ZeusEscrow.Status.Cancelled));
        assertEq(rt.balanceOf(alice), 1_000e6);
        assertEq(rt.balanceOf(address(re)), 0);
    }

    function test_Reentrancy_CreateDuringReleaseBlocked() public {
        _setupReentrancy();
        uint256 id = atk.create(bob, AMOUNT, _deadline(), TITLE);
        atk.setPayload(abi.encodeCall(ZeusEscrow.createDeal, (bob, 1e6, _deadline(), "re")), id);
        rt.arm(address(atk));
        atk.release(id);
        assertFalse(atk.ok());
        assertEq(atk.errSelector(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(re.nextDealId(), 2, "no deal created via re-entry");
    }

    function test_Reentrancy_CreateDuringDepositBlocked() public {
        _setupReentrancy();
        atk.setPayload(abi.encodeCall(ZeusEscrow.createDeal, (bob, 1e6, _deadline(), "re")), 1);
        rt.arm(address(atk));
        uint256 id = atk.create(bob, AMOUNT, _deadline(), TITLE);
        assertEq(id, 1);
        assertEq(atk.calls(), 1);
        assertFalse(atk.ok());
        assertEq(atk.errSelector(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(re.nextDealId(), 2);
        assertEq(rt.balanceOf(address(re)), AMOUNT);
    }

    function test_Reentrancy_GuardResetsAfterCall() public {
        _setupReentrancy();
        uint256 id = atk.create(bob, AMOUNT, _deadline(), TITLE);
        atk.setPayload(abi.encodeCall(ZeusEscrow.release, (id)), id);
        rt.arm(address(atk));
        atk.release(id);

        assertEq(atk.create(bob, 1e6, _deadline(), "next"), 2);
    }

    function testFuzz_CreateAndRelease(uint256 amount, uint64 offset) public {
        amount = bound(amount, 1, 1e30);
        offset = uint64(bound(offset, 1, 3650 days));
        usdc.mint(alice, amount);
        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        uint256 id = esc.createDeal(bob, amount, T0 + offset, TITLE);
        assertEq(usdc.balanceOf(alice), aliceBefore - amount);
        assertEq(usdc.balanceOf(address(esc)), amount);

        vm.prank(alice);
        esc.release(id);
        assertEq(usdc.balanceOf(bob), amount);
        assertEq(usdc.balanceOf(alice), aliceBefore - amount);
        assertEq(usdc.balanceOf(address(esc)), 0);
    }

    function testFuzz_CreateAndCancelAnytime(uint256 amount, uint64 offset, uint64 delta) public {
        amount = bound(amount, 1, 1e30);
        offset = uint64(bound(offset, 1, 3650 days));
        delta = uint64(bound(delta, 0, 7300 days));
        usdc.mint(alice, amount);
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        uint256 id = esc.createDeal(bob, amount, T0 + offset, TITLE);
        vm.warp(T0 + delta);
        vm.prank(bob);
        esc.cancel(id);
        assertEq(usdc.balanceOf(alice), aliceBefore);
        assertEq(usdc.balanceOf(bob), 0);
        assertEq(usdc.balanceOf(address(esc)), 0);
    }

    function testFuzz_RefundOnlyStrictlyAfterDeadline(uint64 offset, uint64 delta) public {
        offset = uint64(bound(offset, 1, 3650 days));
        delta = uint64(bound(delta, 0, 7300 days));
        vm.prank(alice);
        uint256 id = esc.createDeal(bob, AMOUNT, T0 + offset, TITLE);
        vm.warp(T0 + delta);
        vm.prank(alice);
        if (delta > offset) {
            esc.refund(id);
            assertEq(usdc.balanceOf(alice), 1_000e6);
            assertEq(uint256(_status(id)), uint256(ZeusEscrow.Status.Refunded));
        } else {
            vm.expectRevert(ZeusEscrow.DeadlineNotPassed.selector);
            esc.refund(id);
            assertEq(usdc.balanceOf(address(esc)), AMOUNT);
        }
    }

    function testFuzz_CreateDeadlineBoundary(uint64 deadline) public {
        vm.prank(alice);
        if (deadline <= T0) {
            vm.expectRevert(ZeusEscrow.InvalidDeadline.selector);
            esc.createDeal(bob, AMOUNT, deadline, TITLE);
        } else {
            uint256 id = esc.createDeal(bob, AMOUNT, deadline, TITLE);
            assertEq(esc.getDeal(id).deadline, deadline);
        }
    }

    function testFuzz_TitleLength(uint256 len) public {
        len = bound(len, 0, 300);
        string memory t = _bytesOfLen(len);
        vm.prank(alice);
        if (len == 0 || len > 140) {
            vm.expectRevert(ZeusEscrow.InvalidTitle.selector);
            esc.createDeal(bob, AMOUNT, _deadline(), t);
        } else {
            uint256 id = esc.createDeal(bob, AMOUNT, _deadline(), t);
            assertEq(bytes(esc.getDeal(id).title).length, len);
        }
    }

    function testFuzz_AnyFeeIsRejected(uint256 amount, uint256 fee) public {
        amount = bound(amount, 1, 1e30);
        fee = bound(fee, 1, amount);
        OddToken odd = new OddToken();
        ZeusEscrow e = new ZeusEscrow(address(odd));
        odd.mint(alice, amount);
        odd.setFee(fee);
        vm.startPrank(alice);
        odd.approve(address(e), type(uint256).max);
        vm.expectRevert(ZeusEscrow.IncorrectDepositAmount.selector);
        e.createDeal(bob, amount, _deadline(), TITLE);
        vm.stopPrank();
        assertEq(e.nextDealId(), 1);
        assertEq(odd.balanceOf(alice), amount);
    }
}
