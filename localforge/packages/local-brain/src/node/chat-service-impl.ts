import { injectable, inject } from '@theia/core/shared/inversify';
import { Emitter, Event } from '@theia/core/lib/common/event';
import * as http from 'http';
import { LocalBrainChatService, LocalBrainChatRequest, LocalBrainChatChunk, LocalBrainService } from '../common/protocol';

@injectable()
export class LocalBrainChatServiceImpl implements LocalBrainChatService {

    private readonly onChatChunkEmitter = new Emitter<LocalBrainChatChunk>();
    public readonly onChatChunk: Event<LocalBrainChatChunk> = this.onChatChunkEmitter.event;

    private activeRequests = new Map<string, http.ClientRequest>();

    @inject(LocalBrainService)
    protected readonly localBrainService!: LocalBrainService;

    public async streamChatCompletion(request: LocalBrainChatRequest): Promise<void> {
        const status = await this.localBrainService.getRuntimeStatus();

        if (status.state !== 'running' || !status.port) {
            this.emitError(request.sessionId, 'Local Brain runtime is not running. Please start it from the Local Brain panel.');
            return;
        }

        const payload = JSON.stringify({
            model: request.model || 'local-model',
            messages: request.messages,
            temperature: request.temperature || 0.7,
            max_tokens: request.maxTokens || 2048,
            stream: request.stream !== false
        });

        const options: http.RequestOptions = {
            hostname: '127.0.0.1',
            port: status.port,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = http.request(options, (res) => {
            if (res.statusCode !== 200) {
                let errData = '';
                res.on('data', chunk => errData += chunk);
                res.on('end', () => {
                    this.emitError(request.sessionId, `Runtime error HTTP ${res.statusCode}: ${errData}`);
                });
                return;
            }

            let buffer = '';

            res.on('data', (chunk: Buffer) => {
                buffer += chunk.toString('utf8');
                const lines = buffer.split('\n');

                // Keep the last incomplete line in the buffer
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data: ')) continue;

                    const dataStr = trimmed.substring(6);
                    if (dataStr === '[DONE]') {
                        this.onChatChunkEmitter.fire({
                            sessionId: request.sessionId,
                            chunk: '',
                            done: true
                        });
                        continue;
                    }

                    try {
                        const parsed = JSON.parse(dataStr);
                        const content = parsed.choices?.[0]?.delta?.content || '';
                        if (content) {
                            this.onChatChunkEmitter.fire({
                                sessionId: request.sessionId,
                                chunk: content,
                                done: false
                            });
                        }
                    } catch (e) {
                        console.error('Failed to parse SSE line:', dataStr);
                    }
                }
            });

            res.on('end', () => {
                this.activeRequests.delete(request.sessionId);
                this.onChatChunkEmitter.fire({
                    sessionId: request.sessionId,
                    chunk: '',
                    done: true
                });
            });
        });

        req.on('error', (err) => {
            this.emitError(request.sessionId, `Failed to connect to runtime: ${err.message}`);
        });

        this.activeRequests.set(request.sessionId, req);
        req.write(payload);
        req.end();
    }

    public async cancelGeneration(sessionId: string): Promise<void> {
        const req = this.activeRequests.get(sessionId);
        if (req) {
            req.destroy();
            this.activeRequests.delete(sessionId);
            this.onChatChunkEmitter.fire({
                sessionId,
                chunk: '',
                done: true,
                error: 'Generation cancelled'
            });
        }
    }

    private emitError(sessionId: string, error: string) {
        this.activeRequests.delete(sessionId);
        this.onChatChunkEmitter.fire({
            sessionId,
            chunk: '',
            done: true,
            error
        });
    }
}
