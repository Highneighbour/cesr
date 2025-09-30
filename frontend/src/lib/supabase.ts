import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      positions: {
        Row: {
          id: string;
          user_id: string;
          origin_chain_id: number;
          origin_contract: string;
          origin_token: string | null;
          position_identifier: string | null;
          threshold: number;
          action_type: 'partial_unwind' | 'rebalance' | 'hedge';
          gas_budget: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['positions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['positions']['Insert']>;
      };
      reactive_logs: {
        Row: {
          id: string;
          position_id: string | null;
          reactive_tx_hash: string | null;
          origin_tx_hash: string | null;
          dest_tx_hash: string | null;
          gas_used: number | null;
          status: 'pending' | 'success' | 'failed';
          payload: any;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['reactive_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['reactive_logs']['Insert']>;
      };
      position_events: {
        Row: {
          id: string;
          position_id: string;
          event_type: string;
          current_value: number | null;
          threshold_breached: boolean;
          metadata: any;
          created_at: string;
        };
      };
      contract_deployments: {
        Row: {
          id: string;
          contract_name: string;
          contract_address: string;
          chain_id: number;
          deployment_tx_hash: string | null;
          deployer_address: string | null;
          deployed_at: string;
          metadata: any;
        };
      };
    };
  };
};