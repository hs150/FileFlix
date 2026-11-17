import { ThumbnailResult } from '../types';

export interface ThumbnailJob {
  pageNumber: number; // 1-based
  priority: number; // 1 = visible / immediate, 0 = prefetch
  resolve: (res: ThumbnailResult) => void;
  reject: (err: Error) => void;
  cancelled: boolean;
  renderTask?: any;
}

export class PDFThumbnailService {
  private pdfjsDoc: any = null;
  private docId: string = '';
  private buffer: ArrayBuffer | null = null;
  private isDestroyed: boolean = false;
  private activeRenders: number = 0;
  private readonly maxConcurrent: number = 2;
  private queue: ThumbnailJob[] = [];
  private cache: Map<number, ThumbnailResult> = new Map();
  private pendingPromises: Map<number, Promise<ThumbnailResult>> = new Map();
  private activeTasks: Map<number, any> = new Map();
  private loadPromise: Promise<number> | null = null;

  constructor(buffer?: ArrayBuffer, docId?: string) {
    if (buffer) {
      this.buffer = buffer;
      this.docId = docId || `doc-${Date.now()}`;
      this.loadPromise = this.loadDocument(buffer, this.docId);
    }
  }

  /**
   * Initializes or re-initializes with a PDF buffer.
   */
  public async loadDocument(buffer: ArrayBuffer, docId?: string): Promise<number> {
    this.destroy();
    this.isDestroyed = false;
    this.buffer = buffer.slice(0);
    this.docId = docId || `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    let pdfjs: any;
    if (typeof window === 'undefined') {
      pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    } else {
      pdfjs = await import('pdfjs-dist');
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      }
    }

    // Always pass an independent slice so web workers cannot detach the parent ArrayBuffer
    const data = new Uint8Array(buffer.slice(0));
    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      isEvalSupported: false,
    });

    const promise = loadingTask.promise.then((doc: any) => {
      this.pdfjsDoc = doc;
      this.processQueue();
      return doc.numPages as number;
    });

    this.loadPromise = promise;
    const numPages = await promise;
    return numPages;
  }

  /**
   * Requests a thumbnail for a 1-based page number.
   * If already cached, resolves immediately.
   * If already queued, adjusts priority.
   */
  public requestThumbnail(pageNumber: number, priority: number = 0): Promise<ThumbnailResult> {
    if (this.isDestroyed) {
      return Promise.reject(new Error('PDFThumbnailService has been destroyed.'));
    }

    // 1. Check in-memory cache
    if (this.cache.has(pageNumber)) {
      return Promise.resolve(this.cache.get(pageNumber)!);
    }

    // 2. Check pending in-flight promise
    if (this.pendingPromises.has(pageNumber)) {
      const existingJob = this.queue.find((j) => j.pageNumber === pageNumber);
      if (existingJob && priority > existingJob.priority) {
        existingJob.priority = priority;
      }
      return this.pendingPromises.get(pageNumber)!;
    }

    // 3. Create a deferred promise and enqueue
    let resolveFn!: (res: ThumbnailResult) => void;
    let rejectFn!: (err: Error) => void;

    const promise = new Promise<ThumbnailResult>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });

    this.pendingPromises.set(pageNumber, promise);

    const job: ThumbnailJob = {
      pageNumber,
      priority,
      resolve: (res) => {
        this.pendingPromises.delete(pageNumber);
        resolveFn(res);
      },
      reject: (err) => {
        this.pendingPromises.delete(pageNumber);
        rejectFn(err);
      },
      cancelled: false,
    };

    this.queue.push(job);
    this.processQueue();

    return promise;
  }

  /**
   * Cancels a pending or active thumbnail render.
   */
  public cancelThumbnail(pageNumber: number): void {
    // If in queue, mark cancelled
    const queuedJob = this.queue.find((j) => j.pageNumber === pageNumber);
    if (queuedJob) {
      queuedJob.cancelled = true;
      this.pendingPromises.delete(pageNumber);
    }

    // If currently rendering, cancel PDF.js render task
    const activeTask = this.activeTasks.get(pageNumber);
    if (activeTask && typeof activeTask.cancel === 'function') {
      try {
        activeTask.cancel();
      } catch {}
      this.activeTasks.delete(pageNumber);
      this.pendingPromises.delete(pageNumber);
    }
  }

  /**
   * Processes the work queue enforcing max concurrency (2).
   */
  private async processQueue(): Promise<void> {
    if (this.isDestroyed) return;

    if (!this.pdfjsDoc) {
      if (this.loadPromise) {
        try {
          await this.loadPromise;
        } catch {
          return;
        }
      }
      if (!this.pdfjsDoc || this.isDestroyed) return;
    }

    while (this.activeRenders < this.maxConcurrent && this.queue.length > 0) {
      // Sort queue by priority descending (priority 1 before priority 0)
      this.queue.sort((a, b) => b.priority - a.priority);
      const job = this.queue.shift();
      if (!job) break;

      if (job.cancelled) {
        continue;
      }

      this.activeRenders++;
      this.executeRender(job).finally(() => {
        this.activeRenders--;
        this.processQueue();
      });
    }
  }

  /**
   * Renders a single page using PDF.js into a canvas.
   */
  private async executeRender(job: ThumbnailJob): Promise<void> {
    if (this.isDestroyed || !this.pdfjsDoc || job.cancelled) {
      return;
    }

    try {
      const page = await this.pdfjsDoc.getPage(job.pageNumber);
      if (job.cancelled || this.isDestroyed) return;

      const unscaledViewport = page.getViewport({ scale: 1 });
      const targetMaxDim = 200; // max dimension for thumbnail
      const maxDim = Math.max(unscaledViewport.width, unscaledViewport.height);
      const scale = maxDim > 0 ? Math.min(targetMaxDim / maxDim, 0.4) : 0.25;
      const viewport = page.getViewport({ scale });

      const width = Math.min(Math.round(viewport.width), 320);
      const height = Math.min(Math.round(viewport.height), 400);

      let canvas: HTMLCanvasElement | null = null;
      let ctx: any = null;

      if (typeof document !== 'undefined') {
        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        ctx = canvas.getContext('2d', { alpha: false });
      }

      // Fallback for Node.js / test environments without canvas DOM
      if (!canvas || !ctx) {
        const mockResult: ThumbnailResult = {
          dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="%23f8fafc"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2364748b" font-family="sans-serif" font-size="12">Page ${job.pageNumber}</text></svg>`,
          width,
          height,
          aspectRatio: width / height,
        };
        this.cache.set(job.pageNumber, mockResult);
        job.resolve(mockResult);
        return;
      }

      // Fill with solid white background (prevents black background on transparent PDFs)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      const renderContext = {
        canvasContext: ctx,
        viewport,
      };

      const renderTask = page.render(renderContext);
      job.renderTask = renderTask;
      this.activeTasks.set(job.pageNumber, renderTask);

      await renderTask.promise;
      this.activeTasks.delete(job.pageNumber);

      if (job.cancelled || this.isDestroyed) {
        canvas.width = 0;
        canvas.height = 0;
        return;
      }

      // Convert to compressed JPEG data URL for low memory footprint (~4-8 KB)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

      // Immediately free canvas backing store memory
      canvas.width = 0;
      canvas.height = 0;

      const result: ThumbnailResult = {
        dataUrl,
        width,
        height,
        aspectRatio: width / height,
      };

      this.cache.set(job.pageNumber, result);
      job.resolve(result);
    } catch (err: unknown) {
      this.activeTasks.delete(job.pageNumber);
      if (job.cancelled || this.isDestroyed) return;

      const isCancelledError =
        err instanceof Error &&
        (err.name === 'RenderingCancelledException' || err.message?.toLowerCase().includes('cancelled'));

      if (!isCancelledError) {
        job.reject(err instanceof Error ? err : new Error('Thumbnail render failed'));
      }
    }
  }

  /**
   * Diagnostic metrics for tests and monitoring.
   */
  public getMetrics(): { activeRenders: number; queueLength: number; cachedCount: number; maxConcurrent: number } {
    return {
      activeRenders: this.activeRenders,
      queueLength: this.queue.length,
      cachedCount: this.cache.size,
      maxConcurrent: this.maxConcurrent,
    };
  }

  public hasCached(pageNumber: number): boolean {
    return this.cache.has(pageNumber);
  }

  public getCached(pageNumber: number): ThumbnailResult | undefined {
    return this.cache.get(pageNumber);
  }

  /**
   * Destroys the service, cancels all renders, and frees resources.
   */
  public destroy(): void {
    this.isDestroyed = true;

    // Cancel all active tasks
    for (const [, task] of this.activeTasks) {
      if (task && typeof task.cancel === 'function') {
        try {
          task.cancel();
        } catch {}
      }
    }
    this.activeTasks.clear();

    // Mark all queued jobs cancelled
    for (const job of this.queue) {
      job.cancelled = true;
    }
    this.queue = [];
    this.pendingPromises.clear();

    // Clear cache
    this.cache.clear();

    // Destroy PDF.js document if available
    if (this.pdfjsDoc && typeof this.pdfjsDoc.destroy === 'function') {
      try {
        this.pdfjsDoc.destroy();
      } catch {}
    }
    this.pdfjsDoc = null;
    this.buffer = null;
    this.activeRenders = 0;
  }
}
