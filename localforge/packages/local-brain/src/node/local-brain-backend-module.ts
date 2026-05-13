import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/common/messaging';
import { LocalBrainService, LocalBrainServicePath, LocalBrainChatService, LocalBrainChatServicePath } from '../common/protocol';
import { LocalBrainServiceImpl } from './local-brain-service-impl';
import { LocalBrainChatServiceImpl } from './chat-service-impl';

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
});
