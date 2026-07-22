// ==UserScript==
// @name         雨云控制台模块管理器
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  雨云控制台功能模块管理器，支持模块的安装、卸载、启用、禁用和更新
// @author       ndxzzy, DeepSeek
// @match        https://app.rainyun.com/*
// @updateURL    https://github.com/KeKe0904/rainyun-modular/raw/main/rainyun-modular.user.js
// @downloadURL  https://github.com/KeKe0904/rainyun-modular/raw/main/rainyun-modular.user.js
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        unsafeWindow
// @connect      github.com
// @connect      rainyun-modular.zzwl.top
// @connect      api.v2.rainyun.com
// @connect      app.rainyun.com
// ==/UserScript==

(function() {
    'use strict';

    // 脚本配置
    const CONFIG = {
        sources: {
            Github: {
                baseModuleListUrl: 'https://raw.githubusercontent.com/KeKe0904/rainyun-modular/main/modules/module-list.json',
                baseVersionUrl: 'https://raw.githubusercontent.com/KeKe0904/rainyun-modular/main/version.json',
                baseUrl: 'https://raw.githubusercontent.com/KeKe0904/rainyun-modular/main/modules/'
            },
            Rainapp: {
                baseModuleListUrl: 'https://rainyun-modular.zzwl.top/modules/module-list.json',
                baseVersionUrl: 'https://rainyun-modular.zzwl.top/version.json',
                baseUrl: 'https://rainyun-modular.zzwl.top/modules/'
            }
        },
        getModuleListUrl: function() {
            const source = this.getCurrentSource();
            return `${source.baseModuleListUrl}?t=${Math.floor(Date.now()/60000)}`;
        },
        getModuleUrl: function(path, script) {
            const source = this.getCurrentSource();
            return `${source.baseUrl}${path}/${script}?t=${Math.floor(Date.now()/60000)}`;
        },
        getCurrentSource: function() {
            const sourceName = GM_getValue('source_name', 'Rainapp');
            return this.sources[sourceName] || this.sources['Rainapp'];
        },
        updateCheckInterval: 24 * 60 * 60 * 1000
    };

    // 样式配置（简约苹果风格）
    const STYLE_CONFIG = {
        primaryColor: "#007AFF",
        textColor: "#1d1d1f",
        secondaryText: "#86868b",
        backgroundColor: "rgba(255,255,255,0.78)",
        cardColor: "rgba(120,120,128,0.08)",
        borderColor: "rgba(0,0,0,0.06)",
        borderRadius: "16px",
        smallRadius: "10px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        hoverShadow: "0 12px 40px rgba(0,0,0,0.10)",
        primaryGlow: "rgba(0,122,255,0.3)",
        fontStack: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif'
    };

    // 状态管理
    const state = {
        menuCommands: [],
        modules: {},
        installedModules: {},
        settingsOpen: false
    };

    // DOM元素
    let managerUI = null;
    let settingsUI = null;

    // 注入全局样式（简约苹果风格）
    function injectGlobalStyles() {
        GM_addStyle(`
            @keyframes rm-breath {
                0%, 100% { box-shadow: 0 2px 12px rgba(0,0,0,0.12), 0 0 0 0 ${STYLE_CONFIG.primaryGlow}; }
                50%      { box-shadow: 0 2px 12px rgba(0,0,0,0.12), 0 0 0 8px rgba(0,122,255,0); }
            }
            .rm-floating-inner { animation: rm-breath 3s ease-in-out infinite; }
            .rm-floating-inner:hover { animation: none; }

            .rm-module-card {
                transition: transform 0.2s cubic-bezier(0.4,0,0.2,1), background-color 0.2s ease;
            }
            .rm-module-card:hover { transform: translateY(-1px); background-color: rgba(120,120,128,0.12); }

            .rm-notification {
                display: flex; align-items: center; gap: 8px;
                padding-left: 4px;
            }

            .rm-scroll::-webkit-scrollbar { width: 5px; }
            .rm-scroll::-webkit-scrollbar-track { background: transparent; }
            .rm-scroll::-webkit-scrollbar-thumb {
                background: rgba(0,0,0,0.15);
                border-radius: 3px;
            }
            .rm-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.25); }

            .rm-panel {
                font-family: ${STYLE_CONFIG.fontStack};
                -webkit-font-smoothing: antialiased;
                backdrop-filter: blur(20px) saturate(180%);
                -webkit-backdrop-filter: blur(20px) saturate(180%);
            }
            .rm-btn {
                font-family: ${STYLE_CONFIG.fontStack};
                font-weight: 500;
                transition: opacity 0.15s ease, transform 0.1s ease;
            }
            .rm-btn:active { transform: scale(0.96); }

            .rm-config-header {
                display: flex; align-items: center; justify-content: space-between;
                padding: 10px 12px; cursor: pointer; user-select: none;
                border-radius: ${STYLE_CONFIG.smallRadius};
                background: ${STYLE_CONFIG.cardColor};
                transition: background 0.15s ease;
            }
            .rm-config-header:hover { background: rgba(120,120,128,0.14); }
            .rm-config-title {
                font-size: 12px; font-weight: 600;
                color: ${STYLE_CONFIG.textColor};
                font-family: ${STYLE_CONFIG.fontStack};
                display: flex; align-items: center; gap: 6px;
            }
            .rm-config-arrow {
                font-size: 10px; color: ${STYLE_CONFIG.secondaryText};
                transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
            }
            .rm-config-arrow.collapsed { transform: rotate(-90deg); }
            .rm-config-body {
                overflow: hidden;
                transition: max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease, padding 0.3s ease;
                max-height: 600px; opacity: 1; padding: 10px 4px 4px;
            }
            .rm-config-body.collapsed {
                max-height: 0; opacity: 0; padding: 0 4px;
            }
            .rm-config-form {
                margin-top: 12px; margin-bottom: 12px;
            }
            .rm-actions {
                margin-top: 4px;
            }
        `);
    }

    // 暴露 GM_xmlhttpRequest 到页面上下文（供模块绕过 CORS 并携带 Cookie）
    function exposeGMFetch() {
        const gmFetch = function(input, init) {
            init = init || {};
            const url = typeof input === 'string' ? input : (input.url || input);
            const method = init.method || (typeof input === 'object' && input.method) || 'GET';
            const body = init.body || (typeof input === 'object' && input.body) || null;
            // 规范化 headers
            let headers = init.headers || (typeof input === 'object' && input.headers) || {};
            if (headers instanceof Headers) {
                const obj = {};
                headers.forEach((v, k) => { obj[k] = v; });
                headers = obj;
            }
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: method,
                    url: url,
                    headers: headers,
                    data: body,
                    anonymous: false, // 携带 Cookie（跨域也可）
                    timeout: 30000,
                    onload: (response) => {
                        resolve({
                            ok: response.status >= 200 && response.status < 300,
                            status: response.status,
                            statusText: response.statusText,
                            text: () => Promise.resolve(response.responseText),
                            json: () => {
                                try { return Promise.resolve(JSON.parse(response.responseText)); }
                                catch (e) { return Promise.reject(e); }
                            }
                        });
                    },
                    onerror: () => reject(new Error('GM_xmlhttpRequest 网络错误')),
                    ontimeout: () => reject(new Error('GM_xmlhttpRequest 超时')),
                    onabort: () => reject(new Error('GM_xmlhttpRequest 已中止'))
                });
            });
        };
        try {
            unsafeWindow.rmGMFetch = gmFetch;
        } catch (e) {
            window.rmGMFetch = gmFetch;
        }
    }

    // 暴露配置更新函数到页面上下文（供模块回写配置，如自动获取API Key后同步显示）
    function exposeConfigUpdater() {
        const updateConfig = function(moduleId, key, value) {
            try {
                const module = state.installedModules[moduleId];
                if (!module) return false;
                if (!module.config) module.config = {};
                module.config[key] = value;
                GM_setValue(`module_${moduleId}`, JSON.stringify(module));
                // 同步更新已注入到页面的配置
                if (window.RainyunModularConfig && window.RainyunModularConfig[moduleId]) {
                    window.RainyunModularConfig[moduleId].config = window.RainyunModularConfig[moduleId].config || {};
                    window.RainyunModularConfig[moduleId].config[key] = value;
                }
                // 若管理器UI中的配置表单可见，同步更新输入框
                const form = managerUI && managerUI.querySelector(`[data-module-config="${moduleId}"]`);
                if (form) {
                    const input = form.querySelector(`[data-config-key="${key}"]`);
                    if (input) input.value = value;
                }
                return true;
            } catch (e) {
                console.error('[管理器] 更新模块配置失败:', e);
                return false;
            }
        };
        try {
            unsafeWindow.rmUpdateModuleConfig = updateConfig;
        } catch (e) {
            window.rmUpdateModuleConfig = updateConfig;
        }
    }

    // 初始化
    async function init() {
        injectGlobalStyles();
        exposeGMFetch();
        exposeConfigUpdater();
        loadInstalledModules();
        document.body.appendChild(createFloatingButton());
        await checkForUpdates();
        registerMenuCommands();
        await loadModuleList();

        // 新增自启动逻辑
        if (document.readyState === 'complete') {
            autoStartModules();
        } else {
            window.addEventListener('load', () => autoStartModules());
        }
    }

    // 自动启动模块
    function autoStartModules() {
        Object.values(state.installedModules).forEach(module => {
            if (module.enabled) {
                console.log(`[管理器] 自动启动模块: ${module.name}`);
                executeModule(module);
            }
        });
    }

    // 加载已安装模块
    function loadInstalledModules() {
        state.installedModules = GM_listValues()
            .filter(key => key.startsWith('module_'))
            .reduce((acc, key) => {
                try {
                    const moduleId = key.replace('module_', '');
                    acc[moduleId] = JSON.parse(GM_getValue(key));
                } catch (e) {
                    console.error('解析模块配置失败:', key, e);
                    GM_deleteValue(key); // 自动清理损坏数据
                }
                return acc;
            }, {});
    }

    // 注册菜单命令
    function registerMenuCommands() {
        // 注销旧命令
        state.menuCommands.forEach(cmd => GM_unregisterMenuCommand(cmd));
        state.menuCommands = [];

        // 注册新命令
        state.menuCommands.push(GM_registerMenuCommand('打开脚本管理器', openManager));
        state.menuCommands.push(GM_registerMenuCommand('检查脚本更新', checkForUpdates));

        // 为已安装模块添加快速开关
        Object.keys(state.installedModules).forEach(moduleId => {
            const module = state.installedModules[moduleId];
            const command = GM_registerMenuCommand(
                `${module.enabled ? '✅' : '❌'} ${module.name}`,
                () => toggleModule(moduleId)
            );
            state.menuCommands.push(command);
        });
    }

    // 创建悬浮按钮（简约苹果风格）
    function createFloatingButton() {
        const btn = document.createElement('div');
        btn.innerHTML = `
            <div class="floating-btn-inner rm-floating-inner" style="
                background: ${STYLE_CONFIG.primaryColor};
                width: 44px;
                height: 44px;
                border-radius: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
                box-shadow: 0 2px 12px rgba(0,0,0,0.12);
                opacity: 0.7;
            ">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                    stroke="#fff" stroke-width="2.2" stroke-linecap="round"
                    stroke-linejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
                    <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
                    <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
                    <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
                </svg>
            </div>
        `;

        Object.assign(btn.style, {
            position: 'fixed',
            left: '-18px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: '10000',
            transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
            padding: '20px',
            margin: '-20px'
        });

        const innerBtn = btn.querySelector('.floating-btn-inner');

        btn.addEventListener('mouseenter', () => {
            btn.style.left = '16px';
            innerBtn.style.opacity = '1';
            innerBtn.style.borderRadius = '22px';
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.left = '-18px';
            innerBtn.style.opacity = '0.7';
            innerBtn.style.borderRadius = '14px';
        });

        btn.addEventListener('click', openManager);
        return btn;
    }

    // 打开管理器界面（简约苹果风格）
    async function openManager() {
        if (managerUI) {
            managerUI.remove();
            managerUI = null;
        }
        // 关闭设置面板避免重叠
        if (settingsUI) {
            settingsUI.remove();
            settingsUI = null;
        }

        managerUI = document.createElement('div');
        managerUI.className = 'rm-panel';
        const isMobile = window.innerWidth < 768;
        Object.assign(managerUI.style, {
            position: 'fixed',
            left: isMobile ? '0' : '80px',
            top: '50%',
            transform: 'translateY(-50%) scale(0.95)',
            width: isMobile ? '100%' : '340px',
            maxHeight: '80vh',
            backgroundColor: STYLE_CONFIG.backgroundColor,
            borderRadius: STYLE_CONFIG.borderRadius,
            boxShadow: STYLE_CONFIG.boxShadow,
            border: `1px solid ${STYLE_CONFIG.borderColor}`,
            zIndex: '9999',
            opacity: '0',
            transition: 'opacity 0.25s ease, transform 0.25s cubic-bezier(0.4,0,0.2,1)',
            overflow: 'hidden'
        });

        // 头部
        const header = document.createElement('div');
        Object.assign(header.style, {
            padding: '18px 20px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        });

        const titleWrap = document.createElement('div');
        titleWrap.style.display = 'flex';
        titleWrap.style.alignItems = 'center';
        titleWrap.style.gap = '8px';

        const title = document.createElement('span');
        title.textContent = '模块管理器';
        Object.assign(title.style, {
            fontSize: '17px',
            fontWeight: '600',
            color: STYLE_CONFIG.textColor,
            fontFamily: STYLE_CONFIG.fontStack
        });

        // 更新检查
        const updateStatus = await checkSelfUpdate().catch(() => ({
            hasUpdate: false,
            error: '检查失败',
            status: 'error'
        }));

        const updateDot = document.createElement('span');
        let dotColor = '';
        if (updateStatus.status === 'error') {
            dotColor = '#FF9500';
        } else if (updateStatus.hasUpdate) {
            dotColor = '#FF3B30';
        } else {
            dotColor = '#34C759';
        }
        Object.assign(updateDot.style, {
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: dotColor,
            display: 'inline-block',
            cursor: updateStatus.hasUpdate ? 'pointer' : 'default'
        });
        if (updateStatus.hasUpdate) {
            updateDot.title = '有更新，点击更新';
            updateDot.onclick = () => window.open(updateStatus.updateUrl);
        }

        titleWrap.appendChild(title);
        titleWrap.appendChild(updateDot);

        const settingsBtn = createIconButton('⚙');
        settingsBtn.style.marginRight = '4px';
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openSettings();
        });

        const closeBtn = createIconButton('✕');
        closeBtn.addEventListener('click', () => {
            managerUI.style.opacity = '0';
            managerUI.style.transform = 'translateY(-50%) scale(0.95)';
            setTimeout(() => {
                managerUI.remove();
                managerUI = null;
            }, 250);
        });

        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.appendChild(settingsBtn);
        buttonsContainer.appendChild(closeBtn);

        header.appendChild(titleWrap);
        header.appendChild(buttonsContainer);

        // 分隔线
        const divider = document.createElement('div');
        divider.style.cssText = `height:1px;background:${STYLE_CONFIG.borderColor};margin:0 20px;`;

        // 内容区域
        const content = document.createElement('div');
        content.className = 'rm-scroll';
        Object.assign(content.style, {
            padding: '14px 16px',
            overflowY: 'auto',
            maxHeight: 'calc(80vh - 70px)'
        });

        loadModuleList().then(modules => {
            content.innerHTML = '';
            modules.forEach(module => {
                content.appendChild(createModuleCard(module));
            });
        });

        managerUI.appendChild(header);
        managerUI.appendChild(divider);
        managerUI.appendChild(content);
        document.body.appendChild(managerUI);

        setTimeout(() => {
            managerUI.style.opacity = '1';
            managerUI.style.transform = 'translateY(-50%) scale(1)';
        }, 10);
    }

    // 打开设置界面（简约苹果风格）
    function openSettings() {
        if (settingsUI) {
            settingsUI.remove();
            settingsUI = null;
            return;
        }

        settingsUI = document.createElement('div');
        settingsUI.className = 'rm-panel';
        const isMobile = window.innerWidth < 768;
        Object.assign(settingsUI.style, {
            position: 'fixed',
            // 移动端：覆盖在管理器上方；桌面端：紧贴管理器右侧（间距12px）
            left: isMobile ? '0' : 'calc(80px + 340px + 12px)',
            top: '50%',
            transform: 'translateY(-50%) scale(0.95)',
            width: isMobile ? '100%' : '260px',
            maxHeight: '80vh',
            backgroundColor: STYLE_CONFIG.backgroundColor,
            borderRadius: STYLE_CONFIG.borderRadius,
            boxShadow: STYLE_CONFIG.boxShadow,
            border: `1px solid ${STYLE_CONFIG.borderColor}`,
            // 设置面板层级高于管理器，确保移动端覆盖
            zIndex: '10001',
            opacity: '0',
            transition: 'opacity 0.25s ease, transform 0.25s cubic-bezier(0.4,0,0.2,1)',
            overflow: 'hidden'
        });

        // 头部
        const header = document.createElement('div');
        Object.assign(header.style, {
            padding: '18px 20px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        });

        const title = document.createElement('span');
        title.textContent = '设置';
        Object.assign(title.style, {
            fontSize: '17px',
            fontWeight: '600',
            color: STYLE_CONFIG.textColor,
            fontFamily: STYLE_CONFIG.fontStack
        });

        const closeBtn = createIconButton('✕');
        closeBtn.addEventListener('click', () => {
            settingsUI.style.opacity = '0';
            settingsUI.style.transform = 'translateY(-50%) scale(0.95)';
            setTimeout(() => {
                settingsUI.remove();
                settingsUI = null;
            }, 250);
        });

        header.appendChild(title);
        header.appendChild(closeBtn);
        settingsUI.appendChild(header);

        const divider = document.createElement('div');
        divider.style.cssText = `height:1px;background:${STYLE_CONFIG.borderColor};margin:0 20px;`;
        settingsUI.appendChild(divider);

        // 内容区域
        const content = document.createElement('div');
        Object.assign(content.style, {
            padding: '16px 20px',
            overflowY: 'auto',
            maxHeight: 'calc(80vh - 80px)'
        });

        // 数据源选择
        const sourceLabel = document.createElement('label');
        sourceLabel.textContent = '数据源';
        Object.assign(sourceLabel.style, {
            display: 'block',
            marginBottom: '8px',
            fontSize: '13px',
            color: STYLE_CONFIG.secondaryText,
            fontFamily: STYLE_CONFIG.fontStack
        });

        const sourceSelect = document.createElement('select');
        Object.assign(sourceSelect.style, {
            width: '100%',
            padding: '9px 10px',
            borderRadius: STYLE_CONFIG.smallRadius,
            border: `1px solid ${STYLE_CONFIG.borderColor}`,
            backgroundColor: STYLE_CONFIG.cardColor,
            fontSize: '14px',
            color: STYLE_CONFIG.textColor,
            fontFamily: STYLE_CONFIG.fontStack,
            cursor: 'pointer'
        });

        const currentSource = GM_getValue('source_name', 'Rainapp');

        Object.keys(CONFIG.sources).forEach(sourceName => {
            const option = document.createElement('option');
            option.value = sourceName;
            option.textContent = sourceName;
            option.selected = sourceName === currentSource;
            sourceSelect.appendChild(option);
        });

        sourceSelect.addEventListener('change', () => {
            const newSource = sourceSelect.value;
            GM_setValue('source_name', newSource);
            showNotification(`数据源已切换为 ${newSource}`, 'success');

            loadModuleList().then(() => {
                if (managerUI) {
                    managerUI.remove();
                    managerUI = null;
                    openManager();
                }
            });
        });

        content.appendChild(sourceLabel);
        content.appendChild(sourceSelect);
        settingsUI.appendChild(content);
        document.body.appendChild(settingsUI);

        setTimeout(() => {
            settingsUI.style.opacity = '1';
            settingsUI.style.transform = 'translateY(-50%) scale(1)';
        }, 10);
    }

    async function checkSelfUpdate() {
        try {
            const currentVersion = GM_info.script.version;
            const source = CONFIG.getCurrentSource();
            const versionUrl = `${source.baseVersionUrl}?t=${Math.floor(Date.now()/60000)}`;

            const response = await fetch(versionUrl);
            if (!response.ok) throw new Error(`HTTP错误: ${response.status}`);

            const versionInfo = await response.json();
            const versionComparison = compareVersions(versionInfo.version, currentVersion);

            return {
                status: 'success',
                hasUpdate: versionComparison > 0,
                currentVersion,
                remoteVersion: versionInfo.version,
                updateUrl: versionInfo.updateUrl,
                isDowngrade: versionComparison < 0
            };
        } catch (error) {
            console.error('检查管理器更新失败:', error);
            return {
                status: 'error',
                hasUpdate: false,
                error: error.message
            };
        }
    }

    // 创建图标按钮（简约苹果风格）
    function createIconButton(icon) {
        const btn = document.createElement('div');
        btn.innerHTML = icon;
        Object.assign(btn.style, {
            width: '30px',
            height: '30px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s ease',
            color: STYLE_CONFIG.secondaryText,
            fontSize: '15px',
            fontFamily: STYLE_CONFIG.fontStack
        });
        btn.addEventListener('mouseenter', () => {
            btn.style.background = STYLE_CONFIG.cardColor;
            btn.style.color = STYLE_CONFIG.textColor;
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'transparent';
            btn.style.color = STYLE_CONFIG.secondaryText;
        });
        return btn;
    }

    // 创建模块卡片（简约苹果风格）
    function createModuleCard(module) {
        const isInstalled = state.installedModules[module.id];
        const isEnabled = isInstalled ? isInstalled.enabled : false;
        const hasUpdate = module.hasUpdate || false;

        const card = document.createElement('div');
        card.className = 'rm-module-card';
        Object.assign(card.style, {
            backgroundColor: STYLE_CONFIG.cardColor,
            borderRadius: STYLE_CONFIG.smallRadius,
            padding: '16px',
            marginBottom: '12px',
            fontFamily: STYLE_CONFIG.fontStack
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
        });

        const title = document.createElement('span');
        title.textContent = module.name;
        Object.assign(title.style, {
            fontSize: '15px',
            fontWeight: '600',
            color: STYLE_CONFIG.textColor
        });

        const status = document.createElement('span');
        status.textContent = isInstalled ?
            (isEnabled ? '已启用' : '已禁用') +
            (hasUpdate ? ' · 可更新' : '') :
            '未安装';

        Object.assign(status.style, {
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '500'
        });

        if (isInstalled) {
            status.style.backgroundColor = isEnabled ?
                (hasUpdate ? 'rgba(255,149,0,0.12)' : 'rgba(52,199,89,0.12)') :
                'rgba(255,59,48,0.12)';
            status.style.color = isEnabled ?
                (hasUpdate ? '#FF9500' : '#34C759') :
                '#FF3B30';
        } else {
            status.style.backgroundColor = 'rgba(0,122,255,0.12)';
            status.style.color = STYLE_CONFIG.primaryColor;
        }

        header.appendChild(title);
        header.appendChild(status);

        const description = document.createElement('p');
        description.textContent = module.description;
        Object.assign(description.style, {
            margin: '0 0 12px 0',
            color: STYLE_CONFIG.secondaryText,
            fontSize: '13px',
            lineHeight: '1.4'
        });

        const actions = document.createElement('div');
        actions.className = 'rm-actions';
        Object.assign(actions.style, {
            display: 'flex',
            gap: '8px'
        });

        // 安装/卸载按钮
        const installBtn = document.createElement('button');
        installBtn.className = 'rm-btn';
        installBtn.textContent = isInstalled ? '卸载' : '安装';
        Object.assign(installBtn.style, {
            flex: '1',
            padding: '8px 12px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px'
        });

        if (isInstalled) {
            installBtn.style.backgroundColor = 'rgba(255,59,48,0.12)';
            installBtn.style.color = '#FF3B30';
            installBtn.onclick = () => uninstallModule(module.id);
        } else {
            installBtn.style.backgroundColor = STYLE_CONFIG.primaryColor;
            installBtn.style.color = '#fff';
            installBtn.onclick = () => installModule(module);
        }

        // 启用/禁用按钮
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'rm-btn';
        toggleBtn.textContent = isInstalled ? (isEnabled ? '禁用' : '启用') : '不可用';
        Object.assign(toggleBtn.style, {
            flex: '1',
            padding: '8px 12px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px'
        });

        if (isInstalled) {
            toggleBtn.style.backgroundColor = isEnabled ? 'rgba(255,59,48,0.12)' : 'rgba(52,199,89,0.12)';
            toggleBtn.style.color = isEnabled ? '#FF3B30' : '#34C759';
            toggleBtn.onclick = () => toggleModule(module.id);
        } else {
            toggleBtn.style.backgroundColor = STYLE_CONFIG.cardColor;
            toggleBtn.style.color = STYLE_CONFIG.secondaryText;
            toggleBtn.disabled = true;
        }

        // 更新按钮
        const updateBtn = document.createElement('button');
        updateBtn.className = 'rm-btn';
        updateBtn.textContent = hasUpdate ? '更新' : '最新';
        Object.assign(updateBtn.style, {
            flex: '1',
            padding: '8px 12px',
            border: 'none',
            borderRadius: '8px',
            cursor: hasUpdate ? 'pointer' : 'default',
            fontSize: '13px',
            backgroundColor: hasUpdate ? 'rgba(255,149,0,0.12)' : STYLE_CONFIG.cardColor,
            color: hasUpdate ? '#FF9500' : STYLE_CONFIG.secondaryText
        });

        if (hasUpdate) {
            updateBtn.onclick = () => installModule(module);
        }

        actions.appendChild(installBtn);
        actions.appendChild(toggleBtn);
        if (isInstalled) {
            actions.appendChild(updateBtn);
        }

        card.appendChild(header);
        card.appendChild(description);
        if (isInstalled) {
            const configForm = createConfigForm(module.id);
            if (configForm) {
                card.appendChild(configForm);
            }
        }
        card.appendChild(actions);

        return card;
    }

    function compareVersions(v1, v2) {
        // 清理并规范版本格式
        const normalize = v =>
            String(v).replace(/^v/, '')          // 去除v前缀
                .replace(/(\.0+)+$/, '')     // 去除末尾的.0
                .split('.')
                .map(n => parseInt(n, 10) || 0);

        const version1 = normalize(v1);
        const version2 = normalize(v2);

        const maxLength = Math.max(version1.length, version2.length);
        for (let i = 0; i < maxLength; i++) {
            const num1 = version1[i] || 0;
            const num2 = version2[i] || 0;
            if (num1 > num2) return 1;
            if (num1 < num2) return -1;
        }
        return 0;
    }

    // 配置表单函数
    function createConfigForm(moduleId) {
        const module = state.installedModules[moduleId];
        const schema = state.modules.find(m => m.id === moduleId)?.configSchema;
        if (!schema) return null;

        const form = document.createElement('div');
        form.className = 'rm-config-form';
        Object.assign(form.style, {
            borderTop: `1px solid ${STYLE_CONFIG.borderColor}`,
            paddingTop: '10px'
        });

        // 折叠头部
        const header = document.createElement('div');
        header.className = 'rm-config-header';
        const titleWrap = document.createElement('div');
        titleWrap.className = 'rm-config-title';
        const gearIcon = document.createElement('span');
        gearIcon.textContent = '⚙';
        gearIcon.style.fontSize = '11px';
        const titleText = document.createElement('span');
        titleText.textContent = '模块配置';
        titleWrap.appendChild(gearIcon);
        titleWrap.appendChild(titleText);

        const arrow = document.createElement('span');
        arrow.className = 'rm-config-arrow collapsed';
        arrow.textContent = '▼';

        header.appendChild(titleWrap);
        header.appendChild(arrow);

        // 折叠内容区
        const body = document.createElement('div');
        body.className = 'rm-config-body collapsed';
        body.setAttribute('data-module-config', moduleId);

        header.addEventListener('click', () => {
            const isCollapsed = body.classList.contains('collapsed');
            if (isCollapsed) {
                body.classList.remove('collapsed');
                arrow.classList.remove('collapsed');
            } else {
                body.classList.add('collapsed');
                arrow.classList.add('collapsed');
            }
        });

        schema.forEach(item => {
            const wrapper = document.createElement('div');
            wrapper.style.marginBottom = '10px';

            const label = document.createElement('label');
            label.textContent = item.label;
            Object.assign(label.style, {
                display: 'block',
                marginBottom: '4px',
                fontSize: '12px',
                color: STYLE_CONFIG.secondaryText,
                fontFamily: STYLE_CONFIG.fontStack
            });

            let input;
            const inputBase = {
                width: '100%',
                padding: '7px 10px',
                borderRadius: '8px',
                border: `1px solid ${STYLE_CONFIG.borderColor}`,
                backgroundColor: STYLE_CONFIG.cardColor,
                fontSize: '13px',
                color: STYLE_CONFIG.textColor,
                fontFamily: STYLE_CONFIG.fontStack,
                boxSizing: 'border-box'
            };
            if (item.type === 'text') {
                input = document.createElement('input');
                input.type = 'text';
                input.value = module.config[item.key] || item.default;
                input.setAttribute('data-config-key', item.key);
                Object.assign(input.style, inputBase);
            } else if (item.type === 'select') {
                input = document.createElement('select');
                input.setAttribute('data-config-key', item.key);
                Object.assign(input.style, inputBase);
                Object.assign(input.style, { cursor: 'pointer' });
                item.options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.text = opt;
                    option.selected = module.config[item.key] === opt;
                    input.appendChild(option);
                });
            }

            input.addEventListener('change', () => {
                module.config[item.key] = input.type === 'select-one' ? input.value : input.value;
                GM_setValue(`module_${moduleId}`, JSON.stringify(module));
                executeModule(module);
            });

            wrapper.appendChild(label);
            wrapper.appendChild(input);
            body.appendChild(wrapper);
        });

        form.appendChild(header);
        form.appendChild(body);

        return form;
    }

    // 加载模块列表
    async function loadModuleList() {
        try {
            const response = await fetch(CONFIG.getModuleListUrl());
            if (!response.ok) throw new Error(`HTTP错误: ${response.status}`);

            const remoteModules = await response.json();
            const installedIds = Object.keys(state.installedModules);

            // 1. 检查下架模块
            const deprecatedModules = installedIds.filter(id =>
                !remoteModules.some(m => m.id === id)
            );

            if (deprecatedModules.length > 0) {
                handleDeprecatedModules(deprecatedModules);
            }

            // 2. 为每个模块标记更新状态
            remoteModules.forEach(module => {
                const installedModule = state.installedModules[module.id];
                module.hasUpdate = installedModule ?
                    (compareVersions(module.version, installedModule.version) > 0) :
                    false;

                // 保留原始安装状态
                if (installedModule) {
                    module.installed = true;
                    module.enabled = installedModule.enabled;
                }
            });

            // 3. 更新全局模块状态
            state.modules = remoteModules;
            return remoteModules;

        } catch (error) {
            console.error('加载模块列表失败:', error);
            showNotification('无法获取模块列表，请检查网络', 'error');
            // 返回缓存的模块列表（如果有）
            return state.modules || [];
        }
    }

    // 下架模块处理器
    function handleDeprecatedModules(moduleIds) {
        const SILENT_MODE = GM_getValue('silent_mode', false);

        if (!SILENT_MODE) {
            showNotification(
                `发现 ${moduleIds.length} 个已下架模块，正在清理...`,
                'warning'
            );
        }

        moduleIds.forEach(id => {
            const moduleName = state.installedModules[id]?.name || id;
            console.log(`[自动清理] 移除下架模块: ${moduleName}`);
            GM_deleteValue(`module_${id}`);

            // 可选：备份配置
            if (GM_getValue('backup_enabled', false)) {
                const backup = JSON.stringify(state.installedModules[id]);
                GM_setValue(`backup_${id}`, backup);
            }
        });
    }

    // 安装模块（更新时保留已有配置）
    async function installModule(module) {
        try {
            const source = CONFIG.getCurrentSource();
            const scriptUrl = `${source.baseUrl}${module.path}/${module.script}`;
            const response = await fetch(scriptUrl);

            if (!response.ok) {
                throw new Error(`下载脚本失败，状态码: ${response.status}`);
            }

            const scriptContent = await response.text();

            // 读取已存在的模块数据（用于更新时保留配置）
            const existingData = state.installedModules[module.id];
            const existingConfig = (existingData && existingData.config) || {};

            // 以 schema 默认值为基底，再用已有配置覆盖（仅保留 schema 中仍存在的键）
            const newConfig = module.configSchema ? module.configSchema.reduce((acc, item) => {
                acc[item.key] = (existingConfig[item.key] !== undefined)
                    ? existingConfig[item.key]
                    : item.default;
                return acc;
            }, {}) : {};

            const moduleData = {
                id: module.id,
                name: module.name,
                description: module.description,
                version: module.version,
                // 更新时保留启用状态
                enabled: existingData ? existingData.enabled : true,
                installedAt: existingData ? existingData.installedAt : new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                scriptContent,
                config: newConfig
            };

            GM_setValue(`module_${module.id}`, JSON.stringify(moduleData));
            loadInstalledModules();
            registerMenuCommands();

            if (managerUI) {
                managerUI.remove();
                managerUI = null;
                openManager();
            }

            const action = existingData ? '更新' : '安装';
            showNotification(`模块 "${module.name}" ${action}成功`);
            executeModule(moduleData);
        } catch (error) {
            console.error('安装模块失败:', error);
            showNotification(`安装模块失败: ${error.message}`, 'error');
        }
    }

    // 卸载模块
    function uninstallModule(moduleId) {
        const module = state.installedModules[moduleId];
        if (!module) return;

        GM_deleteValue(`module_${moduleId}`);
        loadInstalledModules();
        registerMenuCommands();

        if (managerUI) {
            managerUI.remove();
            managerUI = null;
            openManager(); // 刷新界面
        }

        showNotification(`模块 "${module.name}" 已卸载`);
    }

    // 切换模块状态
    function toggleModule(moduleId) {
        const module = state.installedModules[moduleId];
        if (!module) return;

        module.enabled = !module.enabled;
        GM_setValue(`module_${moduleId}`, JSON.stringify(module));
        registerMenuCommands();

        if (managerUI) {
            managerUI.remove();
            managerUI = null;
            openManager(); // 刷新界面
        }

        const status = module.enabled ? '启用' : '禁用';
        showNotification(`模块 "${module.name}" 已${status}`);

        if (module.enabled) {
            executeModule(module);
        }
    }

    // 执行模块
    function executeModule(module) {
        if (!module.enabled) return;
        try {
            // 清理旧脚本
            document.querySelectorAll(`script[data-module="${module.id}"]`).forEach(s => s.remove());

            const config = {
                enabled: module.enabled,
                config: module.config || {}
            };

            const script = document.createElement('script');
            script.textContent = `
                (function() {
                    // 配置注入
                    window.RainyunModularConfig = window.RainyunModularConfig || {};
                    window.RainyunModularConfig['${module.id}'] = ${JSON.stringify(config)};

                    // 智能等待DOM就绪
                    const executor = () => {
                        try {
                            ${module.scriptContent}
                        } catch (e) {
                            console.error('[模块加载] 执行错误:', e);
                        }
                    };

                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', executor);
                    } else {
                        setTimeout(executor, 100); // 确保异步执行
                    }
                })();
            `;
            script.setAttribute('data-module', module.id);
            document.head.appendChild(script);
        } catch (error) {
            console.error(`执行模块 ${module.name} 失败:`, error);
        }
    }

    // 检查更新
    async function checkForUpdates() {
        try {
            const lastCheck = GM_getValue('lastUpdateCheck');
            const now = Date.now();

            // 如果距离上次检查不足24小时，则不检查
            if (lastCheck && now - lastCheck < CONFIG.updateCheckInterval) {
                return;
            }

            GM_setValue('lastUpdateCheck', now);

            await loadModuleList();

            let updateAvailable = false;
            Object.keys(state.installedModules).forEach(moduleId => {
                const installedModule = state.installedModules[moduleId];
                const remoteModule = state.modules.find(m => m.id === moduleId);

                // 使用 compareVersions 替代字符串比较，避免 0.10 < 0.9 之类的错误判断
                if (remoteModule && compareVersions(remoteModule.version, installedModule.version) > 0) {
                    updateAvailable = true;
                    installedModule.updateAvailable = true;
                    GM_setValue(`module_${moduleId}`, JSON.stringify(installedModule));
                } else if (installedModule.updateAvailable) {
                    installedModule.updateAvailable = false;
                    GM_setValue(`module_${moduleId}`, JSON.stringify(installedModule));
                }
            });

            loadInstalledModules();
            registerMenuCommands();

            if (updateAvailable) {
                showNotification('有可用更新，请在管理器中查看', 'info');
            }

            return updateAvailable;
        } catch (error) {
            console.error('检查更新失败:', error);
            return false;
        }
    }

    // 检查模块更新
    async function checkModuleUpdate(moduleInfo) {
        const moduleId = moduleInfo.id;
        const installedModule = state.installedModules[moduleId];

        if (!installedModule) {
            showNotification('模块未安装', 'error');
            return;
        }

        try {
            await loadModuleList();
            const remoteModule = state.modules.find(m => m.id === moduleId);

            if (!remoteModule) {
                showNotification('找不到远程模块信息', 'error');
                return;
            }

            if (compareVersions(remoteModule.version, installedModule.version) > 0) {
                const confirmUpdate = confirm(`发现更新: ${installedModule.name} ${installedModule.version} → ${remoteModule.version}\n是否更新?`);
                if (confirmUpdate) {
                    await installModule(remoteModule);
                }
            } else {
                showNotification('模块已是最新版本', 'success');
            }
        } catch (error) {
            console.error('检查模块更新失败:', error);
            showNotification(`检查更新失败: ${error.message}`, 'error');
        }
    }

    // 显示通知（简约苹果风格）
    function showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = 'rm-notification rm-panel';
        const iconMap = { error: '✕', success: '✓', info: 'ℹ', warning: '⚠' };
        const colorMap = { error: '#FF3B30', success: '#34C759', info: '#007AFF', warning: '#FF9500' };
        const icon = iconMap[type] || iconMap.info;
        const color = colorMap[type] || colorMap.info;
        notification.innerHTML = `<span style="font-size:14px;line-height:1;color:${color};">${icon}</span><span style="white-space:pre-line;">${message}</span>`;
        Object.assign(notification.style, {
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            padding: '12px 16px',
            borderRadius: '14px',
            color: STYLE_CONFIG.textColor,
            fontSize: '13px',
            fontWeight: '500',
            fontFamily: STYLE_CONFIG.fontStack,
            backgroundColor: 'rgba(255,255,255,0.82)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            border: `1px solid ${STYLE_CONFIG.borderColor}`,
            zIndex: '99999',
            transform: 'translateY(20px) scale(0.95)',
            opacity: '0',
            transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease',
            maxWidth: '320px'
        });

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateY(0) scale(1)';
            notification.style.opacity = '1';
        }, 10);

        setTimeout(() => {
            notification.style.transform = 'translateY(20px) scale(0.95)';
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    // 初始化
    init();
})();
