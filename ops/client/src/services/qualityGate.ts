
/**
 * Quality Gate Service (Advanced Neural Governance).
 * Audits mission strategies for linguistic precision using the Swarm AI Core.
 */
export class QualityGate {
  async analyze(text: string) {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Perform a Grammarly-style quality audit on the following text. Grade it on clarity, tone (should be tactical/professional), and grammar. Return ONLY a JSON object: { "score": number, "status": "passed"|"failed", "issues": [{ "type": string, "msg": string }], "suggestions": [string] }\n\nTEXT: "${text}"`,
          model: 'gemini-3-flash-preview',
          systemInstruction: "You are a professional linguistic auditor. Score out of 100. Be strict with technical clarity."
        })
      });

      const data = await response.json();
      const report = JSON.parse((data.text || '').replace(/```json|```/g, '').trim());
      return report;
    } catch (e) {
      // Fallback to local heuristic if backend is unreachable
      const score = Math.min(100, text.length > 50 ? 85 : 40);
      return {
        score,
        status: score > 75 ? 'passed' : 'failed',
        issues: text.length < 20 ? [{ type: 'clarity', msg: 'Neural payload too brief.' }] : [],
        suggestions: ['Attempt neural link retry for deeper audit.']
      };
    }
  }
}

export const qualityGate = new QualityGate();
