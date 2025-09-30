// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title DestinationHandler
 * @notice Destination chain contract that receives and executes reactive callbacks
 * @dev Executes rebalancing, hedging, or unwinding actions triggered by ReactiveManager
 */
contract DestinationHandler is Ownable, ReentrancyGuard, Pausable {
    
    /// @notice Reactive manager address (authorized to trigger actions)
    address public reactiveManager;
    
    /// @notice Reactive Network callback sender
    address private constant REACTIVE_CALLBACK_SENDER = 0x0000000000000000000000000000000000FFFFFF;
    
    /// @notice Mapping of executed rebalances
    mapping(uint256 => RebalanceExecution) public executions;
    uint256 public executionCounter;
    
    struct RebalanceExecution {
        uint256 positionId;
        address owner;
        uint256 executedValue;
        uint256 threshold;
        uint256 timestamp;
        string actionType;
        bool success;
    }
    
    // Events
    
    /**
     * @notice Emitted when destination handler is initialized
     */
    event DestinationHandlerInitialized(address reactiveManager);
    
    /**
     * @notice Emitted when rebalance is executed
     */
    event RebalanceExecuted(
        uint256 indexed executionId,
        uint256 indexed positionId,
        address indexed owner,
        uint256 executedValue,
        uint256 threshold,
        bool success
    );
    
    /**
     * @notice Emitted when hedge trade is executed
     */
    event HedgeExecuted(
        uint256 indexed positionId,
        address indexed owner,
        uint256 amount,
        address token
    );
    
    /**
     * @notice Emitted when position is unwound
     */
    event PositionUnwound(
        uint256 indexed positionId,
        address indexed owner,
        uint256 amount
    );
    
    constructor(address _reactiveManager) Ownable(msg.sender) {
        require(_reactiveManager != address(0), "Invalid reactive manager");
        reactiveManager = _reactiveManager;
        
        emit DestinationHandlerInitialized(_reactiveManager);
    }
    
    /**
     * @notice Execute rebalance action triggered by reactive callback
     * @param positionId Position identifier from origin chain
     * @param owner Position owner address
     * @param currentValue Current position value that breached threshold
     * @param threshold The threshold that was breached
     */
    function executeRebalance(
        uint256 positionId,
        address owner,
        uint256 currentValue,
        uint256 threshold
    ) external whenNotPaused nonReentrant returns (bool) {
        // In production, verify callback came from Reactive Network
        // require(msg.sender == REACTIVE_CALLBACK_SENDER, "Unauthorized");
        
        require(owner != address(0), "Invalid owner");
        
        executionCounter++;
        
        // Execute rebalance logic here
        // In production: interact with DEX, adjust positions, etc.
        bool success = _performRebalance(positionId, owner, currentValue, threshold);
        
        executions[executionCounter] = RebalanceExecution({
            positionId: positionId,
            owner: owner,
            executedValue: currentValue,
            threshold: threshold,
            timestamp: block.timestamp,
            actionType: "rebalance",
            success: success
        });
        
        emit RebalanceExecuted(
            executionCounter,
            positionId,
            owner,
            currentValue,
            threshold,
            success
        );
        
        return success;
    }
    
    /**
     * @notice Internal rebalance logic
     * @dev In production, this would interact with DEXs, lending protocols, etc.
     */
    function _performRebalance(
        uint256 positionId,
        address owner,
        uint256 currentValue,
        uint256 threshold
    ) internal returns (bool) {
        // Simulate rebalance execution
        // Real implementation would:
        // 1. Calculate rebalance amount
        // 2. Execute swaps on DEX
        // 3. Adjust position leverage
        // 4. Return funds to owner if needed
        
        uint256 rebalanceAmount = (threshold - currentValue);
        
        emit HedgeExecuted(positionId, owner, rebalanceAmount, address(0));
        
        return true;
    }
    
    /**
     * @notice Execute hedge trade on destination chain
     * @param positionId Position identifier
     * @param owner Position owner
     * @param amount Amount to hedge
     * @param token Token to hedge with
     */
    function executeHedge(
        uint256 positionId,
        address owner,
        uint256 amount,
        address token
    ) external whenNotPaused nonReentrant returns (bool) {
        require(owner != address(0), "Invalid owner");
        require(amount > 0, "Invalid amount");
        
        // Execute hedge logic
        // In production: interact with derivatives or spot DEX
        
        emit HedgeExecuted(positionId, owner, amount, token);
        
        return true;
    }
    
    /**
     * @notice Execute partial position unwind
     * @param positionId Position identifier
     * @param owner Position owner
     * @param amount Amount to unwind
     */
    function executeUnwind(
        uint256 positionId,
        address owner,
        uint256 amount
    ) external whenNotPaused nonReentrant returns (bool) {
        require(owner != address(0), "Invalid owner");
        require(amount > 0, "Invalid amount");
        
        // Execute unwind logic
        // In production: close positions, return collateral
        
        emit PositionUnwound(positionId, owner, amount);
        
        return true;
    }
    
    /**
     * @notice Update reactive manager address
     */
    function updateReactiveManager(address _reactiveManager) external onlyOwner {
        require(_reactiveManager != address(0), "Invalid manager");
        reactiveManager = _reactiveManager;
    }
    
    /**
     * @notice Get execution details
     */
    function getExecution(uint256 executionId) external view returns (RebalanceExecution memory) {
        return executions[executionId];
    }
    
    /**
     * @notice Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Emergency withdrawal (owner only)
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    /**
     * @notice Receive function to accept ETH
     */
    receive() external payable {}
}