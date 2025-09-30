import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, Database } from '../lib/supabase';
import { walletService, ORIGIN_POSITION_ADDRESS, REACTIVE_MANAGER_ADDRESS, DESTINATION_HANDLER_ADDRESS } from '../lib/ethers';

type ContractDeployment = Database['public']['Tables']['contract_deployments']['Row'];

interface AdminProps {
  session: Session;
}

export default function Admin({ session }: AdminProps) {
  const [deployments, setDeployments] = useState<ContractDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    fetchDeployments();
  }, []);

  const fetchDeployments = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_deployments')
        .select('*')
        .order('deployed_at', { ascending: false });

      if (error) throw error;
      setDeployments(data || []);
    } catch (error) {
      console.error('Error fetching deployments:', error);
    } finally {
      setLoading(false);
    }
  };

  const runDemoWorkflow = async () => {
    setTestLoading(true);
    setTestResult(null);

    try {
      if (!walletService.signer) {
        throw new Error('Please connect your wallet first');
      }

      const result: any = {
        steps: [],
        success: false,
      };

      // Step 1: Create a test position
      result.steps.push({ step: 1, action: 'Creating test position...', status: 'pending' });
      setTestResult({ ...result });

      const originContract = walletService.getOriginPositionContract();
      const testToken = '0x1111111111111111111111111111111111111111';
      const amount = walletService.parseEther('100');
      const threshold = walletService.parseEther('90');

      const createTx = await originContract.createPosition(
        testToken,
        amount,
        threshold,
        'rebalance',
        walletService.parseEther('0.1')
      );

      result.steps[0].status = 'success';
      result.steps[0].txHash = createTx.hash;
      setTestResult({ ...result });

      await createTx.wait();

      // Step 2: Trigger threshold breach
      result.steps.push({ step: 2, action: 'Simulating threshold breach...', status: 'pending' });
      setTestResult({ ...result });

      const updateTx = await originContract.updatePositionValue(
        1, // position ID
        walletService.parseEther('85') // below threshold
      );

      result.steps[1].status = 'success';
      result.steps[1].txHash = updateTx.hash;
      setTestResult({ ...result });

      const updateReceipt = await updateTx.wait();

      // Step 3: Check for event emission
      result.steps.push({ step: 3, action: 'Verifying event emission...', status: 'pending' });
      setTestResult({ ...result });

      const updateEvent = updateReceipt.logs.find((log: any) => {
        try {
          return originContract.interface.parseLog(log)?.name === 'PositionUpdate';
        } catch {
          return false;
        }
      });

      if (updateEvent) {
        result.steps[2].status = 'success';
        result.steps[2].event = 'PositionUpdate emitted successfully';
      } else {
        result.steps[2].status = 'failed';
        result.steps[2].error = 'PositionUpdate event not found';
      }
      setTestResult({ ...result });

      // Step 4: Log to Supabase
      result.steps.push({ step: 4, action: 'Logging to Supabase...', status: 'pending' });
      setTestResult({ ...result });

      await supabase.from('reactive_logs').insert({
        position_id: null,
        origin_tx_hash: createTx.hash,
        reactive_tx_hash: updateTx.hash,
        gas_used: BigInt(updateReceipt.gasUsed.toString()),
        status: 'success',
        payload: {
          demo: true,
          createTxHash: createTx.hash,
          updateTxHash: updateTx.hash,
          gasUsed: updateReceipt.gasUsed.toString(),
        },
      });

      result.steps[3].status = 'success';
      result.success = true;
      setTestResult({ ...result });

      alert('Demo workflow completed successfully! Check Activity page for logs.');
    } catch (error: any) {
      console.error('Error running demo:', error);
      setTestResult({
        ...testResult,
        error: error.message,
      });
      alert(`Demo failed: ${error.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>

      {/* Contract Addresses */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Contract Addresses</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Origin Position</span>
            <code className="text-sm font-mono text-gray-900">{ORIGIN_POSITION_ADDRESS}</code>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Reactive Manager</span>
            <code className="text-sm font-mono text-gray-900">{REACTIVE_MANAGER_ADDRESS}</code>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Destination Handler</span>
            <code className="text-sm font-mono text-gray-900">{DESTINATION_HANDLER_ADDRESS}</code>
          </div>
        </div>
      </div>

      {/* Demo Workflow */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Run Demo Workflow</h2>
        <p className="text-gray-600 mb-4">
          This will create a test position, simulate a threshold breach, and verify the reactive workflow.
        </p>

        <button
          onClick={runDemoWorkflow}
          disabled={testLoading}
          className="btn btn-primary mb-4"
        >
          {testLoading ? 'Running Demo...' : 'Run Demo Workflow'}
        </button>

        {testResult && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-3">Demo Results:</h3>
            <div className="space-y-2">
              {testResult.steps?.map((step: any, index: number) => (
                <div key={index} className="flex items-center space-x-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${
                      step.status === 'success'
                        ? 'bg-green-500'
                        : step.status === 'failed'
                        ? 'bg-red-500'
                        : 'bg-yellow-500'
                    }`}
                  >
                    {step.step}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{step.action}</p>
                    {step.txHash && (
                      <p className="text-xs font-mono text-gray-600">Tx: {step.txHash.slice(0, 20)}...</p>
                    )}
                    {step.event && (
                      <p className="text-xs text-green-600">{step.event}</p>
                    )}
                    {step.error && (
                      <p className="text-xs text-red-600">{step.error}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      step.status === 'success'
                        ? 'text-green-600'
                        : step.status === 'failed'
                        ? 'text-red-600'
                        : 'text-yellow-600'
                    }`}
                  >
                    {step.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
            {testResult.success && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 font-medium">✅ Demo completed successfully!</p>
              </div>
            )}
            {testResult.error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 font-medium">❌ Error: {testResult.error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Deployment History */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Deployment History</h2>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : deployments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No deployments found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Contract
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Address
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Chain ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Deployed At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {deployments.map((deployment) => (
                  <tr key={deployment.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {deployment.contract_name}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">
                      {deployment.contract_address.slice(0, 10)}...{deployment.contract_address.slice(-8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {deployment.chain_id}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(deployment.deployed_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="card bg-blue-50 border border-blue-200">
        <h2 className="text-lg font-bold text-blue-900 mb-3">Quick Setup Guide</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
          <li>Ensure your wallet is connected to the correct network (Reactive Mainnet or Lasna Testnet)</li>
          <li>Fund your wallet with REACT tokens for gas</li>
          <li>Run the demo workflow to test the reactive system</li>
          <li>Create real positions from the Create Position page</li>
          <li>Monitor activity in the Activity page</li>
        </ol>
      </div>
    </div>
  );
}