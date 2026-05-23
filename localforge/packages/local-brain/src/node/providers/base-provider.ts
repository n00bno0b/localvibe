import { LocalBrainChatRequest, AIModel, ProviderConnectionStatus, AIProviderInfo } from '../../common/protocol';

export interface AIProviderAdapter {
    getInfo(): AIProviderInfo;
    listModels(): Promise<AIModel[]>;
    chat(request: LocalBrainChatRequest, apiKey?: string, baseUrl?: string): Promise<string>;
    validateConnection(apiKey?: string, baseUrl?: string): Promise<ProviderConnectionStatus>;
}
