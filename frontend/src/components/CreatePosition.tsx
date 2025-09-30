import { useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { walletService, parseEther } from '../lib/ethers';
import { useNavigate } from 'react-router-dom';

interface CreatePositionProps {
  session: Session;
}

export default function CreatePosition({ session }: CreatePositionProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    token: '',
    amount: '',
    threshold: '',
    actionType: 'rebalance' as 'partial_unwind' | 'rebalance' | 'hedge',
    gasBudget: '0.1',
  });
  const [txHash, setTxHash] = useState<string>('');
  const [positionId, setPositionId] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTxHash('');
    setPositionId('');

    try {
      if (!walletService.signer) {
        throw new Error('Please connect your wallet first');
      }

      // Validate form
      if (!formData.token || !formData.amount || !formData.threshold) {
        throw new Error('Please fill in all fields');
      }

      // Get contract
      const originContract = walletService.getOriginPositionContract();
      const chainId = await walletService.getChainId();

      // Create position on-chain
      console.log('Creating position on-chain...');
      const tx = await originContract.createPosition(
        formData.token,
        parseEther(formData.amount),
        parseEther(formData.threshold),
        formData.actionType,
        parseEther(formData.gasBudget)
      );

      console.log('Transaction sent:', tx.hash);
      setTxHash(tx.hash);

      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);

      // Parse event to get position ID
      const event = receipt.logs.find((log: any) => {
        try {
          return originContract.interface.parseLog(log)?.name === 'PositionCreated';
        } catch {
          return false;
        }
      });

      let onChainPositionId = '1'; // Default
      if (event) {
        const parsed = originContract.interface.parseLog(event);
        if (parsed && parsed.args) {
          onChainPositionId = parsed.args[0].toString();
        }
      }

      // Store in Supabase
      const { data, error } = await supabase
        .from('positions')
        .insert({
          user_id: session.user.id,
          origin_chain_id: chainId,
          origin_contract: await originContract.getAddress(),
          origin_token: formData.token,
          position_identifier: onChainPositionId,
          threshold: parseFloat(formData.threshold),
          action_type: formData.actionType,
          gas_budget: BigInt(parseEther(formData.gasBudget).toString()),
          active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setPositionId(data.id);

      // Log the transaction
      await supabase.from('reactive_logs').insert({
        position_id: data.id,
        origin_tx_hash: tx.hash,
        status: 'success',
        payload: {
          action: 'create_position',
          onChainPositionId,
          formData,
        },
      });

      alert('Position created successfully!');
      navigate('/');
    } catch (error: any) {
      console.error('Error creating position:', error);
      alert(`Error: ${error.message || 'Failed to create position'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Create New Position</h1>

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="label">Token Address</label>
            <input
              type="text"
              className="input"
              placeholder="0x..."
              value={formData.token}
              onChange={(e) => setFormData({ ...formData, token: e.target.value })}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Address of the token you want to monitor
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Position Amount</label>
              <input
                type="number"
                step="0.000001"
                className="input"
                placeholder="100"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
              <p className="text-xs text-gray-500 mt-1">In token units</p>
            </div>

            <div>
              <label className="label">Threshold (Trigger Point)</label>
              <input
                type="number"
                step="0.000001"
                className="input"
                placeholder="90"
                value={formData.threshold}
                onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
                required
              />
              <p className="text-xs text-gray-500 mt-1">When to trigger action</p>
            </div>
          </div>

          <div>
            <label className="label">Action Type</label>
            <select
              className="input"
              value={formData.actionType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  actionType: e.target.value as typeof formData.actionType,
                })
              }
            >
              <option value="rebalance">Rebalance</option>
              <option value="hedge">Hedge</option>
              <option value="partial_unwind">Partial Unwind</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Type of reactive action to execute
            </p>
          </div>

          <div>
            <label className="label">Gas Budget (REACT)</label>
            <input
              type="number"
              step="0.01"
              className="input"
              placeholder="0.1"
              value={formData.gasBudget}
              onChange={(e) => setFormData({ ...formData, gasBudget: e.target.value })}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Gas budget for reactive callbacks
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">How it works:</h3>
            <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
              <li>Position is created on-chain and monitored by ReactiveManager</li>
              <li>When threshold is breached, reactive contract automatically triggers</li>
              <li>Destination handler executes the selected action type</li>
              <li>All events are logged to Supabase for tracking</li>
            </ol>
          </div>

          {txHash && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-medium text-green-900">Transaction Submitted!</p>
              <p className="text-xs font-mono text-green-700 mt-1 break-all">
                Tx: {txHash}
              </p>
            </div>
          )}

          {positionId && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-medium text-green-900">Position Created!</p>
              <p className="text-xs font-mono text-green-700 mt-1">
                Position ID: {positionId}
              </p>
            </div>
          )}

          <div className="flex space-x-4">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex-1"
            >
              {loading ? 'Creating...' : 'Create Position'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}