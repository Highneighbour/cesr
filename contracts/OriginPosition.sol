// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title OriginPosition
 * @notice Origin chain contract for managing user positions and emitting events for reactive monitoring
 * @dev Emits events that ReactiveManager subscribes to for threshold-based actions
 */
contract OriginPosition is Ownable, ReentrancyGuard, Pausable {
    
    /// @notice Structure representing a user position
    struct Position {
        address owner;
        uint256 chainId;
        address token;
        uint256 amount;
        uint256 threshold;
        string actionType; // 'partial_unwind' | 'rebalance' | 'hedge'
        uint256 gasBudget;
        uint256 createdAt;
        bool active;
    }
    
    /// @notice Mapping of position ID to Position
    mapping(uint256 => Position) public positions;
    
    /// @notice Counter for position IDs
    uint256 public positionCounter;
    
    /// @notice Mapping of owner to their position IDs
    mapping(address => uint256[]) public ownerPositions;
    
    // Events
    
    /**
     * @notice Emitted when a new position is created
     * @param positionId Unique position identifier
     * @param owner Position owner address
     * @param token Token address
     * @param amount Position amount
     * @param threshold Price/liquidity threshold
     * @param actionType Type of action to execute
     */
    event PositionCreated(
        uint256 indexed positionId,
        address indexed owner,
        address indexed token,
        uint256 amount,
        uint256 threshold,
        string actionType,
        uint256 gasBudget
    );
    
    /**
     * @notice Emitted when position state updates (e.g., price change)
     * @param positionId Position identifier
     * @param currentValue Current position value
     * @param threshold Position threshold
     * @param shouldTrigger Whether threshold breach occurred
     */
    event PositionUpdate(
        uint256 indexed positionId,
        address indexed owner,
        uint256 currentValue,
        uint256 threshold,
        bool shouldTrigger
    );
    
    /**
     * @notice Emitted when a position is closed
     * @param positionId Position identifier
     * @param owner Position owner
     */
    event PositionClosed(
        uint256 indexed positionId,
        address indexed owner
    );
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @notice Create a new position
     * @param _token Token address for the position
     * @param _amount Position amount
     * @param _threshold Threshold that triggers reactive action
     * @param _actionType Type of action ('partial_unwind', 'rebalance', 'hedge')
     * @param _gasBudget Gas budget for reactive callbacks
     */
    function createPosition(
        address _token,
        uint256 _amount,
        uint256 _threshold,
        string memory _actionType,
        uint256 _gasBudget
    ) external whenNotPaused nonReentrant returns (uint256) {
        require(_token != address(0), "Invalid token address");
        require(_amount > 0, "Amount must be positive");
        require(_threshold > 0, "Threshold must be positive");
        require(_gasBudget > 0, "Gas budget must be positive");
        
        positionCounter++;
        uint256 positionId = positionCounter;
        
        positions[positionId] = Position({
            owner: msg.sender,
            chainId: block.chainid,
            token: _token,
            amount: _amount,
            threshold: _threshold,
            actionType: _actionType,
            gasBudget: _gasBudget,
            createdAt: block.timestamp,
            active: true
        });
        
        ownerPositions[msg.sender].push(positionId);
        
        emit PositionCreated(
            positionId,
            msg.sender,
            _token,
            _amount,
            _threshold,
            _actionType,
            _gasBudget
        );
        
        return positionId;
    }
    
    /**
     * @notice Simulate position value update (for demo purposes)
     * @dev In production, this would be called by oracle or price feeds
     * @param _positionId Position identifier
     * @param _currentValue Current value to compare against threshold
     */
    function updatePositionValue(
        uint256 _positionId,
        uint256 _currentValue
    ) external whenNotPaused {
        Position storage position = positions[_positionId];
        require(position.active, "Position not active");
        require(position.owner == msg.sender || owner() == msg.sender, "Not authorized");
        
        bool shouldTrigger = _currentValue <= position.threshold;
        
        emit PositionUpdate(
            _positionId,
            position.owner,
            _currentValue,
            position.threshold,
            shouldTrigger
        );
    }
    
    /**
     * @notice Close a position
     * @param _positionId Position identifier
     */
    function closePosition(uint256 _positionId) external nonReentrant {
        Position storage position = positions[_positionId];
        require(position.active, "Position not active");
        require(position.owner == msg.sender, "Not position owner");
        
        position.active = false;
        
        emit PositionClosed(_positionId, msg.sender);
    }
    
    /**
     * @notice Get position details
     * @param _positionId Position identifier
     */
    function getPosition(uint256 _positionId) external view returns (Position memory) {
        return positions[_positionId];
    }
    
    /**
     * @notice Get all positions for an owner
     * @param _owner Owner address
     */
    function getOwnerPositions(address _owner) external view returns (uint256[] memory) {
        return ownerPositions[_owner];
    }
    
    /**
     * @notice Pause contract (emergency)
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
}