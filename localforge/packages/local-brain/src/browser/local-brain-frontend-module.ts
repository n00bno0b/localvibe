import { ContainerModule } from '@theia/core/shared/inversify';
import { LocalBrainCommandContribution, LocalBrainViewContribution } from './local-brain-contribution';
import { CommandContribution } from '@theia/core/lib/common/command';
import { LocalBrainService, LocalBrainServicePath } from '../common/protocol';
import { WebSocketConnectionProvider } from '@theia/core/lib/browser';
import { LocalBrainWidget } from './local-brain-widget';
import { WidgetFactory, bindViewContribution, FrontendApplicationContribution } from '@theia/core/lib/browser';

export default new ContainerModule(bind => {
    // Bind the JSON-RPC proxy to the backend service
    bind(LocalBrainService).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<LocalBrainService>(LocalBrainServicePath);
    }).inSingletonScope();

    // Bind Widget
    bind(LocalBrainWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: 'local-brain-widget',
        createWidget: () => ctx.container.get<LocalBrainWidget>(LocalBrainWidget)
    })).inSingletonScope();

    // Bind View Contribution
    bindViewContribution(bind, LocalBrainViewContribution);
    bind(FrontendApplicationContribution).toService(LocalBrainViewContribution);

    // Bind Commands
    bind(CommandContribution).to(LocalBrainCommandContribution).inSingletonScope();
});
