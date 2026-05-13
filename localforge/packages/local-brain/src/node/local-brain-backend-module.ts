import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/common/messaging';
import { LocalBrainService, LocalBrainServicePath, LocalBrainChatService, LocalBrainChatServicePath, AIProviderRegistry, AIProviderRegistryPath } from '../common/protocol';
import { LocalBrainServiceImpl } from './local-brain-service-impl';
import { LocalBrainChatServiceImpl } from './chat-service-impl';
import { AIProviderRegistryImpl } from './provider-registry-impl';

export default new ContainerModule(bind => {
    bind(LocalBrainService).to(LocalBrainServiceImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler(LocalBrainServicePath, () => {
            return ctx.container.get<LocalBrainService>(LocalBrainService);
        })
    ).inSingletonScope();

    bind(LocalBrainChatService).to(LocalBrainChatServiceImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler(LocalBrainChatServicePath, () => {
            return ctx.container.get<LocalBrainChatService>(LocalBrainChatService);
        })
    ).inSingletonScope();

    bind(AIProviderRegistry).to(AIProviderRegistryImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler(AIProviderRegistryPath, () => {
            return ctx.container.get<AIProviderRegistry>(AIProviderRegistry);
        })
    ).inSingletonScope();
});
