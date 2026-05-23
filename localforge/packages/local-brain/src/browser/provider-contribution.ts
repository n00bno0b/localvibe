import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { AbstractViewContribution } from '@theia/core/lib/browser';
import { ProviderSettingsWidget, ProviderSettingsWidgetOptions } from './provider-settings-widget';

export const AIProviderSettingsCommand = {
    id: 'localforge.aiProviderSettings',
    label: 'LocalForge: AI Provider Settings'
};

@injectable()
export class ProviderSettingsViewContribution extends AbstractViewContribution<ProviderSettingsWidget> {
    constructor() {
        super({
            widgetId: ProviderSettingsWidgetOptions.id,
            widgetName: ProviderSettingsWidgetOptions.label,
            defaultWidgetOptions: { area: 'bottom' },
            toggleCommandId: 'aiProviderSettings:toggle'
        });
    }
}

@injectable()
export class ProviderCommandContribution implements CommandContribution {
    constructor(
        @inject(ProviderSettingsViewContribution) private readonly viewContribution: ProviderSettingsViewContribution
    ) {}

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(AIProviderSettingsCommand, {
            execute: async () => {
                await this.viewContribution.openView({ activate: true });
            }
        });
    }
}
