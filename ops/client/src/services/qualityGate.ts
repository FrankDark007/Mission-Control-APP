
/**
 * Quality Gate Service (Grammarly Integration).
 * Analyzes mission strategies for clarity, tone, and grammar.
 */
export class QualityGate {
  async analyze(text: string) {
    // Simulated Grammarly Quality Gate logic
    const score = Math.min(100, text.length > 50 ? 85 + Math.random() * 15 : 40 + Math.random() * 30);
    const issues = [];
    
    if (text.length < 20) issues.push({ type: 'clarity', msg: 'Prompt too brief for swarm reasoning.' });
    if (!/[.!?]$/.test(text)) issues.push({ type: 'grammar', msg: 'Missing terminal punctuation.' });
    if (text.toLowerCase().includes('maybe') || text.toLowerCase().includes('try')) {
        issues.push({ type: 'confidence', msg: 'Avoid hedging language in tactical commands.' });
    }

    return {
      score: Math.round(score),
      status: score > 75 ? 'passed' : 'failed',
      issues,
      suggestions: issues.map(i => `Resolve ${i.type} conflict: ${i.msg}`)
    };
  }
}

export const qualityGate = new QualityGate();
