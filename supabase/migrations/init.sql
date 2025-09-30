-- ============================================================================
-- Reactive CASR Database Schema
-- Cross-Chain Automated Stop-Rebalance System
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Users are handled by Supabase Auth (auth.users table)
-- We'll use auth.uid() for user_id references

-- Positions: user's configured positions / thresholds to be monitored
CREATE TABLE IF NOT EXISTS public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_chain_id bigint NOT NULL,
  origin_contract text NOT NULL,
  origin_token text,
  position_identifier text, -- e.g. LP token id or user tx ref
  threshold numeric NOT NULL, -- decimal threshold (e.g., price)
  action_type text NOT NULL CHECK (action_type IN ('partial_unwind', 'rebalance', 'hedge')),
  gas_budget bigint DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Reactive logs: records of reactive attempts and results
CREATE TABLE IF NOT EXISTS public.reactive_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  reactive_tx_hash text,
  origin_tx_hash text,
  dest_tx_hash text,
  gas_used numeric,
  status text CHECK (status IN ('pending', 'success', 'failed')),
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

-- Position events: track individual events for positions
CREATE TABLE IF NOT EXISTS public.position_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid REFERENCES public.positions(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'created', 'updated', 'closed', 'triggered'
  current_value numeric,
  threshold_breached boolean DEFAULT false,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Analytics/metrics table for tracking system performance
CREATE TABLE IF NOT EXISTS public.analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  metadata jsonb,
  timestamp timestamptz DEFAULT now()
);

-- Contract deployments tracking
CREATE TABLE IF NOT EXISTS public.contract_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_name text NOT NULL,
  contract_address text NOT NULL,
  chain_id bigint NOT NULL,
  deployment_tx_hash text,
  deployer_address text,
  deployed_at timestamptz DEFAULT now(),
  metadata jsonb
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_positions_user ON public.positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_active ON public.positions(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_positions_chain ON public.positions(origin_chain_id);

CREATE INDEX IF NOT EXISTS idx_reactive_logs_position ON public.reactive_logs(position_id);
CREATE INDEX IF NOT EXISTS idx_reactive_logs_status ON public.reactive_logs(status);
CREATE INDEX IF NOT EXISTS idx_reactive_logs_created ON public.reactive_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_position_events_position ON public.position_events(position_id);
CREATE INDEX IF NOT EXISTS idx_position_events_type ON public.position_events(event_type);
CREATE INDEX IF NOT EXISTS idx_position_events_created ON public.position_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contract_deployments_chain ON public.contract_deployments(chain_id);
CREATE INDEX IF NOT EXISTS idx_contract_deployments_name ON public.contract_deployments(contract_name);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactive_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.position_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_deployments ENABLE ROW LEVEL SECURITY;

-- Positions policies
CREATE POLICY "Users can view their own positions"
  ON public.positions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own positions"
  ON public.positions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own positions"
  ON public.positions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own positions"
  ON public.positions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Reactive logs policies (users can view logs for their positions)
CREATE POLICY "Users can view reactive logs for their positions"
  ON public.reactive_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.positions
      WHERE positions.id = reactive_logs.position_id
      AND positions.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert reactive logs"
  ON public.reactive_logs
  FOR INSERT
  WITH CHECK (true);

-- Position events policies
CREATE POLICY "Users can view events for their positions"
  ON public.position_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.positions
      WHERE positions.id = position_events.position_id
      AND positions.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert position events"
  ON public.position_events
  FOR INSERT
  WITH CHECK (true);

-- Analytics policies (public read for demo)
CREATE POLICY "Anyone can view analytics"
  ON public.analytics
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert analytics"
  ON public.analytics
  FOR INSERT
  WITH CHECK (true);

-- Contract deployments policies (public read)
CREATE POLICY "Anyone can view contract deployments"
  ON public.contract_deployments
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert deployments"
  ON public.contract_deployments
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for positions table
CREATE TRIGGER update_positions_updated_at
  BEFORE UPDATE ON public.positions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create position event when position is created
CREATE OR REPLACE FUNCTION public.create_position_created_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.position_events (position_id, event_type, metadata)
  VALUES (NEW.id, 'created', jsonb_build_object(
    'threshold', NEW.threshold,
    'action_type', NEW.action_type,
    'gas_budget', NEW.gas_budget
  ));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for position creation
CREATE TRIGGER on_position_created
  AFTER INSERT ON public.positions
  FOR EACH ROW
  EXECUTE FUNCTION public.create_position_created_event();

-- ============================================================================
-- SEED DATA (System/Demo Data Only - No Mock Users)
-- ============================================================================

-- Insert sample contract deployment records for reference
INSERT INTO public.contract_deployments (contract_name, contract_address, chain_id, deployment_tx_hash, deployer_address, metadata)
VALUES 
  ('OriginPosition', '0x0000000000000000000000000000000000000000', 31337, '0x0', '0x0', '{"note": "Placeholder - update after deployment"}'),
  ('ReactiveManager', '0x0000000000000000000000000000000000000000', 1597, '0x0', '0x0', '{"note": "Placeholder - update after deployment"}'),
  ('DestinationHandler', '0x0000000000000000000000000000000000000000', 31337, '0x0', '0x0', '{"note": "Placeholder - update after deployment"}')
ON CONFLICT DO NOTHING;

-- Insert sample analytics metrics
INSERT INTO public.analytics (metric_name, metric_value, metadata)
VALUES 
  ('total_positions_created', 0, '{"description": "Total number of positions created"}'),
  ('total_reactive_executions', 0, '{"description": "Total number of reactive actions triggered"}'),
  ('total_gas_used', 0, '{"description": "Total REACT gas consumed"}'),
  ('avg_execution_time', 0, '{"description": "Average execution time in seconds"}')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VIEWS (for easier querying)
-- ============================================================================

-- View for active positions with recent events
CREATE OR REPLACE VIEW public.active_positions_with_events AS
SELECT 
  p.*,
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', pe.id,
        'event_type', pe.event_type,
        'current_value', pe.current_value,
        'threshold_breached', pe.threshold_breached,
        'created_at', pe.created_at
      ) ORDER BY pe.created_at DESC
    )
    FROM public.position_events pe
    WHERE pe.position_id = p.id
    LIMIT 10
  ) as recent_events
FROM public.positions p
WHERE p.active = true;

-- View for reactive execution statistics
CREATE OR REPLACE VIEW public.reactive_execution_stats AS
SELECT 
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE status = 'success') as successful_executions,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_executions,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_executions,
  SUM(gas_used) as total_gas_used,
  AVG(gas_used) as avg_gas_used
FROM public.reactive_logs;

-- ============================================================================
-- GRANTS (ensure proper permissions)
-- ============================================================================

-- Grant access to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;

-- Grant access to service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- ============================================================================
-- NOTES FOR SETUP
-- ============================================================================

-- To use this schema:
-- 1. Create a Supabase project at https://supabase.com
-- 2. Run this migration via Supabase Dashboard -> SQL Editor
-- 3. Or use Supabase CLI: supabase db push
-- 4. Create test users via Supabase Auth UI or API
-- 5. Update contract_deployments table after deploying contracts
-- 6. Use Supabase service role key for backend operations

COMMENT ON TABLE public.positions IS 'User positions being monitored for reactive actions';
COMMENT ON TABLE public.reactive_logs IS 'Log of all reactive contract executions and callbacks';
COMMENT ON TABLE public.position_events IS 'Individual events related to positions';
COMMENT ON TABLE public.analytics IS 'System-wide metrics and analytics';
COMMENT ON TABLE public.contract_deployments IS 'Deployed contract addresses and metadata';