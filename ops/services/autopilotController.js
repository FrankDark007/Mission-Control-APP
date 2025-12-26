
export class AutopilotController {
    constructor(callAIFunction) {
        this.callAI = callAIFunction;
    }

    async evaluateLog(agentId, logChunk, modelId = 'gemini-3-flash-preview') {
        const prompt = `
            Analyze the following agent logs and determine if there is a critical failure.
            Agent: ${agentId}
            Logs:
            ${logChunk}
            
            If a failure is found, provide a diagnostic and a suggested terminal command to fix it.
            Return JSON format: { "failure": boolean, "diagnostic": string, "suggestedFix": string }
        `;

        try {
            // Using the central callAI logic which handles provider routing and system instructions
            const response = await this.callAI(
                modelId, 
                prompt, 
                "You are an expert systems engineer. You must return ONLY a valid JSON object."
            );
            
            // Clean markdown if the model included it
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
