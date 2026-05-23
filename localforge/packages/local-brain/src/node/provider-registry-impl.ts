import { injectable, inject } from '@theia/core/shared/inversify';
import {
    AIProviderRegistry,
    AIProviderInfo,
    ProviderConnectionStatus,
    ProviderRoutingMode,
    AIProviderCredentials,
    LocalBrainChatRequest,
    LocalBrainService
} from '../common/protocol';
import { AIProviderAdapter } from './providers/base-provider';
import { MockProvider } from './providers/mock-provider';
import { LocalBrainProvider } from './providers/local-brain-provider';
import { OpenAIProvider } from './providers/openai-provider';
import { AnthropicProvider } from './providers/anthropic-provider';
import { GeminiProvider } from './providers/gemini-provider';

@injectable()
export class AIProviderRegistryImpl implements AIProviderRegistry {
    private providers: Map<string, AIProviderAdapter> = new Map();
    private credentials: Map<string, AIProviderCredentials> = new Map();
    private routingMode: ProviderRoutingMode = 'ask'; // Default
    private activeProviderId: string = 'mock-provider';

    @inject(LocalBrainService)
    protected readonly localBrainService!: LocalBrainService;

    constructor() {
        // Register adapters
        const mock = new MockProvider();
        this.providers.set(mock.getInfo().id, mock);

        const openai = new OpenAIProvider();
        this.providers.set(openai.getInfo().id, openai);

        const anthropic = new AnthropicProvider();
        this.providers.set(anthropic.getInfo().id, anthropic);

        const gemini = new GeminiProvider();
        this.providers.set(gemini.getInfo().id, gemini);
    }

    private ensureLocalProviderLoaded() {
        if (!this.providers.has('local-brain-provider')) {
            const local = new LocalBrainProvider(async () => {
                const status = await this.localBrainService.getRuntimeStatus();
                return status.state === 'running' ? status.port : undefined;
            });
            this.providers.set(local.getInfo().id, local);
        }
    }

    async listProviders(): Promise<AIProviderInfo[]> {
        this.ensureLocalProviderLoaded();
        return Array.from(this.providers.values()).map(p => p.getInfo());
    }

    async getActiveProvider(): Promise<AIProviderInfo> {
        this.ensureLocalProviderLoaded();
        const provider = this.providers.get(this.activeProviderId);
        if (!provider) throw new Error('Active provider not found');
        return provider.getInfo();
    }

    async setActiveProvider(providerId: string): Promise<void> {
        this.ensureLocalProviderLoaded();
        if (!this.providers.has(providerId)) {
            throw new Error(`Unknown provider ID: ${providerId}`);
        }
        this.activeProviderId = providerId;
    }

    async getRoutingMode(): Promise<ProviderRoutingMode> {
        return this.routingMode;
    }

    async setRoutingMode(mode: ProviderRoutingMode): Promise<void> {
        this.routingMode = mode;
        if (mode === 'local-only') {
            await this.setActiveProvider('local-brain-provider');
        } else if (mode === 'mock') {
            await this.setActiveProvider('mock-provider');
        }
    }

    async setCredentials(creds: AIProviderCredentials): Promise<void> {
        this.credentials.set(creds.providerId, creds);
    }

    async checkConnection(providerId: string): Promise<ProviderConnectionStatus> {
        this.ensureLocalProviderLoaded();
        const provider = this.providers.get(providerId);
        if (!provider) throw new Error('Provider not found');
        const creds = this.credentials.get(providerId);
        return provider.validateConnection(creds?.apiKey, creds?.baseUrl);
    }

    async chat(request: LocalBrainChatRequest, providerId?: string): Promise<string> {
        this.ensureLocalProviderLoaded();
        const targetId = providerId || this.activeProviderId;
        const provider = this.providers.get(targetId);
        if (!provider) throw new Error('Provider not found');

        const creds = this.credentials.get(targetId);
        return provider.chat(request, creds?.apiKey, creds?.baseUrl);
    }
}
