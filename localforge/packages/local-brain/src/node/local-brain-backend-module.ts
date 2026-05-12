import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/common/messaging';
import { LocalBrainService, LocalBrainServicePath } from '../common/protocol';
import { LocalBrainServiceImpl } from './local-brain-service-impl';

export default new ContainerModule(bind => {
    bind(LocalBrainService).to(LocalBrainServiceImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler(LocalBrainServicePath, () => {
            return ctx.container.get<LocalBrainService>(LocalBrainService);
        })
    ).inSingletonScope();
});
