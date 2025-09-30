import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, Database } from '../lib/supabase';
import { Link } from 'react-router-dom';

type Position = Database['public']['Tables']['positions']['Row'];
type ReactiveLog = Database['public']['Tables']['reactive_logs']['Row'];

interface DashboardProps {
  session: Session;
}

export default function Dashboard({ session }: DashboardProps) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [recentLogs, setRecentLogs] = useState<ReactiveLog[]>([]);
  const [stats, setStats] = useState({
    totalPositions: 0,
    activePositions: 0,
    totalGasUsed: 0,
    successfulExecutions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();

    // Set up real-time subscriptions
    const positionsChannel = supabase
      .channel('positions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'positions' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    const logsChannel = supabase
      .channel('logs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactive_logs' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(positionsChannel);
      supabase.removeChannel(logsChannel);
    };
  }, [session]);

  const fetchDashboardData = async () => {
    try {
      // Fetch positions
      const { data: positionsData, error: positionsError } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (positionsError) throw positionsError;
      setPositions(positionsData || []);

      // Fetch recent reactive logs
      const positionIds = positionsData?.map((p) => p.id) || [];
      if (positionIds.length > 0) {
        const { data: logsData, error: logsError } = await supabase
          .from('reactive_logs')
          .select('*')
          .in('position_id', positionIds)
          .order('created_at', { ascending: false })
          .limit(5);

        if (logsError) throw logsError;
        setRecentLogs(logsData || []);

        // Calculate stats
        const totalGas = logsData?.reduce((sum, log) => sum + (log.gas_used || 0), 0) || 0;
        const successful = logsData?.filter((log) => log.status === 'success').length || 0;

        setStats({
          totalPositions: positionsData?.length || 0,
          activePositions: positionsData?.filter((p) => p.active).length || 0,
          totalGasUsed: totalGas,
          successfulExecutions: successful,
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <Link to="/create" className="btn btn-primary">
          + Create Position
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <p className="text-sm text-gray-600">Total Positions</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalPositions}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Active Positions</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{stats.activePositions}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Total REACT Gas Used</p>
          <p className="text-3xl font-bold text-primary-600 mt-2">
            {(stats.totalGasUsed / 1e18).toFixed(6)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Successful Executions</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{stats.successfulExecutions}</p>
        </div>
      </div>

      {/* Positions Table */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Your Positions</h2>
        {positions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No positions yet</p>
            <Link to="/create" className="btn btn-primary">
              Create Your First Position
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Position ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Chain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Token
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Threshold
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {positions.map((position) => (
                  <tr key={position.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {position.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {position.origin_chain_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {position.origin_token ? `${position.origin_token.slice(0, 6)}...${position.origin_token.slice(-4)}` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {position.threshold}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                        {position.action_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          position.active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {position.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Reactive Activity */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Reactive Activity</h2>
        {recentLogs.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No reactive activity yet</p>
        ) : (
          <div className="space-y-4">
            {recentLogs.map((log) => (
              <div key={log.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      Reactive Execution #{log.id.slice(0, 8)}
                    </p>
                    {log.reactive_tx_hash && (
                      <p className="text-xs font-mono text-gray-600 mt-1">
                        Tx: {log.reactive_tx_hash.slice(0, 10)}...{log.reactive_tx_hash.slice(-8)}
                      </p>
                    )}
                    {log.gas_used && (
                      <p className="text-xs text-gray-600 mt-1">
                        Gas Used: {(log.gas_used / 1e9).toFixed(6)} Gwei
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        log.status === 'success'
                          ? 'bg-green-100 text-green-800'
                          : log.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {log.status}
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 text-center">
          <Link to="/activity" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            View All Activity →
          </Link>
        </div>
      </div>
    </div>
  );
}