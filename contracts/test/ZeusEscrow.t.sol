// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ZeusEscrow} from "../ZeusEscrow.sol";

contract MockUSDC {
    string public name = "Mock USDC";
    string public symbol = "mUSDC";
    uint8 public constant decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    error InsufficientBalance();
    error InsufficientAllowance();

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) public virtual returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public virtual returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a < amount) revert InsufficientAllowance();
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amount;
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) internal virtual {
        if (balanceOf[from] < amount) revert InsufficientBalance();
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

contract OddToken is MockUSDC {
    uint256 public fee;
    uint256 public bonus;

    function setFee(uint256 f) external {
        fee = f;
    }

    function setBonus(uint256 b) external {
        bonus = b;
    }

    function _move(address from, address to, uint256 amount) internal override {
        if (balanceOf[from] < amount) revert InsufficientBalance();
        balanceOf[from] -= amount;
        balanceOf[to] += amount - fee + bonus;
    }
}

abstract contract ZeusEscrowBase is Test {
    MockUSDC internal usdc;
    ZeusEscrow internal esc;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal dave = makeAddr("dave");

    uint256 internal constant AMOUNT = 100e6;
    uint64 internal constant T0 = 1_000_000;
    string internal constant TITLE = "Promo campaign";

    function setUp() public virtual {
        vm.warp(T0);
        usdc = new MockUSDC();
        esc = new ZeusEscrow(address(usdc));
        _fund(alice, 1_000e6);
        _fund(carol, 1_000e6);
    }

    function _fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(esc), type(uint256).max);
    }

    function _deadline() internal pure returns (uint64) {
        return T0 + 7 days;
    }

    function _create() internal returns (uint256 id) {
        vm.prank(alice);
        id = esc.createDeal(bob, AMOUNT, _deadline(), TITLE);
    }

    function _status(uint256 id) internal view returns (ZeusEscrow.Status) {
        return esc.getDeal(id).status;
    }

    function _bytesOfLen(uint256 n) internal pure returns (string memory) {
        return string(new bytes(n));
    }
}

