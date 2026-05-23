import { AIProviderAdapter } from './base-provider';
import { LocalBrainChatRequest, AIModel, ProviderConnectionStatus, AIProviderInfo } from '../../common/protocol';
import * as https from 'https';

export class OpenAIProvider implements AIProviderAdapter {
    getInfo(): AIProviderInfo {
        return {
            id: 'openai-provider',
            displayName: 'OpenAI (Cloud)',
            type: 'cloud',
            supportsStreaming: true
        };
    }

    async listModels(): Promise<AIModel[]> {
        return [
            { id: 'gpt-4o', displayName: 'GPT-4o', contextWindow: 128000 },
            { id: 'gpt-4-turbo', displayName: 'GPT-4 Turbo', contextWindow: 128000 },
            { id: 'gpt-3.5-turbo', displayName: 'GPT-3.5 Turbo', contextWindow: 16384 }
        ];
    }

    async validateConnection(apiKey?: string): Promise<ProviderConnectionStatus> {
        if (!apiKey) return { connected: false, error: 'API key is required' };

        return new Promise((resolve) => {
            const req = https.get('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            }, (res) => {
                resolve({ connected: res.statusCode === 200, error: res.statusCode !== 200 ? `HTTP ${res.statusCode}` : undefined });
            });
            req.on('error', (err) => resolve({ connected: false, error: err.message }));
        });
    }

    async chat(request: LocalBrainChatRequest, apiKey?: string, baseUrl: string = 'api.openai.com'): Promise<string> {
        if (!apiKey) throw new Error('OpenAI API key is required');

        const payload = JSON.stringify({
            model: request.model || 'gpt-4o',
            messages: request.messages,
            temperature: request.temperature || 0.1,
            max_tokens: request.maxTokens || 4096,
            stream: false
        });

        const options: https.RequestOptions = {
            hostname: baseUrl,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        return reject(new Error(`OpenAI HTTP ${res.statusCode}: ${data}`));
                    }
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed.choices?.[0]?.message?.content || '');
                    } catch (e) {
                        reject(new Error(`Failed to parse OpenAI response: ${e}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
        });
    }
}
