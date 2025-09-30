// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./IReactive.sol";

/**
 * @title ReactiveManager
 * @notice Reactive Smart Contract that monitors origin chain events and triggers cross-chain actions
 * @dev Implements IReactive interface for Reactive Network integration
 */
contract ReactiveManager is IReactive, IReactiveCallback, Ownable, Pausable {
    
    /// @notice Reactive Network service address
    address private constant REACTIVE_SERVICE = 0x0000000000000000000000000000000000000000;
    
    /// @notice Origin chain ID
    uint256 public originChainId;
    
    /// @notice Origin contract address (OriginPosition)
    address public originContract;
    
    /// @notice Destination chain ID
    uint256 public destinationChainId;
    
    /// @notice Destination handler contract address
    address public destinationHandler;
    
    /// @notice Event signature hashes for subscriptions
    bytes32 public constant POSITION_CREATED_TOPIC = keccak256("PositionCreated(uint256,address,address,uint256,uint256,string,uint256)");
    bytes32 public constant POSITION_UPDATE_TOPIC = keccak256("PositionUpdate(uint256,address,uint256,uint256,bool)");
    
    /// @notice Mapping to track processed positions
    mapping(uint256 => bool) public processedPositions;
    
    /// @notice Mapping to track reactive executions
    mapping(uint256 => ReactiveExecution) public executions;
    uint256 public executionCounter;
    
    struct ReactiveExecution {
        uint256 positionId;
        uint256 timestamp;
        uint256 gasUsed;
        bool success;
        bytes payload;
    }
    
    // Events
    
    /**
     * @notice Emitted when reactive manager is initialized
     */
    event ReactiveManagerInitialized(
        uint256 originChainId,
        address originContract,
        uint256 destinationChainId,
        address destinationHandler
    );
    
    /**
     * @notice Emitted when subscriptions are registered
     */
    event SubscriptionsRegistered(
        uint256 count
    );
    
    /**
     * @notice Emitted when a reactive action is triggered
     */
    event ReactiveActionTriggered(
        uint256 indexed executionId,
        uint256 indexed positionId,
        address indexed owner,
        uint256 currentValue,
        uint256 threshold,
        bytes payload
    );
    
    /**
     * @notice Emitted when a position is processed
     */
    event PositionProcessed(
        uint256 indexed positionId,
        address indexed owner,
        string actionType
    );
    
    constructor(
        uint256 _originChainId,
        address _originContract,
        uint256 _destinationChainId,
        address _destinationHandler
    ) Ownable(msg.sender) {
        require(_originContract != address(0), "Invalid origin contract");
        require(_destinationHandler != address(0), "Invalid destination handler");
        
        originChainId = _originChainId;
        originContract = _originContract;
        destinationChainId = _destinationChainId;
        destinationHandler = _destinationHandler;
        
        emit ReactiveManagerInitialized(
            _originChainId,
            _originContract,
            _destinationChainId,
            _destinationHandler
        );
    }
    
    /**
     * @notice Subscribe to origin chain events
     * @param subscriptions Array of subscription configurations
     */
    function subscribe(Subscription[] memory subscriptions) external override onlyOwner {
        // Subscription registration is handled by the Reactive Network
        // This function prepares subscriptions for the network
        emit SubscriptionsRegistered(subscriptions.length);
    }
    
    /**
     * @notice Register subscriptions for position events
     * @dev Called after deployment to set up event monitoring
     */
    function registerPositionSubscriptions() external onlyOwner {
        Subscription[] memory subs = new Subscription[](2);
        
        // Subscribe to PositionCreated events
        subs[0] = Subscription({
            chain_id: originChainId,
            _contract: originContract,
            topic_0: uint256(POSITION_CREATED_TOPIC),
            topic_1: 0, // any positionId
            topic_2: 0, // any owner
            topic_3: 0  // any token
        });
        
        // Subscribe to PositionUpdate events
        subs[1] = Subscription({
            chain_id: originChainId,
            _contract: originContract,
            topic_0: uint256(POSITION_UPDATE_TOPIC),
            topic_1: 0, // any positionId
            topic_2: 0, // any owner
            topic_3: 0
        });
        
        this.subscribe(subs);
    }
    
    /**
     * @notice React to incoming events from origin chain
     * @dev Called by Reactive Network when subscribed events occur
     */
    function react(
        uint256 chain_id,
        address _contract,
        uint256 topic_0,
        uint256 topic_1,
        uint256 topic_2,
        uint256 topic_3,
        bytes calldata data,
        uint256 /* origin_vm_index */,
        address /* sender */
    ) external override whenNotPaused {
        // Only allow calls from Reactive Network (in production, verify sender)
        require(chain_id == originChainId, "Invalid chain ID");
        require(_contract == originContract, "Invalid contract");
        
        // Handle PositionUpdate events (threshold breaches)
        if (topic_0 == uint256(POSITION_UPDATE_TOPIC)) {
            _handlePositionUpdate(topic_1, topic_2, data);
        }
        // Handle PositionCreated events (track new positions)
        else if (topic_0 == uint256(POSITION_CREATED_TOPIC)) {
            _handlePositionCreated(topic_1, topic_2, topic_3, data);
        }
    }
    
    /**
     * @notice Handle PositionCreated event
     */
    function _handlePositionCreated(
        uint256 positionId,
        uint256 ownerAddressUint,
        uint256 tokenAddressUint,
        bytes calldata data
    ) internal {
        address owner = address(uint160(ownerAddressUint));
        
        // Decode additional data (amount, threshold, actionType, gasBudget)
        (uint256 amount, uint256 threshold, string memory actionType, uint256 gasBudget) = 
            abi.decode(data, (uint256, uint256, string, uint256));
        
        emit PositionProcessed(positionId, owner, actionType);
    }
    
    /**
     * @notice Handle PositionUpdate event and trigger reactive action
     */
    function _handlePositionUpdate(
        uint256 positionId,
        uint256 ownerAddressUint,
        bytes calldata data
    ) internal {
        address owner = address(uint160(ownerAddressUint));
        
        // Decode event data
        (uint256 currentValue, uint256 threshold, bool shouldTrigger) = 
            abi.decode(data, (uint256, uint256, bool));
        
        // Only trigger if threshold is breached and not already processed
        if (shouldTrigger && !processedPositions[positionId]) {
            processedPositions[positionId] = true;
            
            // Prepare callback payload for destination chain
            bytes memory payload = abi.encodeWithSignature(
                "executeRebalance(uint256,address,uint256,uint256)",
                positionId,
                owner,
                currentValue,
                threshold
            );
            
            // Record execution
            executionCounter++;
            executions[executionCounter] = ReactiveExecution({
                positionId: positionId,
                timestamp: block.timestamp,
                gasUsed: gasleft(),
                success: true,
                payload: payload
            });
            
            emit ReactiveActionTriggered(
                executionCounter,
                positionId,
                owner,
                currentValue,
                threshold,
                payload
            );
            
            // Emit Callback event to trigger destination chain transaction
            emit Callback(
                destinationChainId,
                destinationHandler,
                500000, // gas limit for destination tx
                payload
            );
        }
    }
    
    /**
     * @notice Update destination handler (admin function)
     */
    function updateDestinationHandler(
        uint256 _destinationChainId,
        address _destinationHandler
    ) external onlyOwner {
        require(_destinationHandler != address(0), "Invalid handler");
        destinationChainId = _destinationChainId;
        destinationHandler = _destinationHandler;
    }
    
    /**
     * @notice Reset processed status for a position (for testing)
     */
    function resetPosition(uint256 positionId) external onlyOwner {
        processedPositions[positionId] = false;
    }
    
    /**
     * @notice Pause reactive processing
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Resume reactive processing
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Get execution details
     */
    function getExecution(uint256 executionId) external view returns (ReactiveExecution memory) {
        return executions[executionId];
    }
}