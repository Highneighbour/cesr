import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, Database } from '../lib/supabase';

type ReactiveLog = Database['public']['Tables']['reactive_logs']['Row'];

interface ActivityProps {
  session: Session;
}

export default function Activity({ session }: ActivityProps) {
  const [logs, setLogs] = useState<ReactiveLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all');

  useEffect(() => {
    fetchLogs();

    // Real-time subscription
    const channel = supabase
      .channel('reactive-logs-activity')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactive_logs' }, () => {
        fetchLogs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, filter]);

  const fetchLogs = async () => {
    try {
      // Get user's positions
      const { data: positions } = await supabase
        .from('positions')
        .select('id')
        .eq('user_id', session.user.id);

      const positionIds = positions?.map((p) => p.id) || [];

      if (positionIds.length === 0) {
        setLogs([]);
        setLoading(false);
        return;
      }

      // Fetch logs
      let query = supabase
        .from('reactive_logs')
        .select('*')
        .in('position_id', positionIds)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getExplorerLink = (txHash: string, chainId: number = 1597) => {
    if (chainId === 1597) {
      return `https://kopli.reactscan.net/tx/${txHash}`;
    } else if (chainId === 3441006) {
      return `https://lasna.reactscan.net/tx/${txHash}`;
    }
    return '#';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Reactive Activity</h1>

        <div className="flex space-x-2">
          {(['all', 'success', 'failed', 'pending'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                filter === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {logs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No activity logs found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div
                key={log.id}
                className="border border-gray-200 rounded-lg p-6 hover:border-primary-300 transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Reactive Execution
                    </h3>
                    <p className="text-sm font-mono text-gray-500">ID: {log.id.slice(0, 16)}...</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      log.status === 'success'
                        ? 'bg-green-100 text-green-800'
                        : log.status === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {log.status.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  {log.position_id && (
                    <div>
                      <p className="text-xs text-gray-500">Position ID</p>
                      <p className="text-sm font-mono text-gray-900">
                        {log.position_id.slice(0, 12)}...
                      </p>
                    </div>
                  )}

                  {log.gas_used && (
                    <div>
                      <p className="text-xs text-gray-500">Gas Used</p>
                      <p className="text-sm font-semibold text-primary-600">
                        {(log.gas_used / 1e18).toFixed(9)} REACT
                      </p>
                    </div>
                  )}
                </div>

                {/* Transaction Hashes */}
                <div className="space-y-2 border-t border-gray-100 pt-4">
                  {log.origin_tx_hash && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Origin Tx:</span>
                      <a
                        href={getExplorerLink(log.origin_tx_hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-primary-600 hover:text-primary-700"
                      >
                        {log.origin_tx_hash.slice(0, 10)}...{log.origin_tx_hash.slice(-8)} ↗
                      </a>
                    </div>
                  )}

                  {log.reactive_tx_hash && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Reactive Tx:</span>
                      <a
                        href={getExplorerLink(log.reactive_tx_hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-primary-600 hover:text-primary-700"
                      >
                        {log.reactive_tx_hash.slice(0, 10)}...{log.reactive_tx_hash.slice(-8)} ↗
                      </a>
                    </div>
                  )}

                  {log.dest_tx_hash && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Destination Tx:</span>
                      <a
                        href={getExplorerLink(log.dest_tx_hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-primary-600 hover:text-primary-700"
                      >
                        {log.dest_tx_hash.slice(0, 10)}...{log.dest_tx_hash.slice(-8)} ↗
                      </a>
                    </div>
                  )}
                </div>

                {/* Payload */}
                {log.payload && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <details className="cursor-pointer">
                      <summary className="text-xs text-gray-500 hover:text-gray-700">
                        View Payload
                      </summary>
                      <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-x-auto">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}

                <div className="mt-4 text-xs text-gray-400 text-right">
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <p className="text-sm text-gray-600">Total Executions</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{logs.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Total Gas Consumed</p>
          <p className="text-2xl font-bold text-primary-600 mt-2">
            {(logs.reduce((sum, log) => sum + (log.gas_used || 0), 0) / 1e18).toFixed(6)} REACT
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Success Rate</p>
          <p className="text-2xl font-bold text-green-600 mt-2">
            {logs.length > 0
              ? ((logs.filter((l) => l.status === 'success').length / logs.length) * 100).toFixed(1)
              : 0}
            %
          </p>
        </div>
      </div>
    </div>
  );
}