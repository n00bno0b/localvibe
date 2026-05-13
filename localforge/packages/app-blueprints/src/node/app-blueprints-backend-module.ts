import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/common/messaging';
import { ForgeScoutService, ForgeScoutServicePath } from '../common/protocol';
import { ForgeScoutServiceImpl } from './forge-scout-service-impl';

export default new ContainerModule(bind => {
    bind(ForgeScoutService).to(ForgeScoutServiceImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler(ForgeScoutServicePath, () => {
            return ctx.container.get<ForgeScoutService>(ForgeScoutService);
        })
    ).inSingletonScope();
});
