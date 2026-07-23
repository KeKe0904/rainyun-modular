(function() {
    'use strict';

    const moduleConfig = window.RainyunModularConfig?.['custom-background'] || {
        enabled: true,
        config: {}
    };
    if (!moduleConfig.enabled) return;

    const backgroundUrl = String(moduleConfig.config.background || '').trim();
    document.body.classList.remove('bg_img1', 'bg_img2', 'bg_img3');

    if (backgroundUrl) {
        document.body.style.backgroundImage = `url(${JSON.stringify(backgroundUrl)})`;
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundSize = 'cover';
    }

    console.log('[自定义背景] 模块已启动');
})();
