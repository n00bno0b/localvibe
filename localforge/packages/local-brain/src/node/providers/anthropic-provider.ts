import { AIProviderAdapter } from './base-provider';
import { LocalBrainChatRequest, AIModel, ProviderConnectionStatus, AIProviderInfo } from '../../common/protocol';
import * as https from 'https';

export class AnthropicProvider implements AIProviderAdapter {
    getInfo(): AIProviderInfo {
        return {
            id: 'anthropic-provider',
            displayName: 'Anthropic (Cloud)',
            type: 'cloud',
            supportsStreaming: true
        };
    }

    async listModels(): Promise<AIModel[]> {
        return [
            { id: 'claude-3-5-sonnet-20240620', displayName: 'Claude 3.5 Sonnet', contextWindow: 200000 },
            { id: 'claude-3-opus-20240229', displayName: 'Claude 3 Opus', contextWindow: 200000 },
            { id: 'claude-3-sonnet-20240229', displayName: 'Claude 3 Sonnet', contextWindow: 200000 },
            { id: 'claude-3-haiku-20240307', displayName: 'Claude 3 Haiku', contextWindow: 200000 }
        ];
    }

    async validateConnection(apiKey?: string): Promise<ProviderConnectionStatus> {
        if (!apiKey) return { connected: false, error: 'API key is required' };

        return new Promise((resolve) => {
            const req = https.get('https://api.anthropic.com/v1/models', {
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                }
            }, (res) => {
                if (res.statusCode === 401) {
                    resolve({ connected: false, error: 'Unauthorized (401)' });
                } else if (res.statusCode === 403) {
                    resolve({ connected: false, error: 'Forbidden (403)' });
                } else {
                    resolve({ connected: true });
                }
            });
            req.on('error', (err) => resolve({ connected: false, error: err.message }));
        });
    }

    async chat(request: LocalBrainChatRequest, apiKey?: string, baseUrl: string = 'api.anthropic.com'): Promise<string> {
        if (!apiKey) throw new Error('Anthropic API key is required');

        const systemMessage = request.messages.find(m => m.role === 'system')?.content || '';
        const anthropicMessages = request.messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content
            }));

        if (anthropicMessages.length === 0) {
            anthropicMessages.push({ role: 'user', content: 'Hello' });
        }

        const payload = JSON.stringify({
            model: request.model || 'claude-3-5-sonnet-20240620',
            system: systemMessage,
            messages: anthropicMessages,
            temperature: request.temperature || 0.1,
            max_tokens: request.maxTokens || 4096,
            stream: false
        });

        const options: https.RequestOptions = {
            hostname: baseUrl,
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        return reject(new Error(`Anthropic HTTP ${res.statusCode}: ${data}`));
                    }
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed.content?.[0]?.text || '');
                    } catch (e) {
                        reject(new Error(`Failed to parse Anthropic response: ${e}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
        });
    }
}
