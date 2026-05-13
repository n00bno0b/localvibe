import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution } from '@theia/core/lib/common/command';
import { WebSocketConnectionProvider, WidgetFactory, bindViewContribution, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { AppBlueprintCommandContribution, ForgeScoutViewContribution, PreviewViewContribution } from './app-blueprints-contribution';
import { ForgeScoutWidget } from './forge-scout-widget';
import { PreviewWidget } from './preview-widget';
import { ForgeScoutService, ForgeScoutServicePath, ProjectGeneratorService, ProjectGeneratorServicePath, PreviewService, PreviewServicePath } from '../common/protocol';

export default new ContainerModule(bind => {
    // Bind RPC
    bind(ForgeScoutService).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<ForgeScoutService>(ForgeScoutServicePath);
    }).inSingletonScope();

    bind(ProjectGeneratorService).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<ProjectGeneratorService>(ProjectGeneratorServicePath);
    }).inSingletonScope();

    bind(PreviewService).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<PreviewService>(PreviewServicePath);
    }).inSingletonScope();

    // Bind Widget
    bind(ForgeScoutWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: 'forge-scout-widget',
        createWidget: () => ctx.container.get<ForgeScoutWidget>(ForgeScoutWidget)
    })).inSingletonScope();

    bind(PreviewWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: 'localforge-preview-widget',
        createWidget: () => ctx.container.get<PreviewWidget>(PreviewWidget)
    })).inSingletonScope();

    // Bind View
    bindViewContribution(bind, ForgeScoutViewContribution);
    bind(FrontendApplicationContribution).toService(ForgeScoutViewContribution);

    bindViewContribution(bind, PreviewViewContribution);
    bind(FrontendApplicationContribution).toService(PreviewViewContribution);

    // Bind Command
    bind(CommandContribution).to(AppBlueprintCommandContribution).inSingletonScope();
});
