// @ts-check
require('reflect-metadata');
const startupLog = (milestone) => console.debug(`Frontend: ${milestone} [${(performance.now() / 1000).toFixed(3)} s since frontend page start]`);
startupLog('loading modules...');
const { Container } = require('@theia/core/shared/inversify');
const { FrontendApplicationConfigProvider } = require('@theia/core/lib/browser/frontend-application-config-provider');

FrontendApplicationConfigProvider.set({
    "applicationName": "LocalForge IDE",
    "defaultTheme": {
        "light": "light",
        "dark": "dark"
    },
    "defaultIconTheme": "theia-file-icons",
    "electron": {
        "windowOptions": {},
        "showWindowEarly": true,
        "splashScreenOptions": {
            "content": "resources/theia-logo.svg",
            "height": 90
        },
        "uriScheme": "theia"
    },
    "defaultLocale": "",
    "validatePreferencesSchema": true,
    "reloadOnReconnect": true,
    "uriScheme": "theia"
});


self.MonacoEnvironment = {
    getWorkerUrl: function (moduleId, label) {
        return './editor.worker.js';
    }
}

function load(container, jsModule) {
    return Promise.resolve(jsModule)
        .then(containerModule => container.load(containerModule.default));
}

async function preload(container) {
    try {
        await load(container, import('@theia/core/lib/browser/preload/preload-module'));
        await load(container, import('@theia/api-samples/lib/browser/api-samples-preload-module'));
        const { Preloader } = require('@theia/core/lib/browser/preload/preloader');
        const preloader = container.get(Preloader);
        await preloader.initialize();
    } catch (reason) {
        console.error('Failed to run preload scripts.');
        if (reason) {
            console.error(reason);
        }
    }
}

