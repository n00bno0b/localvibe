import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { AbstractViewContribution } from '@theia/core/lib/browser';
import { ForgeScoutWidget, ForgeScoutWidgetOptions } from './forge-scout-widget';
import { PreviewWidget, PreviewWidgetOptions } from './preview-widget';
import { DependencyDoctorWidget, DependencyDoctorWidgetOptions } from './dependency-doctor-widget';
import { CodegenDiffWidget, CodegenDiffWidgetOptions } from './codegen-diff-widget';
import { ForgeConductorWidget, ForgeConductorWidgetOptions } from './forge-conductor-widget';

export const AppBlueprintCommand = {
    id: 'localforge.appBlueprint.new',
    label: 'LocalForge: New App Blueprint (Forge Scout)'
};

export const PreviewAppCommand = {
    id: 'localforge.previewApp',
    label: 'LocalForge: Preview App'
};

export const DependencyDoctorCommand = {
    id: 'localforge.dependencyDoctor',
    label: 'LocalForge: Dependency Doctor'
};

export const CodegenDiffCommand = {
    id: 'localforge.codegenDiff',
    label: 'LocalForge: Code Diff Approval'
};

export const ForgeConductorCommand = {
    id: 'localforge.forgeConductor',
    label: 'LocalForge: Forge Conductor Dashboard'
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
export class DependencyDoctorViewContribution extends AbstractViewContribution<DependencyDoctorWidget> {
    constructor() {
        super({
            widgetId: DependencyDoctorWidgetOptions.id,
            widgetName: DependencyDoctorWidgetOptions.label,
            defaultWidgetOptions: { area: 'bottom' },
            toggleCommandId: 'dependencyDoctor:toggle'
        });
    }
}

@injectable()
export class CodegenDiffViewContribution extends AbstractViewContribution<CodegenDiffWidget> {
    constructor() {
        super({
            widgetId: CodegenDiffWidgetOptions.id,
            widgetName: CodegenDiffWidgetOptions.label,
            defaultWidgetOptions: { area: 'bottom' },
            toggleCommandId: 'codegenDiff:toggle'
        });
    }
}

@injectable()
export class ForgeConductorViewContribution extends AbstractViewContribution<ForgeConductorWidget> {
    constructor() {
        super({
            widgetId: ForgeConductorWidgetOptions.id,
            widgetName: ForgeConductorWidgetOptions.label,
            defaultWidgetOptions: { area: 'left' },
            toggleCommandId: 'forgeConductor:toggle'
        });
    }
}

@injectable()
export class AppBlueprintCommandContribution implements CommandContribution {
    constructor(
        @inject(ForgeScoutViewContribution) private readonly scoutViewContribution: ForgeScoutViewContribution,
        @inject(PreviewViewContribution) private readonly previewViewContribution: PreviewViewContribution,
        @inject(DependencyDoctorViewContribution) private readonly doctorViewContribution: DependencyDoctorViewContribution,
        @inject(CodegenDiffViewContribution) private readonly diffViewContribution: CodegenDiffViewContribution,
        @inject(ForgeConductorViewContribution) private readonly conductorViewContribution: ForgeConductorViewContribution
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

        registry.registerCommand(DependencyDoctorCommand, {
            execute: async () => {
                await this.doctorViewContribution.openView({ activate: true });
            }
        });

        registry.registerCommand(CodegenDiffCommand, {
            execute: async () => {
                await this.diffViewContribution.openView({ activate: true });
            }
        });

        registry.registerCommand(ForgeConductorCommand, {
            execute: async () => {
                await this.conductorViewContribution.openView({ activate: true });
            }
        });
    }
}
