import { AIProviderAdapter } from './base-provider';
import { LocalBrainChatRequest, AIModel, ProviderConnectionStatus, AIProviderInfo } from '../../common/protocol';
import * as http from 'http';

export class LocalBrainProvider implements AIProviderAdapter {
    constructor(private readonly getPort: () => Promise<number | undefined>) {}

    getInfo(): AIProviderInfo {
        return {
            id: 'local-brain-provider',
            displayName: 'Local Brain (llama.cpp)',
            type: 'local',
            supportsStreaming: true
        };
    }

    async listModels(): Promise<AIModel[]> {
        return [{ id: 'local-model', displayName: 'Active Local Model', contextWindow: 8192 }];
    }

    async validateConnection(): Promise<ProviderConnectionStatus> {
        const port = await this.getPort();
        if (!port) return { connected: false, error: 'Local Brain runtime is not running.' };

        return new Promise((resolve) => {
            const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
                resolve({ connected: res.statusCode === 200 });
            });
            req.on('error', (err) => resolve({ connected: false, error: err.message }));
        });
    }

    async chat(request: LocalBrainChatRequest): Promise<string> {
        const port = await this.getPort();
        if (!port) throw new Error('Local Brain runtime is not running.');

        const payload = JSON.stringify({
            model: request.model || 'local-model',
            messages: request.messages,
            temperature: request.temperature || 0.1, // low temp for codegen
            max_tokens: request.maxTokens || 4096,
            stream: false // Using standard blocking request for simplicity in code gen
        });

        const options: http.RequestOptions = {
            hostname: '127.0.0.1',
            port,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        return new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        return reject(new Error(`Local Brain HTTP ${res.statusCode}: ${data}`));
                    }
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed.choices?.[0]?.message?.content || '');
                    } catch (e) {
                        reject(new Error(`Failed to parse Local Brain response: ${e}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
        });
    }
}
