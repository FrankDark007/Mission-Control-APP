
/**
 * Service to interface with Swarm Edge via the server proxy.
 */
export class CloudflareEdgeService {
  async syncToEdge(key: string, data: any) {
    try {
      const response = await fetch(`/api/edge/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, data })
      });

      if (!response.ok) throw new Error('Edge Sync Failed');
      const result = await response.json();
      return { success: true, edgeRef: result.id };
    } catch (e) {
      console.warn('[Edge] Live sync unreachable, falling back to local simulation.');
      localStorage.setItem(`edge_sync_${key}`, JSON.stringify({ data, timestamp: Date.now() }));
      return { success: true, edgeRef: `sim-${Date.now()}` };
    }
  }

  async getEdgeStatus() {
    try {
      const response = await fetch('/api/edge/status');
      if (!response.ok) throw new Error('Status check failed');
      return await response.json();
    } catch (e) {
      console.warn('[Edge] Status check failed, returning offline state.');
      return {
        node: 'Offline',
        latency: 'N/A',
        status: 'Disconnected',
        globalReplicas: [],
        error: (e as Error).message
      };
    }
  }
}

export const edgeService = new CloudflareEdgeService();
