import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution } from '@theia/core/lib/common/command';
import { WebSocketConnectionProvider, WidgetFactory, bindViewContribution, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { AppBlueprintCommandContribution, ForgeScoutViewContribution } from './app-blueprints-contribution';
import { ForgeScoutWidget } from './forge-scout-widget';
import { ForgeScoutService, ForgeScoutServicePath } from '../common/protocol';

export const AppBlueprintCommand = {
    id: 'localforge.appBlueprint.new',
    label: 'LocalForge: New App Blueprint (Forge Scout)'
};

export default new ContainerModule(bind => {
    // Bind RPC
    bind(ForgeScoutService).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<ForgeScoutService>(ForgeScoutServicePath);
    }).inSingletonScope();

    // Bind Widget
    bind(ForgeScoutWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: 'forge-scout-widget',
        createWidget: () => ctx.container.get<ForgeScoutWidget>(ForgeScoutWidget)
    })).inSingletonScope();

    // Bind View
    bindViewContribution(bind, ForgeScoutViewContribution);
    bind(FrontendApplicationContribution).toService(ForgeScoutViewContribution);

    // Bind Command
    bind(CommandContribution).to(AppBlueprintCommandContribution).inSingletonScope();
});
