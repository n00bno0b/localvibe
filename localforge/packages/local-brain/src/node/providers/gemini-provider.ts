import { AIProviderAdapter } from './base-provider';
import { LocalBrainChatRequest, AIModel, ProviderConnectionStatus, AIProviderInfo } from '../../common/protocol';
import * as https from 'https';

export class GeminiProvider implements AIProviderAdapter {
    getInfo(): AIProviderInfo {
        return {
            id: 'gemini-provider',
            displayName: 'Google Gemini (Cloud)',
            type: 'cloud',
            supportsStreaming: true
        };
    }

    async listModels(): Promise<AIModel[]> {
        return [
            { id: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', contextWindow: 2000000 },
            { id: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', contextWindow: 1000000 },
            { id: 'gemini-1.0-pro', displayName: 'Gemini 1.0 Pro', contextWindow: 32768 }
        ];
    }

    async validateConnection(apiKey?: string): Promise<ProviderConnectionStatus> {
        if (!apiKey) return { connected: false, error: 'API key is required' };

        return new Promise((resolve) => {
            const req = https.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, (res) => {
                if (res.statusCode === 200) {
                    resolve({ connected: true });
                } else if (res.statusCode === 400) {
                    resolve({ connected: false, error: 'Bad Request / Invalid API Key (400)' });
                } else {
                    resolve({ connected: false, error: `HTTP ${res.statusCode}` });
                }
            });
            req.on('error', (err) => resolve({ connected: false, error: err.message }));
        });
    }

    async chat(request: LocalBrainChatRequest, apiKey?: string, baseUrl: string = 'generativelanguage.googleapis.com'): Promise<string> {
        if (!apiKey) throw new Error('Gemini API key is required');

        const modelId = request.model || 'gemini-1.5-flash';

        const systemMessage = request.messages.find(m => m.role === 'system')?.content;

        const contents = request.messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

        if (contents.length === 0) {
            contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
        }

        const payloadObj: any = {
            contents: contents,
            generationConfig: {
                temperature: request.temperature || 0.1,
                maxOutputTokens: request.maxTokens || 4096,
            }
        };

        if (systemMessage) {
            payloadObj.systemInstruction = {
                parts: [{ text: systemMessage }]
            };
        }

        const payload = JSON.stringify(payloadObj);

        const options: https.RequestOptions = {
            hostname: baseUrl,
            path: `/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        return reject(new Error(`Gemini HTTP ${res.statusCode}: ${data}`));
                    }
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed.candidates?.[0]?.content?.parts?.[0]?.text || '');
                    } catch (e) {
                        reject(new Error(`Failed to parse Gemini response: ${e}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
        });
    }
}
