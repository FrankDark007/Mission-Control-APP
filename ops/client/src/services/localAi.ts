
/**
 * Service to interface with Chrome's built-in AI APIs (Experimental/Origin Trial).
 * Supports Gemini Nano, Summarizer, and Proofreader.
 */
export class LocalAiService {
  static async isAvailable() {
    return !!(window as any).ai && !!(window as any).ai.canCreateTextSession;
  }

  static async summarize(text: string): Promise<string> {
    if (!(window as any).ai?.summarizer) return "Summarizer API not supported in this browser.";
    try {
      const canSummarize = await (window as any).ai.summarizer.capabilities();
      if (canSummarize.available === 'no') return "Summarizer not ready.";
      const session = await (window as any).ai.summarizer.create();
      return await session.summarize(text);
    } catch (e) {
      return `Local Summary Error: ${e.message}`;
    }
  }

  static async rewrite(text: string, tone: 'professional' | 'concise' | 'casual' = 'professional'): Promise<string> {
    if (!(window as any).ai?.rewriter) return text;
    try {
      const rewriter = await (window as any).ai.rewriter.create({ sharedContext: `Tone: ${tone}` });
      return await rewriter.rewrite(text);
    } catch (e) {
      return text;
    }
  }

  static async promptLocal(prompt: string): Promise<string> {
    if (!(window as any).ai?.createTextSession) return "Gemini Nano not available.";
    try {
      const session = await (window as any).ai.createTextSession();
      return await session.prompt(prompt);
    } catch (e) {
      return `Nano Error: ${e.message}`;
    }
  }
}
