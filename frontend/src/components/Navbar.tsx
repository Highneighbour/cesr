import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { walletService } from '../lib/ethers';

interface NavbarProps {
  session: Session;
}

export default function Navbar({ session }: NavbarProps) {
  const location = useLocation();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<string>('0');
  const [chainId, setChainId] = useState<number | null>(null);

  const isActive = (path: string) => location.pathname === path;

  const connectWallet = async () => {
    try {
      const address = await walletService.connect();
      setWalletAddress(address);
      const balance = await walletService.getBalance(address);
      setWalletBalance(balance);
      const cId = await walletService.getChainId();
      setChainId(cId);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
        } else {
          setWalletAddress(null);
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
  }, []);

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg"></div>
              <span className="font-bold text-xl text-gray-900">Reactive CASR</span>
            </Link>

            <div className="hidden sm:flex space-x-4">
              <Link
                to="/"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/') ? 'bg-primary-100 text-primary-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/create"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/create') ? 'bg-primary-100 text-primary-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Create Position
              </Link>
              <Link
                to="/activity"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/activity') ? 'bg-primary-100 text-primary-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Activity
              </Link>
              <Link
                to="/admin"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/admin') ? 'bg-primary-100 text-primary-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Admin
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {walletAddress ? (
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-xs text-gray-500">
                    Chain: {chainId === 1597 ? 'Reactive' : chainId === 3441006 ? 'Lasna' : chainId}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {parseFloat(walletBalance).toFixed(4)} REACT
                  </p>
                </div>
                <div className="px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg">
                  <p className="text-sm font-mono text-primary-700">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </p>
                </div>
              </div>
            ) : (
              <button onClick={connectWallet} className="btn btn-primary">
                Connect Wallet
              </button>
            )}

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700">{session.user.email}</span>
              <button onClick={handleSignOut} className="btn btn-secondary text-sm">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}