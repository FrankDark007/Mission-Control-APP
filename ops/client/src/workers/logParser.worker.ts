
// Web Worker for background log processing
self.onmessage = (e: MessageEvent) => {
  const { logs, type, councilStartTime, councilEndTime } = e.data;

  if (type === 'process_logs') {
    // 1. Filter by Level and identify types
    const processedLogs = logs.map((log: any) => {
      let level = 'INFO';
      const msg = log.message.toLowerCase();
      if (log.type === 'stderr' || msg.includes('error') || msg.includes('fail')) {
        level = 'ERROR';
      } else if (msg.includes('warn') || msg.includes('timeout')) {
        level = 'WARN';
      }
      return { ...log, level };
    });

    // 2. Simple Clustering (Collapse identical consecutive messages from the same agent)
    const clusteredLogs = [];
    for (let i = 0; i < processedLogs.length; i++) {
      const current = processedLogs[i];
      const last = clusteredLogs[clusteredLogs.length - 1];

      if (last && last.agentId === current.agentId && last.message === current.message) {
        last.count = (last.count || 1) + 1;
        last.timestamp = current.timestamp; // Update to latest
      } else {
        clusteredLogs.push({ ...current, count: 1 });
      }
    }

    // 3. Calculate Time-to-Verdict metrics if applicable
    let timeToVerdict = null;
    if (councilStartTime && councilEndTime) {
      timeToVerdict = new Date(councilEndTime).getTime() - new Date(councilStartTime).getTime();
    }

    self.postMessage({
      type: 'logs_processed',
      logs: clusteredLogs,
      metrics: {
        timeToVerdict,
        errorCount: processedLogs.filter((l: any) => l.level === 'ERROR').length,
        totalProcessed: logs.length
      }
    });
  }
};
