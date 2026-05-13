import { ContainerModule } from '@theia/core/shared/inversify';
import { LocalBrainCommandContribution, LocalBrainViewContribution, LocalBrainChatViewContribution } from './local-brain-contribution';
import { ProviderSettingsViewContribution, ProviderCommandContribution } from './provider-contribution';
import { CommandContribution } from '@theia/core/lib/common/command';
import { LocalBrainService, LocalBrainServicePath, LocalBrainChatService, LocalBrainChatServicePath, AIProviderRegistry, AIProviderRegistryPath } from '../common/protocol';
import { WebSocketConnectionProvider } from '@theia/core/lib/browser';
import { LocalBrainWidget } from './local-brain-widget';
import { ProviderSettingsWidget } from './provider-settings-widget';
import { LocalBrainChatWidget } from './local-brain-chat-widget';
import { WidgetFactory, bindViewContribution, FrontendApplicationContribution } from '@theia/core/lib/browser';

export default new ContainerModule(bind => {
    // Bind the JSON-RPC proxy to the backend services
    bind(LocalBrainService).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<LocalBrainService>(LocalBrainServicePath);
    }).inSingletonScope();

    bind(LocalBrainChatService).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<LocalBrainChatService>(LocalBrainChatServicePath);
    }).inSingletonScope();

        bind(AIProviderRegistry).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<AIProviderRegistry>(AIProviderRegistryPath);
    }).inSingletonScope();

    // Bind Widgets
    bind(LocalBrainWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: 'local-brain-widget',
        createWidget: () => ctx.container.get<LocalBrainWidget>(LocalBrainWidget)
    })).inSingletonScope();

    bind(LocalBrainChatWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: 'local-brain-chat-widget',
        createWidget: () => ctx.container.get<LocalBrainChatWidget>(LocalBrainChatWidget)
    })).inSingletonScope();

    bind(ProviderSettingsWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: 'localforge-provider-settings-widget',
        createWidget: () => ctx.container.get<ProviderSettingsWidget>(ProviderSettingsWidget)
    })).inSingletonScope();

    // Bind View Contributions
    bindViewContribution(bind, LocalBrainViewContribution);
    bind(FrontendApplicationContribution).toService(LocalBrainViewContribution);

    bindViewContribution(bind, LocalBrainChatViewContribution);
    bind(FrontendApplicationContribution).toService(LocalBrainChatViewContribution);

    bindViewContribution(bind, ProviderSettingsViewContribution);
    bind(FrontendApplicationContribution).toService(ProviderSettingsViewContribution);

    // Bind Commands
    bind(CommandContribution).to(LocalBrainCommandContribution).inSingletonScope();
    bind(CommandContribution).to(ProviderCommandContribution).inSingletonScope();
});
