// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ZeusEscrow is ReentrancyGuard {

    using SafeERC20 for IERC20;

    enum Status {

        None,

        Active,

        Released,

        Refunded,

        Cancelled
    }

    struct Deal {

        address payer;

        address payee;

        uint256 amount;

        uint64 deadline;

        string title;

        Status status;
    }

    error ZeroTokenAddress();

    error InvalidPayee();

    error InvalidAmount();

    error InvalidDeadline();

    error InvalidTitle();

    error IncorrectDepositAmount();

    error UnknownDeal(uint256 dealId);

    error DealNotActive(uint256 dealId);

    error OnlyPayer();

    error OnlyPayee();

    error DeadlineNotPassed();

    event DealCreated(
        uint256 indexed dealId,
        address indexed payer,
        address indexed payee,
        uint256 amount,
        uint64 deadline,
        string title
    );

    event DealReleased(uint256 indexed dealId, address indexed payer, address indexed payee, uint256 amount);

    event DealRefunded(uint256 indexed dealId, address indexed payer, address indexed payee, uint256 amount);

    event DealCancelled(uint256 indexed dealId, address indexed payee, address indexed payer, uint256 amount);

    IERC20 public immutable usdc;

    uint256 public nextDealId = 1;

    mapping(uint256 => Deal) private _deals;

    mapping(address => uint256[]) private _dealIdsByPayer;

    mapping(address => uint256[]) private _dealIdsByPayee;

    constructor(address usdcAddress) {
        if (usdcAddress == address(0)) revert ZeroTokenAddress();
        usdc = IERC20(usdcAddress);
    }

    function createDeal(address payee, uint256 amount, uint64 deadline, string calldata title)
        external
        nonReentrant
        returns (uint256 dealId)
    {
        if (payee == address(0) || payee == msg.sender) revert InvalidPayee();
        if (amount == 0) revert InvalidAmount();
        if (deadline <= block.timestamp) revert InvalidDeadline();
        uint256 titleLength = bytes(title).length;
        if (titleLength == 0 || titleLength > 140) revert InvalidTitle();

        uint256 balanceBefore = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        uint256 balanceAfter = usdc.balanceOf(address(this));
        if (balanceAfter < balanceBefore || balanceAfter - balanceBefore != amount) {
            revert IncorrectDepositAmount();
        }

        dealId = nextDealId++;
        _deals[dealId] = Deal({
            payer: msg.sender,
            payee: payee,
            amount: amount,
            deadline: deadline,
            title: title,
            status: Status.Active
        });
        _dealIdsByPayer[msg.sender].push(dealId);
        _dealIdsByPayee[payee].push(dealId);

        emit DealCreated(dealId, msg.sender, payee, amount, deadline, title);
    }

    function release(uint256 dealId) external nonReentrant {
        Deal storage deal = _getActiveDeal(dealId);
        if (msg.sender != deal.payer) revert OnlyPayer();

        deal.status = Status.Released;
        usdc.safeTransfer(deal.payee, deal.amount);

        emit DealReleased(dealId, deal.payer, deal.payee, deal.amount);
    }

    function refund(uint256 dealId) external nonReentrant {
        Deal storage deal = _getActiveDeal(dealId);
        if (msg.sender != deal.payer) revert OnlyPayer();
        if (block.timestamp <= deal.deadline) revert DeadlineNotPassed();

        deal.status = Status.Refunded;
        usdc.safeTransfer(deal.payer, deal.amount);

        emit DealRefunded(dealId, deal.payer, deal.payee, deal.amount);
    }

    function cancel(uint256 dealId) external nonReentrant {
        Deal storage deal = _getActiveDeal(dealId);
        if (msg.sender != deal.payee) revert OnlyPayee();

        deal.status = Status.Cancelled;
        usdc.safeTransfer(deal.payer, deal.amount);

        emit DealCancelled(dealId, deal.payee, deal.payer, deal.amount);
    }

    function getDeal(uint256 dealId) external view returns (Deal memory deal) {
        deal = _deals[dealId];
        if (deal.status == Status.None) revert UnknownDeal(dealId);
    }

    function getDealIdsByPayer(address payer) external view returns (uint256[] memory dealIds) {
        return _dealIdsByPayer[payer];
    }

    function getDealIdsByPayee(address payee) external view returns (uint256[] memory dealIds) {
        return _dealIdsByPayee[payee];
    }

    function _getActiveDeal(uint256 dealId) private view returns (Deal storage deal) {
        deal = _deals[dealId];
        if (deal.status == Status.None) revert UnknownDeal(dealId);
        if (deal.status != Status.Active) revert DealNotActive(dealId);
    }
}
