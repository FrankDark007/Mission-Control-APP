
export class AutopilotController {
    constructor(callAIFunction) {
        this.callAI = callAIFunction;
    }

    /**
     * Feature 11: Evaluates both server logs and browser sensory logs.
     */
    async evaluateLog(agentId, logChunk, modelId = 'gemini-3-pro-preview') {
        const isBrowser = agentId === 'BROWSER_UI';
        const context = isBrowser 
            ? "This log comes from the LIVE BROWSER CONSOLE. Identify UI crashes or script failures."
            : "This log comes from a BACKGROUND AGENT PROCESS.";

        const prompt = `
            ${context}
            Analyze the following logs for critical failures:
            Source: ${agentId}
            Logs:
            ${logChunk}
            
            If a failure is found, provide:
            1. Diagnostic: What exactly broke?
            2. fixCommand: A suggested terminal command to apply a fix to the local codebase.
            
            Return ONLY raw JSON: { "failure": boolean, "diagnostic": string, "fixCommand": string, "explanation": string }
        `;

        try {
            const response = await this.callAI(
                modelId, 
                prompt, 
                "You are an expert full-stack systems engineer. You must return ONLY valid JSON."
            );
            
            const cleaned = response.text.replace(/```json|```/g, '').trim();
            return JSON.parse(cleaned);
        } catch (e) {
            console.error('Autopilot Evaluation Error:', e);
            return { failure: false, error: e.message };
        }
    }

    async proposeCodeFix(filePath, errorCode, currentContent, modelId = 'gemini-3-pro-preview') {
        const prompt = `
            The file at ${filePath} is failing with the following error:
            ${errorCode}
            
            Current Content:
            ${currentContent}
            
            Provide the corrected code for the failing section. 
            Keep changes minimal and preserve existing logic.
        `;

        try {
            const response = await this.callAI(modelId, prompt, "You are a senior software architect.");
            return response.text;
        } catch (e) {
            console.error('Autopilot Code Fix Error:', e);
            return null;
        }
    }
}
