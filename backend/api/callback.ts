import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Serverless function to handle reactive callbacks
 * This validates incoming callbacks from the Reactive Network and logs them to Supabase
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      positionId, 
      owner, 
      currentValue, 
      threshold, 
      reactiveTxHash, 
      signature,
      chainId 
    } = req.body;

    // Validate required fields
    if (!positionId || !owner || !currentValue || !threshold) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify signature (in production)
    // This ensures the callback came from an authorized source
    if (signature) {
      const message = ethers.solidityPackedKeccak256(
        ['uint256', 'address', 'uint256', 'uint256'],
        [positionId, owner, currentValue, threshold]
      );

      try {
        const recoveredAddress = ethers.verifyMessage(
          ethers.getBytes(message),
          signature
        );

        // In production, verify this is a known/authorized address
        console.log('Callback verified from:', recoveredAddress);
      } catch (error) {
        console.error('Signature verification failed:', error);
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Initialize Supabase client with service role key (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the position in the database
    const { data: positions, error: positionError } = await supabase
      .from('positions')
      .select('*')
      .eq('position_identifier', positionId.toString())
      .single();

    if (positionError || !positions) {
      console.error('Position not found:', positionError);
      return res.status(404).json({ error: 'Position not found' });
    }

    // Log the reactive execution
    const { data: logData, error: logError } = await supabase
      .from('reactive_logs')
      .insert({
        position_id: positions.id,
        reactive_tx_hash: reactiveTxHash || null,
        status: 'success',
        payload: {
          positionId,
          owner,
          currentValue: currentValue.toString(),
          threshold: threshold.toString(),
          chainId,
          timestamp: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to log callback:', logError);
      return res.status(500).json({ error: 'Failed to log callback' });
    }

    // Create position event
    await supabase
      .from('position_events')
      .insert({
        position_id: positions.id,
        event_type: 'triggered',
        current_value: parseFloat(currentValue.toString()),
        threshold_breached: true,
        metadata: {
          reactiveTxHash,
          owner,
          chainId,
        },
      });

    // Update analytics
    await supabase.rpc('increment', {
      row_id: 'total_reactive_executions',
      table_name: 'analytics',
    }).catch(console.error);

    return res.status(200).json({
      success: true,
      message: 'Callback processed successfully',
      logId: logData.id,
    });
  } catch (error: any) {
    console.error('Error processing callback:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * Health check endpoint
 */
export async function health(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}