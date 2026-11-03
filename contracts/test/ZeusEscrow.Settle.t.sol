// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {ZeusEscrow} from "../ZeusEscrow.sol";
import {ZeusEscrowBase} from "./ZeusEscrow.t.sol";

contract ZeusEscrowSettleTest is ZeusEscrowBase {
    uint256 internal id;

    function setUp() public override {
        super.setUp();
        id = _create();
    }

    function _notActive() internal view returns (bytes memory) {
        return abi.encodeWithSelector(ZeusEscrow.DealNotActive.selector, id);
    }

    function _release() internal {
        vm.prank(alice);
        esc.release(id);
    }

    function _refund() internal {
        vm.warp(_deadline() + 1);
        vm.prank(alice);
        esc.refund(id);
    }

    function _cancel() internal {
        vm.prank(bob);
        esc.cancel(id);
    }

    function _assertBalances(uint256 a, uint256 b, uint256 e) internal view {
        assertEq(usdc.balanceOf(alice), a, "payer");
        assertEq(usdc.balanceOf(bob), b, "payee");
        assertEq(usdc.balanceOf(address(esc)), e, "escrow");
    }

    function test_Release_HappyPath() public {
        vm.expectEmit(true, true, true, true, address(esc));
        emit ZeusEscrow.DealReleased(id, alice, bob, AMOUNT);
        _release();
        assertEq(uint256(_status(id)), uint256(ZeusEscrow.Status.Released));
        _assertBalances(900e6, AMOUNT, 0);
    }

    function test_Release_WorksAtAndAfterDeadline() public {
        vm.warp(_deadline());
        _release();
        _assertBalances(900e6, AMOUNT, 0);

        vm.warp(_deadline() + 365 days);
        vm.prank(alice);
        id = esc.createDeal(bob, AMOUNT, uint64(block.timestamp + 1 days), TITLE);
        vm.warp(block.timestamp + 2 days);
        _release();
        _assertBalances(800e6, 2 * AMOUNT, 0);
    }

    function test_RevertRelease_NonPayer() public {
        vm.prank(carol);
        vm.expectRevert(ZeusEscrow.OnlyPayer.selector);
        esc.release(id);
    }

    function test_RevertRelease_PayeeCannot() public {
        vm.prank(bob);
        vm.expectRevert(ZeusEscrow.OnlyPayer.selector);
        esc.release(id);
        _assertBalances(900e6, 0, AMOUNT);
    }

    function test_RevertRelease_Unknown() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ZeusEscrow.UnknownDeal.selector, 99));
        esc.release(99);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ZeusEscrow.UnknownDeal.selector, 0));
        esc.release(0);
    }

    function test_RevertRelease_Twice() public {
        _release();
        vm.prank(alice);
        vm.expectRevert(_notActive());
        esc.release(id);
        _assertBalances(900e6, AMOUNT, 0);
    }

    function test_RevertRelease_AfterRefund() public {
        _refund();
        vm.prank(alice);
        vm.expectRevert(_notActive());
        esc.release(id);
    }

    function test_RevertRelease_AfterCancel() public {
        _cancel();
        vm.prank(alice);
        vm.expectRevert(_notActive());
        esc.release(id);
    }

    function test_Refund_HappyPathAtDeadlinePlusOne() public {
        vm.warp(_deadline() + 1);
        vm.expectEmit(true, true, true, true, address(esc));
        emit ZeusEscrow.DealRefunded(id, alice, bob, AMOUNT);
        vm.prank(alice);
        esc.refund(id);
        assertEq(uint256(_status(id)), uint256(ZeusEscrow.Status.Refunded));
        _assertBalances(1_000e6, 0, 0);
    }

    function test_RevertRefund_AtDeadline() public {
        vm.warp(_deadline());
        vm.prank(alice);
        vm.expectRevert(ZeusEscrow.DeadlineNotPassed.selector);
        esc.refund(id);
        _assertBalances(900e6, 0, AMOUNT);
    }

    function test_RevertRefund_BeforeDeadline() public {
        vm.prank(alice);
        vm.expectRevert(ZeusEscrow.DeadlineNotPassed.selector);
        esc.refund(id);
        vm.warp(_deadline() - 1);
        vm.prank(alice);
        vm.expectRevert(ZeusEscrow.DeadlineNotPassed.selector);
        esc.refund(id);
    }

    function test_RevertRefund_NonPayerBeforeAndAfterDeadline() public {
        vm.prank(bob);
        vm.expectRevert(ZeusEscrow.OnlyPayer.selector);
        esc.refund(id);
        vm.warp(_deadline() + 1);
        vm.prank(bob);
        vm.expectRevert(ZeusEscrow.OnlyPayer.selector);
        esc.refund(id);
        vm.prank(carol);
        vm.expectRevert(ZeusEscrow.OnlyPayer.selector);
        esc.refund(id);
        _assertBalances(900e6, 0, AMOUNT);
    }

    function test_RevertRefund_Unknown() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ZeusEscrow.UnknownDeal.selector, 42));
        esc.refund(42);
    }

    function test_RevertRefund_AfterRelease() public {
        _release();
        vm.warp(_deadline() + 1);
        vm.prank(alice);
        vm.expectRevert(_notActive());
        esc.refund(id);
        _assertBalances(900e6, AMOUNT, 0);
    }

    function test_RevertRefund_AfterCancel() public {
        _cancel();
        vm.warp(_deadline() + 1);
        vm.prank(alice);
        vm.expectRevert(_notActive());
        esc.refund(id);
    }

    function test_RevertRefund_Twice() public {
        _refund();
        vm.prank(alice);
        vm.expectRevert(_notActive());
        esc.refund(id);
        _assertBalances(1_000e6, 0, 0);
    }

    function test_Cancel_HappyPathBeforeDeadline() public {
        vm.expectEmit(true, true, true, true, address(esc));
        emit ZeusEscrow.DealCancelled(id, bob, alice, AMOUNT);
        _cancel();
        assertEq(uint256(_status(id)), uint256(ZeusEscrow.Status.Cancelled));
        _assertBalances(1_000e6, 0, 0);
    }

    function test_Cancel_AtAndAfterDeadline() public {
        vm.warp(_deadline());
        _cancel();
        _assertBalances(1_000e6, 0, 0);

        vm.prank(alice);
        id = esc.createDeal(bob, AMOUNT, uint64(block.timestamp + 1 days), TITLE);
        vm.warp(block.timestamp + 30 days);
        _cancel();
        _assertBalances(1_000e6, 0, 0);
    }

    function test_RevertCancel_PayerCannot() public {
        vm.prank(alice);
        vm.expectRevert(ZeusEscrow.OnlyPayee.selector);
        esc.cancel(id);
        vm.warp(_deadline() + 1);
        vm.prank(alice);
        vm.expectRevert(ZeusEscrow.OnlyPayee.selector);
        esc.cancel(id);
        _assertBalances(900e6, 0, AMOUNT);
    }

    function test_RevertCancel_ThirdParty() public {
        vm.prank(carol);
        vm.expectRevert(ZeusEscrow.OnlyPayee.selector);
        esc.cancel(id);
    }

    function test_RevertCancel_Unknown() public {
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(ZeusEscrow.UnknownDeal.selector, 7));
        esc.cancel(7);
    }

    function test_RevertCancel_AfterRelease() public {
        _release();
        vm.prank(bob);
        vm.expectRevert(_notActive());
        esc.cancel(id);
        _assertBalances(900e6, AMOUNT, 0);
    }

    function test_RevertCancel_AfterRefund() public {
        _refund();
        vm.prank(bob);
        vm.expectRevert(_notActive());
        esc.cancel(id);
    }

    function test_RevertCancel_Twice() public {
        _cancel();
        vm.prank(bob);
        vm.expectRevert(_notActive());
        esc.cancel(id);
        _assertBalances(1_000e6, 0, 0);
    }

    function test_TerminalDealReportsNotActiveToAnyCaller() public {
        _release();
        vm.prank(carol);
        vm.expectRevert(_notActive());
        esc.release(id);
        vm.prank(carol);
        vm.expectRevert(_notActive());
        esc.cancel(id);
        vm.warp(_deadline() + 1);
        vm.prank(carol);
        vm.expectRevert(_notActive());
        esc.refund(id);
    }

    function test_SettlingOneDealLeavesOthersActive() public {
        vm.prank(carol);
        uint256 id2 = esc.createDeal(bob, 5e6, _deadline(), "other");
        _release();
        assertEq(uint256(_status(id2)), uint256(ZeusEscrow.Status.Active));
        assertEq(usdc.balanceOf(address(esc)), 5e6);
        vm.prank(bob);
        esc.cancel(id2);
        assertEq(usdc.balanceOf(carol), 1_000e6);
        assertEq(usdc.balanceOf(bob), AMOUNT);
        assertEq(usdc.balanceOf(address(esc)), 0);
    }
}
