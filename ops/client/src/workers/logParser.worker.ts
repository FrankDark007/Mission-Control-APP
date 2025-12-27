
// Web Worker for background log processing and telemetry calculation
self.onmessage = (e: MessageEvent) => {
  const { logs, type, startTime } = e.data;
  const workerStart = performance.now();

  if (type === 'process_logs') {
    // 1. Level Filtering & Transformation
    const processedLogs = logs.map((log: any) => {
      let level = 'INFO';
      const msg = (log.message || '').toLowerCase();
      if (log.type === 'stderr' || msg.includes('error') || msg.includes('fail') || msg.includes('exception')) {
        level = 'ERROR';
      } else if (msg.includes('warn') || msg.includes('timeout') || msg.includes('deprecated')) {
        level = 'WARN';
      }
      return { ...log, level };
    });

    // 2. Message Clustering
    // Group identical consecutive messages from the same agent to prevent UI flooding
    const clusteredLogs = [];
    for (let i = 0; i < processedLogs.length; i++) {
      const current = processedLogs[i];
      const last = clusteredLogs[clusteredLogs.length - 1];

      if (last && last.agentId === current.agentId && last.message === current.message) {
        last.count = (last.count || 1) + 1;
        last.timestamp = current.timestamp; // Update to latest timestamp
      } else {
        clusteredLogs.push({ ...current, count: 1 });
      }
    }

    // 3. Time-to-Verdict Calculation (Heuristic)
    // Measures the latency from log arrival to processing completion
    const workerEnd = performance.now();
    const processingTime = workerEnd - workerStart;
    
    // Total latency since message was emitted (if startTime provided)
    const totalLatency = startTime ? workerEnd - startTime : processingTime;

    self.postMessage({
      type: 'logs_processed',
      logs: clusteredLogs,
      processingTime,
      totalLatency,
      metrics: {
        errorCount: processedLogs.filter((l: any) => l.level === 'ERROR').length,
        totalProcessed: logs.length,
        throughput: (logs.length / (processingTime / 1000)).toFixed(2)
      }
    });
  }
};
