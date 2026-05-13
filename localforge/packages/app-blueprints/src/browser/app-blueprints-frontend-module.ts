import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution } from '@theia/core/lib/common/command';
import { WebSocketConnectionProvider, WidgetFactory, bindViewContribution, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { AppBlueprintCommandContribution, ForgeScoutViewContribution, PreviewViewContribution, DependencyDoctorViewContribution, CodegenDiffViewContribution } from './app-blueprints-contribution';
import { ForgeScoutWidget } from './forge-scout-widget';
import { PreviewWidget } from './preview-widget';
import { DependencyDoctorWidget } from './dependency-doctor-widget';
import { CodegenDiffWidget } from './codegen-diff-widget';
import {
    ForgeScoutService, ForgeScoutServicePath,
    ProjectGeneratorService, ProjectGeneratorServicePath,
    PreviewService, PreviewServicePath,
    DependencyDoctorService, DependencyDoctorServicePath
} from '../common/protocol';
import { AICodegenService, AICodegenServicePath } from '../../../local-brain/src/common/protocol';

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

    bind(DependencyDoctorService).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<DependencyDoctorService>(DependencyDoctorServicePath);
    }).inSingletonScope();

    bind(AICodegenService).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<AICodegenService>(AICodegenServicePath);
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

    bind(DependencyDoctorWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: 'localforge-dependency-doctor-widget',
        createWidget: () => ctx.container.get<DependencyDoctorWidget>(DependencyDoctorWidget)
    })).inSingletonScope();

    bind(CodegenDiffWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: 'localforge-codegen-diff-widget',
        createWidget: () => ctx.container.get<CodegenDiffWidget>(CodegenDiffWidget)
    })).inSingletonScope();

    // Bind View
    bindViewContribution(bind, ForgeScoutViewContribution);
    bind(FrontendApplicationContribution).toService(ForgeScoutViewContribution);

    bindViewContribution(bind, PreviewViewContribution);
    bind(FrontendApplicationContribution).toService(PreviewViewContribution);

    bindViewContribution(bind, DependencyDoctorViewContribution);
    bind(FrontendApplicationContribution).toService(DependencyDoctorViewContribution);

    bindViewContribution(bind, CodegenDiffViewContribution);
    bind(FrontendApplicationContribution).toService(CodegenDiffViewContribution);

    // Bind Command
    bind(CommandContribution).to(AppBlueprintCommandContribution).inSingletonScope();
});
