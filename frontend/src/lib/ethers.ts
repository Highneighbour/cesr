import { BrowserProvider, Contract, parseEther, formatEther } from 'ethers';

// Contract ABIs (simplified - include only necessary functions)
export const ORIGIN_POSITION_ABI = [
  "function createPosition(address token, uint256 amount, uint256 threshold, string actionType, uint256 gasBudget) external returns (uint256)",
  "function updatePositionValue(uint256 positionId, uint256 currentValue) external",
  "function getPosition(uint256 positionId) external view returns (tuple(address owner, uint256 chainId, address token, uint256 amount, uint256 threshold, string actionType, uint256 gasBudget, uint256 createdAt, bool active))",
  "function getOwnerPositions(address owner) external view returns (uint256[])",
  "function closePosition(uint256 positionId) external",
  "event PositionCreated(uint256 indexed positionId, address indexed owner, address indexed token, uint256 amount, uint256 threshold, string actionType, uint256 gasBudget)",
  "event PositionUpdate(uint256 indexed positionId, address indexed owner, uint256 currentValue, uint256 threshold, bool shouldTrigger)",
  "event PositionClosed(uint256 indexed positionId, address indexed owner)"
];

export const REACTIVE_MANAGER_ABI = [
  "function executionCounter() external view returns (uint256)",
  "function getExecution(uint256 executionId) external view returns (tuple(uint256 positionId, uint256 timestamp, uint256 gasUsed, bool success, bytes payload))",
  "function processedPositions(uint256 positionId) external view returns (bool)",
  "function registerPositionSubscriptions() external",
  "event ReactiveActionTriggered(uint256 indexed executionId, uint256 indexed positionId, address indexed owner, uint256 currentValue, uint256 threshold, bytes payload)",
  "event Callback(uint256 indexed chain_id, address indexed _contract, uint64 gas_limit, bytes payload)"
];

export const DESTINATION_HANDLER_ABI = [
  "function executionCounter() external view returns (uint256)",
  "function getExecution(uint256 executionId) external view returns (tuple(uint256 positionId, address owner, uint256 executedValue, uint256 threshold, uint256 timestamp, string actionType, bool success))",
  "function executeRebalance(uint256 positionId, address owner, uint256 currentValue, uint256 threshold) external returns (bool)",
  "event RebalanceExecuted(uint256 indexed executionId, uint256 indexed positionId, address indexed owner, uint256 executedValue, uint256 threshold, bool success)"
];

// Contract addresses from env
export const ORIGIN_POSITION_ADDRESS = import.meta.env.VITE_ORIGIN_POSITION_ADDRESS || '0x0000000000000000000000000000000000000000';
export const REACTIVE_MANAGER_ADDRESS = import.meta.env.VITE_REACTIVE_MANAGER_ADDRESS || '0x0000000000000000000000000000000000000000';
export const DESTINATION_HANDLER_ADDRESS = import.meta.env.VITE_DESTINATION_HANDLER_ADDRESS || '0x0000000000000000000000000000000000000000';

// Chain configurations
export const REACTIVE_MAINNET = {
  chainId: '0x63d', // 1597
  chainName: 'Reactive Mainnet',
  rpcUrls: ['https://kopli-rpc.rkt.ink'],
  nativeCurrency: {
    name: 'REACT',
    symbol: 'REACT',
    decimals: 18,
  },
  blockExplorerUrls: ['https://kopli.reactscan.net/'],
};

export const LASNA_TESTNET = {
  chainId: '0x34860e', // 3441006
  chainName: 'Lasna Testnet',
  rpcUrls: ['https://lasna-rpc.rkt.ink'],
  nativeCurrency: {
    name: 'REACT',
    symbol: 'REACT',
    decimals: 18,
  },
  blockExplorerUrls: ['https://lasna.reactscan.net/'],
};

export class WalletService {
  provider: BrowserProvider | null = null;
  signer: any = null;

  async connect(): Promise<string> {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed');
    }

    this.provider = new BrowserProvider(window.ethereum);
    const accounts = await this.provider.send('eth_requestAccounts', []);
    this.signer = await this.provider.getSigner();
    return accounts[0];
  }

  async switchToReactiveMainnet() {
    if (!window.ethereum) throw new Error('MetaMask not installed');

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: REACTIVE_MAINNET.chainId }],
      });
    } catch (error: any) {
      // Chain not added, add it
      if (error.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [REACTIVE_MAINNET],
        });
      } else {
        throw error;
      }
    }
  }

  async switchToLasnaTestnet() {
    if (!window.ethereum) throw new Error('MetaMask not installed');

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: LASNA_TESTNET.chainId }],
      });
    } catch (error: any) {
      if (error.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [LASNA_TESTNET],
        });
      } else {
        throw error;
      }
    }
  }

  async getChainId(): Promise<number> {
    if (!this.provider) throw new Error('Provider not initialized');
    const network = await this.provider.getNetwork();
    return Number(network.chainId);
  }

  async getBalance(address: string): Promise<string> {
    if (!this.provider) throw new Error('Provider not initialized');
    const balance = await this.provider.getBalance(address);
    return formatEther(balance);
  }

  getOriginPositionContract() {
    if (!this.signer) throw new Error('Signer not initialized');
    return new Contract(ORIGIN_POSITION_ADDRESS, ORIGIN_POSITION_ABI, this.signer);
  }

  getReactiveManagerContract() {
    if (!this.signer) throw new Error('Signer not initialized');
    return new Contract(REACTIVE_MANAGER_ADDRESS, REACTIVE_MANAGER_ABI, this.signer);
  }

  getDestinationHandlerContract() {
    if (!this.signer) throw new Error('Signer not initialized');
    return new Contract(DESTINATION_HANDLER_ADDRESS, DESTINATION_HANDLER_ABI, this.signer);
  }
}

export const walletService = new WalletService();

// Helper functions
export { parseEther, formatEther };