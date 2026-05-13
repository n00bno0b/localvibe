import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { AbstractViewContribution } from '@theia/core/lib/browser';
import { AppBlueprintCommand } from './app-blueprints-frontend-module';
import { ForgeScoutWidget, ForgeScoutWidgetOptions } from './forge-scout-widget';

@injectable()
export class ForgeScoutViewContribution extends AbstractViewContribution<ForgeScoutWidget> {
    constructor() {
        super({
            widgetId: ForgeScoutWidgetOptions.id,
            widgetName: ForgeScoutWidgetOptions.label,
            defaultWidgetOptions: { area: 'left' },
            toggleCommandId: 'forgeScout:toggle'
        });
    }
}

@injectable()
export class AppBlueprintCommandContribution implements CommandContribution {
    constructor(
        @inject(ForgeScoutViewContribution) private readonly viewContribution: ForgeScoutViewContribution
    ) {}

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(AppBlueprintCommand, {
            execute: async () => {
                await this.viewContribution.openView({ activate: true });
            }
        });
    }
}
