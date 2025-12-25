
import { GoogleGenAI } from "@google/genai";

export class AutopilotController {
    constructor(apiKey) {
        this.ai = new GoogleGenAI({ apiKey });
    }

    async evaluateLog(agentId, logChunk) {
        const prompt = `
            Analyze the following agent logs and determine if there is a critical failure.
            Agent: ${agentId}
            Logs:
            ${logChunk}
            
            If a failure is found, provide a diagnostic and a suggested terminal command to fix it.
            Return JSON format: { "failure": boolean, "diagnostic": string, "suggestedFix": string }
        `;

        try {
            const response = await this.ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            return JSON.parse(response.text);
        } catch (e) {
            console.error('Autopilot Evaluation Error:', e);
            return { failure: false, error: e.message };
        }
    }

    async proposeCodeFix(filePath, errorCode, currentContent) {
        const prompt = `
            The file at ${filePath} is failing with the following error:
            ${errorCode}
            
            Current Content:
            ${currentContent}
            
            Provide the corrected code for the failing section. 
            Keep changes minimal and preserve existing logic.
        `;

        try {
            const response = await this.ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: prompt
            });
            return response.text;
        } catch (e) {
            console.error('Autopilot Code Fix Error:', e);
            return null;
        }
    }
}
