
/**
 * File System Observer API
 * 
 * Real-time monitor for source code directories, creating two-way sync between
 * editor and Mission Control dashboard. Detects file modifications and triggers
 * UI refresh or Self-Healing checks when errors are detected.
 * 
 * Requirements:
 * - File System Access API (window.showDirectoryPicker)
 * - FileSystemObserver API (Chrome 129+, behind flag)
 * - Fallback: Polling-based observation
 */

export interface FileChange {
  path: string;
  type: 'created' | 'modified' | 'deleted' | 'renamed';
  timestamp: number;
  oldPath?: string;  // For renames
}

export interface ObserverOptions {
  recursive?: boolean;
  pollInterval?: number;  // Fallback polling interval in ms
  ignorePatterns?: string[];  // Glob patterns to ignore
}

type FileChangeCallback = (changes: FileChange[]) => void;

export class FileSystemObserverService {
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private observer: any = null;  // Native FileSystemObserver when available
  private pollTimer: number | null = null;
  private fileCache: Map<string, { lastModified: number; size: number }> = new Map();
  private callbacks: Set<FileChangeCallback> = new Set();
  private isObserving: boolean = false;
  private options: ObserverOptions = {
    recursive: true,
    pollInterval: 2000,
    ignorePatterns: ['node_modules', '.git', '*.log', '.DS_Store']
  };

  /**
   * Check if native FileSystemObserver API is available
   */
  static isNativeSupported(): boolean {
    return typeof (window as any).FileSystemObserver !== 'undefined';
  }

  /**
   * Request directory access and begin observation
   */
  async observe(handle?: FileSystemDirectoryHandle, options?: ObserverOptions): Promise<boolean> {
    try {
      // Use provided handle or request new one
      this.directoryHandle = handle || await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });

      if (options) {
        this.options = { ...this.options, ...options };
      }

      // Try native observer first
      if (FileSystemObserverService.isNativeSupported()) {
        return await this.startNativeObserver();
      }

      // Fallback to polling
      return await this.startPollingObserver();
    } catch (e) {
      console.error('[FileSystemObserver] Failed to start observation:', e);
      return false;
    }
  }

  /**
   * Subscribe to file change events
   */
  onChange(callback: FileChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Stop observing file system
   */
  stop(): void {
    this.isObserving = false;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.fileCache.clear();
    console.log('[FileSystemObserver] Observation stopped');
  }

  /**
   * Get current directory handle
   */
  getDirectoryHandle(): FileSystemDirectoryHandle | null {
    return this.directoryHandle;
  }

  /**
   * Check if currently observing
   */
  getIsObserving(): boolean {
    return this.isObserving;
  }

  /**
   * Manually trigger a scan (useful for initial state)
   */
  async scan(): Promise<Map<string, { lastModified: number; size: number }>> {
    if (!this.directoryHandle) {
      throw new Error('No directory handle available');
    }

    const files = new Map<string, { lastModified: number; size: number }>();
    await this.scanDirectory(this.directoryHandle, '', files);
    return files;
  }

  // --- Private Methods ---

  private async startNativeObserver(): Promise<boolean> {
    if (!this.directoryHandle) return false;

    try {
      const FSObserver = (window as any).FileSystemObserver;
      this.observer = new FSObserver((records: any[]) => {
        const changes: FileChange[] = records.map(record => ({
          path: record.changedHandle?.name || record.relativePathComponents?.join('/') || 'unknown',
          type: this.mapRecordType(record.type),
          timestamp: Date.now(),
          oldPath: record.relativePathMovedFrom?.join('/')
        }));

        this.notifyCallbacks(changes);
      });

      await this.observer.observe(this.directoryHandle, { recursive: this.options.recursive });
      this.isObserving = true;
      console.log('[FileSystemObserver] Native observation started');
      return true;
    } catch (e) {
      console.warn('[FileSystemObserver] Native observer failed, falling back to polling:', e);
      return await this.startPollingObserver();
    }
  }

  private async startPollingObserver(): Promise<boolean> {
    if (!this.directoryHandle) return false;

    // Build initial cache
    await this.scanDirectory(this.directoryHandle, '', this.fileCache);
    
    this.pollTimer = window.setInterval(async () => {
      const newCache = new Map<string, { lastModified: number; size: number }>();
      await this.scanDirectory(this.directoryHandle!, '', newCache);

      const changes = this.diffCaches(this.fileCache, newCache);
      if (changes.length > 0) {
        this.notifyCallbacks(changes);
      }

      this.fileCache = newCache;
    }, this.options.pollInterval);

    this.isObserving = true;
    console.log('[FileSystemObserver] Polling observation started');
    return true;
  }

  private async scanDirectory(
    dirHandle: FileSystemDirectoryHandle,
    basePath: string,
    cache: Map<string, { lastModified: number; size: number }>
  ): Promise<void> {
    try {
      for await (const [name, handle] of (dirHandle as any).entries()) {
        const path = basePath ? `${basePath}/${name}` : name;

        // Check ignore patterns
        if (this.shouldIgnore(path)) continue;

        if (handle.kind === 'file') {
          try {
            const file = await (handle as FileSystemFileHandle).getFile();
            cache.set(path, {
              lastModified: file.lastModified,
              size: file.size
            });
          } catch (e) {
            // File may be locked or inaccessible
          }
        } else if (handle.kind === 'directory' && this.options.recursive) {
          await this.scanDirectory(handle as FileSystemDirectoryHandle, path, cache);
        }
      }
    } catch (e) {
      console.warn('[FileSystemObserver] Error scanning directory:', basePath, e);
    }
  }

  private diffCaches(
    oldCache: Map<string, { lastModified: number; size: number }>,
    newCache: Map<string, { lastModified: number; size: number }>
  ): FileChange[] {
    const changes: FileChange[] = [];

    // Check for modified and deleted files
    for (const [path, oldInfo] of oldCache) {
      const newInfo = newCache.get(path);
      if (!newInfo) {
        changes.push({ path, type: 'deleted', timestamp: Date.now() });
      } else if (newInfo.lastModified !== oldInfo.lastModified || newInfo.size !== oldInfo.size) {
        changes.push({ path, type: 'modified', timestamp: Date.now() });
      }
    }

    // Check for new files
    for (const path of newCache.keys()) {
      if (!oldCache.has(path)) {
        changes.push({ path, type: 'created', timestamp: Date.now() });
      }
    }

    return changes;
  }

  private shouldIgnore(path: string): boolean {
    return this.options.ignorePatterns?.some(pattern => {
      if (pattern.startsWith('*')) {
        return path.endsWith(pattern.slice(1));
      }
      return path.includes(pattern);
    }) || false;
  }

  private mapRecordType(type: string): FileChange['type'] {
    switch (type) {
      case 'appeared': return 'created';
      case 'disappeared': return 'deleted';
      case 'modified': return 'modified';
      case 'moved': return 'renamed';
      default: return 'modified';
    }
  }

  private notifyCallbacks(changes: FileChange[]): void {
    const filteredChanges = changes.filter(c => !this.shouldIgnore(c.path));
    if (filteredChanges.length === 0) return;

    for (const callback of this.callbacks) {
      try {
        callback(filteredChanges);
      } catch (e) {
        console.error('[FileSystemObserver] Callback error:', e);
      }
    }
  }
}

export const fileSystemObserver = new FileSystemObserverService();
