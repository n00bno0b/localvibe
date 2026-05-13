import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { AbstractViewContribution } from '@theia/core/lib/browser';
import { ForgeScoutWidget, ForgeScoutWidgetOptions } from './forge-scout-widget';
import { PreviewWidget, PreviewWidgetOptions } from './preview-widget';

export const AppBlueprintCommand = {
    id: 'localforge.appBlueprint.new',
    label: 'LocalForge: New App Blueprint (Forge Scout)'
};

export const PreviewAppCommand = {
    id: 'localforge.previewApp',
    label: 'LocalForge: Preview App'
};

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
export class PreviewViewContribution extends AbstractViewContribution<PreviewWidget> {
    constructor() {
        super({
            widgetId: PreviewWidgetOptions.id,
            widgetName: PreviewWidgetOptions.label,
            defaultWidgetOptions: { area: 'right' },
            toggleCommandId: 'preview:toggle'
        });
    }
}

@injectable()
export class AppBlueprintCommandContribution implements CommandContribution {
    constructor(
        @inject(ForgeScoutViewContribution) private readonly scoutViewContribution: ForgeScoutViewContribution,
        @inject(PreviewViewContribution) private readonly previewViewContribution: PreviewViewContribution
    ) {}

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(AppBlueprintCommand, {
            execute: async () => {
                await this.scoutViewContribution.openView({ activate: true });
            }
        });

        registry.registerCommand(PreviewAppCommand, {
            execute: async () => {
                await this.previewViewContribution.openView({ activate: true });
            }
        });
    }
}