module.exports = (async () => {
    const { messagingFrontendModule } = require('@theia/core/lib/electron-browser/messaging/electron-messaging-frontend-module');
    const container = new Container();
    container.load(messagingFrontendModule);


    startupLog('container created');

    await preload(container);
    startupLog('preloaded');


    const { MonacoInit } = require('@theia/monaco/lib/browser/monaco-init');
    ;

    const { FrontendApplication } = require('@theia/core/lib/browser');
    const { frontendApplicationModule } = require('@theia/core/lib/browser/frontend-application-module');
    const { loggerFrontendModule } = require('@theia/core/lib/browser/logger-frontend-module');

    container.load(frontendApplicationModule);
    undefined

    container.load(loggerFrontendModule);


    startupLog('core modules loaded');

    try {
        await load(container, import('@theia/core/lib/browser/i18n/i18n-frontend-module'));
        await load(container, import('@theia/core/lib/electron-browser/menu/electron-menu-module'));
        await load(container, import('@theia/core/lib/electron-browser/window/electron-window-module'));
        await load(container, import('@theia/core/lib/electron-browser/keyboard/electron-keyboard-module'));
        await load(container, import('@theia/core/lib/electron-browser/token/electron-token-frontend-module'));
        await load(container, import('@theia/core/lib/electron-browser/request/electron-browser-request-module'));
        await load(container, import('@theia/variable-resolver/lib/browser/variable-resolver-frontend-module'));
        await load(container, import('@theia/editor/lib/browser/editor-frontend-module'));
        await load(container, import('@theia/filesystem/lib/browser/filesystem-frontend-module'));
        await load(container, import('@theia/filesystem/lib/browser/download/file-download-frontend-module'));
        await load(container, import('@theia/filesystem/lib/browser/file-dialog/file-dialog-module'));
        await load(container, import('@theia/filesystem/lib/electron-browser/file-dialog/electron-file-dialog-module'));
        await load(container, import('@theia/workspace/lib/browser/workspace-frontend-module'));
        await load(container, import('@theia/markers/lib/browser/problem/problem-frontend-module'));
        await load(container, import('@theia/outline-view/lib/browser/outline-view-frontend-module'));
        await load(container, import('@theia/monaco/lib/browser/monaco-frontend-module'));
        await load(container, import('@theia/output/lib/browser/output-frontend-module'));
        await load(container, import('@theia/ai-core/lib/browser/ai-core-frontend-module'));
        await load(container, import('@theia/ai-anthropic/lib/browser/anthropic-frontend-module'));
        await load(container, import('@theia/process/lib/common/process-common-module'));
        await load(container, import('@theia/file-search/lib/browser/file-search-frontend-module'));
        await load(container, import('@theia/ai-chat/lib/browser/ai-chat-frontend-module'));
        await load(container, import('@theia/navigator/lib/browser/navigator-frontend-module'));
        await load(container, import('@theia/navigator/lib/electron-browser/electron-navigator-module'));
        await load(container, import('@theia/editor-preview/lib/browser/editor-preview-frontend-module'));
        await load(container, import('@theia/userstorage/lib/browser/user-storage-frontend-module'));
        await load(container, import('@theia/preferences/lib/browser/preference-frontend-module'));
        await load(container, import('@theia/ai-chat-ui/lib/browser/ai-chat-ui-frontend-module'));
        await load(container, import('@theia/ai-claude-code/lib/browser/claude-code-frontend-module'));
        await load(container, import('@theia/ai-code-completion/lib/browser/ai-code-completion-frontend-module'));
        await load(container, import('@theia/ai-openai/lib/browser/openai-frontend-module'));
        await load(container, import('@theia/ai-codex/lib/browser/codex-frontend-module'));
        await load(container, import('@theia/ai-copilot/lib/browser/copilot-frontend-module'));
        await load(container, import('@theia/ai-core-ui/lib/browser/ai-core-ui-frontend-module'));
        await load(container, import('@theia/ai-editor/lib/browser/ai-editor-frontend-module'));
        await load(container, import('@theia/ai-google/lib/browser/google-frontend-module'));
        await load(container, import('@theia/ai-history/lib/browser/ai-history-frontend-module'));
        await load(container, import('@theia/ai-huggingface/lib/browser/huggingface-frontend-module'));
        await load(container, import('@theia/ai-mcp/lib/browser/mcp-frontend-module'));
        await load(container, import('@theia/terminal/lib/browser/terminal-frontend-module'));
        await load(container, import('@theia/ai-terminal/lib/browser/ai-terminal-frontend-module'));
        await load(container, import('@theia/console/lib/browser/console-frontend-module'));
        await load(container, import('@theia/terminal-manager/lib/browser/terminal-manager-frontend-module'));
        await load(container, import('@theia/task/lib/browser/task-frontend-module'));
        await load(container, import('@theia/test/lib/browser/view/test-view-frontend-module'));
        await load(container, import('@theia/debug/lib/browser/debug-frontend-module'));
        await load(container, import('@theia/scm/lib/browser/scm-frontend-module'));
        await load(container, import('@theia/search-in-workspace/lib/browser/search-in-workspace-frontend-module'));
        await load(container, import('@theia/ai-ide/lib/browser/frontend-module'));
        await load(container, import('@theia/ai-llamafile/lib/browser/llamafile-frontend-module'));
        await load(container, import('@theia/ai-mcp-server/lib/browser/mcp-frontend-module'));
        await load(container, import('@theia/ai-mcp-ui/lib/browser/mcp-ui-frontend-module'));
        await load(container, import('@theia/ai-ollama/lib/browser/ollama-frontend-module'));
        await load(container, import('@theia/scanoss/lib/browser/scanoss-frontend-module'));
        await load(container, import('@theia/ai-scanoss/lib/browser/ai-scanoss-frontend-module'));
        await load(container, import('@theia/ai-vercel-ai/lib/browser/vercel-ai-frontend-module'));
        await load(container, import('@theia/bulk-edit/lib/browser/bulk-edit-frontend-module'));
        await load(container, import('@theia/callhierarchy/lib/browser/callhierarchy-frontend-module'));
        await load(container, import('@theia/messages/lib/browser/messages-frontend-module'));
        await load(container, import('@theia/notebook/lib/browser/notebook-frontend-module'));
        await load(container, import('@theia/timeline/lib/browser/timeline-frontend-module'));
        await load(container, import('@theia/typehierarchy/lib/browser/typehierarchy-frontend-module'));
        await load(container, import('@theia/plugin-ext/lib/plugin-ext-frontend-module'));
        await load(container, import('@theia/plugin-ext/lib/plugin-ext-frontend-electron-module'));
        await load(container, import('@theia/toolbar/lib/browser/toolbar-frontend-module'));
        await load(container, import('@theia/plugin-ext-vscode/lib/browser/plugin-vscode-frontend-module'));
        await load(container, import('@theia/vsx-registry/lib/common/vsx-registry-common-module'));
        await load(container, import('@theia/vsx-registry/lib/browser/vsx-registry-frontend-module'));
        await load(container, import('@theia/api-samples/lib/browser/api-samples-frontend-module'));
        await load(container, import('@theia/api-samples/lib/electron-browser/updater/sample-updater-frontend-module'));
        await load(container, import('@theia/collaboration/lib/browser/collaboration-frontend-module'));
        await load(container, import('@theia/remote/lib/electron-browser/remote-frontend-module'));
        await load(container, import('@theia/dev-container/lib/electron-browser/dev-container-frontend-module'));
        await load(container, import('@theia/external-terminal/lib/electron-browser/external-terminal-frontend-module'));
        await load(container, import('@theia/keymaps/lib/browser/keymaps-frontend-module'));
        await load(container, import('@theia/mini-browser/lib/browser/mini-browser-frontend-module'));
        await load(container, import('@theia/mini-browser/lib/electron-browser/environment/electron-mini-browser-environment-module'));
        await load(container, import('@theia/preview/lib/browser/preview-frontend-module'));
        await load(container, import('@theia/getting-started/lib/browser/getting-started-frontend-module'));
        await load(container, import('@theia/memory-inspector/lib/browser/memory-inspector-frontend-module'));
        await load(container, import('@theia/metrics/lib/browser/metrics-frontend-module'));
        await load(container, import('@theia/plugin-dev/lib/browser/plugin-dev-frontend-module'));
        await load(container, import('@theia/property-view/lib/browser/property-view-frontend-module'));
        await load(container, import('@theia/remote-wsl/lib/electron-browser/remote-wsl-frontend-module'));
        await load(container, import('@theia/scm-extra/lib/browser/scm-extra-frontend-module'));
        await load(container, import('@theia/secondary-window/lib/browser/secondary-window-frontend-module'));
        await load(container, import('@localforge/local-brain/lib/browser/local-brain-frontend-module'));
        await load(container, import('@localforge/app-blueprints/lib/browser/app-blueprints-frontend-module'));

        MonacoInit.init(container);
        ;
        startupLog('modules loaded');
        await start();
    } catch (reason) {
        console.error('Failed to start the frontend application.');
        if (reason) {
            console.error(reason);
        }
    }

    function start() {
        (window['theia'] = window['theia'] || {}).container = container;
        startupLog('resolving application');
        const application = container.get(FrontendApplication);
        startupLog('application resolved');
        return application.start();
    }
})();