contract ZeusEscrowTest is ZeusEscrowBase {

    function test_Constructor_SetsTokenAndStartsAtOne() public view {
        assertEq(address(esc.usdc()), address(usdc));
        assertEq(esc.nextDealId(), 1);
    }

    function test_Constructor_RevertsOnZeroToken() public {
        vm.expectRevert(ZeusEscrow.ZeroTokenAddress.selector);
        new ZeusEscrow(address(0));
    }

    function test_CreateDeal_HappyPath() public {
        vm.expectEmit(true, true, true, true, address(esc));
        emit ZeusEscrow.DealCreated(1, alice, bob, AMOUNT, _deadline(), TITLE);
        uint256 id = _create();

        assertEq(id, 1);
        assertEq(esc.nextDealId(), 2);
        ZeusEscrow.Deal memory d = esc.getDeal(id);
        assertEq(d.payer, alice);
        assertEq(d.payee, bob);
        assertEq(d.amount, AMOUNT);
        assertEq(d.deadline, _deadline());
        assertEq(d.title, TITLE);
        assertEq(uint256(d.status), uint256(ZeusEscrow.Status.Active));
        assertEq(usdc.balanceOf(alice), 900e6);
        assertEq(usdc.balanceOf(address(esc)), AMOUNT);
        assertEq(usdc.balanceOf(bob), 0);
    }

    function test_CreateDeal_TitleExactly140BytesOk() public {
        vm.prank(alice);
        uint256 id = esc.createDeal(bob, AMOUNT, _deadline(), _bytesOfLen(140));
        assertEq(bytes(esc.getDeal(id).title).length, 140);
    }

    function test_CreateDeal_OneSecondDeadlineOk() public {
        vm.prank(alice);
        uint256 id = esc.createDeal(bob, 1, T0 + 1, "x");
        assertEq(esc.getDeal(id).deadline, T0 + 1);
    }

    function test_CreateDeal_IdsIncrementAcrossPayers() public {
        vm.prank(alice);
        uint256 a = esc.createDeal(bob, AMOUNT, _deadline(), TITLE);
        vm.prank(carol);
        uint256 b = esc.createDeal(dave, 5e6, _deadline(), "second");
        vm.prank(alice);
        uint256 c = esc.createDeal(dave, 7e6, _deadline(), "third");
        assertEq(a, 1);
        assertEq(b, 2);
        assertEq(c, 3);
        assertEq(esc.nextDealId(), 4);
        assertEq(usdc.balanceOf(address(esc)), AMOUNT + 5e6 + 7e6);
    }

    function test_RevertCreate_ZeroPayee() public {
        vm.prank(alice);
        vm.expectRevert(ZeusEscrow.InvalidPayee.selector);
        esc.createDeal(address(0), AMOUNT, _deadline(), TITLE);
    }

    function test_RevertCreate_PayeeIsPayer() public {
        vm.prank(alice);
        vm.expectRevert(ZeusEscrow.InvalidPayee.selector);
        esc.createDeal(alice, AMOUNT, _deadline(), TITLE);
    }

    function test_RevertCreate_ZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(ZeusEscrow.InvalidAmount.selector);
        esc.createDeal(bob, 0, _deadline(), TITLE);
    }

    function test_RevertCreate_DeadlineEqualsNow() public {
        vm.prank(alice);
        vm.expectRevert(ZeusEscrow.InvalidDeadline.selector);
        esc.createDeal(bob, AMOUNT, T0, TITLE);
    }

    function test_RevertCreate_DeadlineInPast() public {
        vm.prank(alice);
        vm.expectRevert(ZeusEscrow.InvalidDeadline.selector);
        esc.createDeal(bob, AMOUNT, T0 - 1, TITLE);
    }

    function test_RevertCreate_DeadlineZero() public {
        vm.prank(alice);
        vm.expectRevert(ZeusEscrow.InvalidDeadline.selector);
        esc.createDeal(bob, AMOUNT, 0, TITLE);
    }

    function test_RevertCreate_EmptyTitle() public {
        vm.prank(alice);
        vm.expectRevert(ZeusEscrow.InvalidTitle.selector);
        esc.createDeal(bob, AMOUNT, _deadline(), "");
    }

    function test_RevertCreate_TitleTooLong() public {
        string memory t = _bytesOfLen(141);
        vm.prank(alice);
        vm.expectRevert(ZeusEscrow.InvalidTitle.selector);
        esc.createDeal(bob, AMOUNT, _deadline(), t);
    }

    function test_RevertCreate_TitleCountsBytesNotChars() public {

        bytes memory b;
        for (uint256 i; i < 71; i++) {
            b = bytes.concat(b, bytes("\xc3\xa9"));
        }
        string memory t = string(b);
        vm.prank(alice);
        vm.expectRevert(ZeusEscrow.InvalidTitle.selector);
        esc.createDeal(bob, AMOUNT, _deadline(), t);
    }

    function test_RevertCreate_NoAllowance() public {
        address eve = makeAddr("eve");
        usdc.mint(eve, AMOUNT);
        vm.prank(eve);
        vm.expectRevert(MockUSDC.InsufficientAllowance.selector);
        esc.createDeal(bob, AMOUNT, _deadline(), TITLE);
    }

    function test_RevertCreate_InsufficientAllowance() public {
        address eve = makeAddr("eve");
        usdc.mint(eve, AMOUNT);
        vm.startPrank(eve);
        usdc.approve(address(esc), AMOUNT - 1);
        vm.expectRevert(MockUSDC.InsufficientAllowance.selector);
        esc.createDeal(bob, AMOUNT, _deadline(), TITLE);
        vm.stopPrank();
    }

    function test_RevertCreate_InsufficientBalance() public {
        vm.prank(alice);
        vm.expectRevert(MockUSDC.InsufficientBalance.selector);
        esc.createDeal(bob, 1_000e6 + 1, _deadline(), TITLE);
    }

    function test_RevertCreate_FeeOnTransferToken() public {
        (OddToken odd, ZeusEscrow e) = _oddEscrow();
        odd.setFee(1);
        vm.prank(alice);
        vm.expectRevert(ZeusEscrow.IncorrectDepositAmount.selector);
        e.createDeal(bob, AMOUNT, _deadline(), TITLE);
        assertEq(e.nextDealId(), 1);
        assertEq(odd.balanceOf(alice), 1_000e6);
    }

    function test_RevertCreate_BonusToken() public {
        (OddToken odd, ZeusEscrow e) = _oddEscrow();
        odd.setBonus(1);
        vm.prank(alice);
        vm.expectRevert(ZeusEscrow.IncorrectDepositAmount.selector);
        e.createDeal(bob, AMOUNT, _deadline(), TITLE);
        assertEq(e.nextDealId(), 1);
    }

    function test_OddTokenWithZeroFeeWorks() public {
        (, ZeusEscrow e) = _oddEscrow();
        vm.prank(alice);
        assertEq(e.createDeal(bob, AMOUNT, _deadline(), TITLE), 1);
    }

    function _oddEscrow() internal returns (OddToken odd, ZeusEscrow e) {
        odd = new OddToken();
        e = new ZeusEscrow(address(odd));
        odd.mint(alice, 1_000e6);
        vm.prank(alice);
        odd.approve(address(e), type(uint256).max);
    }

    function test_GetDeal_UnknownReverts() public {
        vm.expectRevert(abi.encodeWithSelector(ZeusEscrow.UnknownDeal.selector, 0));
        esc.getDeal(0);
        vm.expectRevert(abi.encodeWithSelector(ZeusEscrow.UnknownDeal.selector, 1));
        esc.getDeal(1);
        _create();
        vm.expectRevert(abi.encodeWithSelector(ZeusEscrow.UnknownDeal.selector, 2));
        esc.getDeal(2);
    }

    function test_GetDealIds_ByPayerAndPayee() public {
        vm.startPrank(alice);
        esc.createDeal(bob, 1e6, _deadline(), "a");
        esc.createDeal(dave, 2e6, _deadline(), "b");
        vm.stopPrank();
        vm.prank(carol);
        esc.createDeal(bob, 3e6, _deadline(), "c");

        uint256[] memory p = esc.getDealIdsByPayer(alice);
        assertEq(p.length, 2);
        assertEq(p[0], 1);
        assertEq(p[1], 2);
        uint256[] memory pc = esc.getDealIdsByPayer(carol);
        assertEq(pc.length, 1);
        assertEq(pc[0], 3);

        uint256[] memory b = esc.getDealIdsByPayee(bob);
        assertEq(b.length, 2);
        assertEq(b[0], 1);
        assertEq(b[1], 3);
        uint256[] memory d = esc.getDealIdsByPayee(dave);
        assertEq(d.length, 1);
        assertEq(d[0], 2);
    }

    function test_GetDealIds_EmptyForUnknownAccounts() public view {
        assertEq(esc.getDealIdsByPayer(alice).length, 0);
        assertEq(esc.getDealIdsByPayee(bob).length, 0);
    }

    function test_GetDealIds_IncludeTerminalDeals() public {
        uint256 id = _create();
        vm.prank(alice);
        esc.release(id);
        assertEq(esc.getDealIdsByPayer(alice).length, 1);
        assertEq(esc.getDealIdsByPayee(bob).length, 1);
        assertEq(uint256(_status(id)), uint256(ZeusEscrow.Status.Released));
    }

    function test_FailedCreateDoesNotConsumeId() public {
        vm.prank(alice);
        vm.expectRevert(ZeusEscrow.InvalidAmount.selector);
        esc.createDeal(bob, 0, _deadline(), TITLE);
        assertEq(_create(), 1);
    }
}
