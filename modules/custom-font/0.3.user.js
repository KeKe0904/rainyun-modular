(function() {
    'use strict';

    const moduleConfig = window.RainyunModularConfig?.['custom-font'] || {
        enabled: true,
        config: {}
    };
    if (!moduleConfig.enabled) return;

    const font = String(moduleConfig.config.font || 'system-ui').trim() || 'system-ui';
    let styleElement = document.getElementById('rm-custom-font-style');
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'rm-custom-font-style';
        document.head.appendChild(styleElement);
    }

    styleElement.textContent = `
        :root { --rm-custom-font: ${JSON.stringify(font)}, system-ui; }
        body, input, textarea, select, button {
            font-family: var(--rm-custom-font) !important;
        }
        pre, code { font-family: var(--rm-custom-font), monospace !important; }
    `;

    console.log('[自定义字体] 模块已启动');
})();
