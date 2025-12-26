
/**
 * Mission Telemetry Engine using PerformanceObserver.
 * Monitors UX stability and main-thread health.
 */
export class MissionTelemetry {
  private metrics: any[] = [];
  private driftCallback: ((drift: any) => void) | null = null;

  constructor() {
    if (typeof PerformanceObserver !== 'undefined') {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const metric = {
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime,
            type: entry.entryType,
            value: (entry as any).value || 0
          };
          
          this.metrics.push(metric);
          console.debug(`[Telemetry] ${entry.entryType}: ${entry.name} - ${entry.duration.toFixed(2)}ms`);

          // Feature 11: Detect Neural Drift (UX Performance degradation)
          if (entry.entryType === 'longtask' && entry.duration > 150) {
            this.notifyDrift('Critical Main Thread Lag', `Long task detected: ${entry.duration.toFixed(0)}ms`);
          }
          if (entry.entryType === 'layout-shift' && (entry as any).value > 0.1) {
            this.notifyDrift('UX Layout Instability', `Significant CLS spike detected: ${(entry as any).value.toFixed(3)}`);
          }
        }
      });
      observer.observe({ entryTypes: ['measure', 'longtask', 'resource', 'layout-shift'] });
    }
  }

  private notifyDrift(type: string, details: string) {
    if (this.driftCallback) {
      this.driftCallback({ type, details, timestamp: Date.now() });
    }
  }

  onDrift(cb: (drift: any) => void) {
    this.driftCallback = cb;
  }

  startMeasure(name: string) {
    performance.mark(`${name}-start`);
  }

  stopMeasure(name: string) {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
  }

  getMetrics() {
    return this.metrics;
  }
}

export const telemetry = new MissionTelemetry();
