// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IReactive
 * @notice Interface for Reactive Network contracts
 * @dev Based on Reactive Network documentation
 */

struct Subscription {
    uint256 chain_id;
    address _contract;
    uint256 topic_0;
    uint256 topic_1;
    uint256 topic_2;
    uint256 topic_3;
}

struct Event {
    uint256 chain_id;
    address _contract;
    uint256 topic_0;
    uint256 topic_1;
    uint256 topic_2;
    uint256 topic_3;
    bytes data;
}

interface IReactive {
    /**
     * @notice Subscribe to events from origin chains
     * @param subscriptions Array of subscription filters
     */
    function subscribe(Subscription[] memory subscriptions) external;
    
    /**
     * @notice Reactive callback triggered by subscribed events
     * @param chain_id Origin chain ID
     * @param _contract Address of the contract that emitted the event
     * @param topic_0 Event signature hash
     * @param topic_1 First indexed parameter
     * @param topic_2 Second indexed parameter
     * @param topic_3 Third indexed parameter
     * @param data Non-indexed event data
     * @param origin_vm_index VM index in the origin chain
     * @param sender Original sender address
     */
    function react(
        uint256 chain_id,
        address _contract,
        uint256 topic_0,
        uint256 topic_1,
        uint256 topic_2,
        uint256 topic_3,
        bytes calldata data,
        uint256 origin_vm_index,
        address sender
    ) external;
}

interface IReactiveCallback {
    /**
     * @notice Emit callback event to trigger destination chain transaction
     * @param chain_id Destination chain ID
     * @param _contract Destination contract address
     * @param gas_limit Gas limit for destination transaction
     * @param payload ABI-encoded function call data
     */
    event Callback(
        uint256 indexed chain_id,
        address indexed _contract,
        uint64 gas_limit,
        bytes payload
    );
}