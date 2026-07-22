(function() {
    'use strict';

    // ===== 读取管理器注入的配置 =====
    const cfg = (window.RainyunModularConfig && window.RainyunModularConfig['ai-assistant'] && window.RainyunModularConfig['ai-assistant'].config) || {};
    const AI_BASE_URL = (cfg.ai_base_url || 'https://api.deepseek.com').replace(/\/+$/, '');
    const AI_API_KEY = cfg.ai_api_key || '';
    const AI_MODEL = cfg.ai_model || 'deepseek-chat';
    const RAINYUN_API = 'https://api.v2.rainyun.com';
    const RAINYUN_API_KEY = cfg.rainyun_api_key || '';

    // 苹果风格配色
    const C = {
        primary: '#007AFF',
        text: '#1d1d1f',
        sub: '#86868b',
        bg: 'rgba(255,255,255,0.82)',
        card: 'rgba(120,120,128,0.08)',
        border: 'rgba(0,0,0,0.06)',
        userBubble: '#007AFF',
        aiBubble: 'rgba(120,120,128,0.10)',
        font: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif'
    };

    // ===== 雨云 API 查询工具定义 =====
    const TOOLS = [
        {
            type: 'function',
            function: {
                name: 'get_user_info',
                description: '获取当前登录用户的基本信息，包括积分、余额、VIP等级、实名认证状态等',
                parameters: { type: 'object', properties: {}, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_user_logs',
                description: '获取用户操作日志',
                parameters: {
                    type: 'object',
                    properties: {
                        page: { type: 'integer', description: '页码，从1开始，默认1' },
                        page_size: { type: 'integer', description: '每页数量，默认10' }
                    },
                    required: []
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_products',
                description: '获取用户所有产品的汇总数据和使用情况',
                parameters: { type: 'object', properties: {}, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_rcs_list',
                description: '获取用户的所有云服务器(RCS)列表',
                parameters: { type: 'object', properties: {}, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_rcs_detail',
                description: '获取指定云服务器的详细信息，包括配置、状态、IP等',
                parameters: {
                    type: 'object',
                    properties: { id: { type: 'integer', description: '云服务器ID' } },
                    required: ['id']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_rgs_list',
                description: '获取用户的所有游戏云(RGS)实例列表',
                parameters: { type: 'object', properties: {}, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_rvh_list',
                description: '获取用户的所有虚拟主机(RVH)列表',
                parameters: { type: 'object', properties: {}, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_domains',
                description: '获取用户的所有域名列表',
                parameters: { type: 'object', properties: {}, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_domain_dns',
                description: '获取指定域名的DNS解析记录',
                parameters: {
                    type: 'object',
                    properties: { id: { type: 'integer', description: '域名ID' } },
                    required: ['id']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_ssl_list',
                description: '获取用户的所有SSL证书列表',
                parameters: { type: 'object', properties: {}, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_workorders',
                description: '获取用户的工单列表',
                parameters: { type: 'object', properties: {}, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_ros_list',
                description: '获取用户的对象存储(ROS)实例列表',
                parameters: { type: 'object', properties: {}, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_rcdn_list',
                description: '获取用户的CDN(RCDN)实例列表',
                parameters: { type: 'object', properties: {}, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_reward_list',
                description: '获取用户的积分奖励记录列表',
                parameters: { type: 'object', properties: {}, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_withdraw_list',
                description: '获取用户的积分提现申请列表',
                parameters: { type: 'object', properties: {}, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_announcements',
                description: '获取雨云官方公告信息',
                parameters: { type: 'object', properties: {}, required: [] }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_nodes_status',
                description: '获取雨云节点网络状态',
                parameters: { type: 'object', properties: {}, required: [] }
            }
        }
    ];

    // 工具名 → API 端点映射
    const TOOL_ROUTES = {
        get_user_info:      () => ({ method: 'GET', path: '/user/' }),
        get_user_logs:      (a) => ({ method: 'GET', path: `/user/log?page=${a.page||1}&page_size=${a.page_size||10}` }),
        get_products:       () => ({ method: 'GET', path: '/product/' }),
        get_rcs_list:       () => ({ method: 'GET', path: '/product/rcs/' }),
        get_rcs_detail:     (a) => ({ method: 'GET', path: `/product/rcs/${a.id}` }),
        get_rgs_list:       () => ({ method: 'GET', path: '/product/rgs/' }),
        get_rvh_list:       () => ({ method: 'GET', path: '/product/rvh/' }),
        get_domains:        () => ({ method: 'GET', path: '/product/domain/' }),
        get_domain_dns:     (a) => ({ method: 'GET', path: `/product/domain/${a.id}/dns` }),
        get_ssl_list:       () => ({ method: 'GET', path: '/product/ssl/' }),
        get_workorders:     () => ({ method: 'GET', path: '/product/workorder/' }),
        get_ros_list:       () => ({ method: 'GET', path: '/product/ros/' }),
        get_rcdn_list:      () => ({ method: 'GET', path: '/product/rcdn/' }),
        get_reward_list:    () => ({ method: 'GET', path: '/user/reward/list' }),
        get_withdraw_list:  () => ({ method: 'GET', path: '/user/reward/withdraw/list' }),
        get_announcements:  () => ({ method: 'GET', path: '/public/forum/announcement' }),
        get_nodes_status:   () => ({ method: 'GET', path: '/public/nodes/status' })
    };

    const SYSTEM_PROMPT = `你是雨云(RainYun)云平台的AI助手，运行在用户的浏览器中。你可以通过调用工具来查询用户的云资源信息。

你可以帮助用户查询：
- 用户信息、积分、余额、VIP等级
- 云服务器(RCS)、游戏云(RGS)、虚拟主机(RVH)的状态和详情
- 域名列表和DNS解析记录
- SSL证书、CDN、对象存储等
- 工单、积分奖励、提现记录
- 官方公告和节点状态

重要规则：
1. 仅支持查询操作，不支持修改、开关机、重装系统等写操作。如果用户要求写操作，请礼貌说明当前仅支持查询。
2. 用简洁的中文回答，重点突出用户关心的信息。
3. 如果查询结果较多，请总结关键信息，不要原样输出全部数据。
4. 如果用户问题不明确，先调用相关查询工具获取信息再回答。
5. 积分相关：总积分 = Points + PointsFromProduct + LockPoints，其中 LockPoints 为冻结积分。`;

    // ===== 聊天历史 =====
    let chatHistory = [];
    let isProcessing = false;

    // ===== 雨云 API 请求（官方 API Key 认证）=====
    async function rainyunFetch(path) {
        const resp = await fetch(RAINYUN_API + path, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': RAINYUN_API_KEY
            }
        });
        const data = await resp.json();
        if (!resp.ok) {
            return { error: `API错误 ${resp.status}`, detail: data };
        }
        return data;
    }

    // 执行工具调用
    async function executeTool(name, args) {
        const routeFn = TOOL_ROUTES[name];
        if (!routeFn) return JSON.stringify({ error: `未知工具: ${name}` });
        try {
            const route = routeFn(args || {});
            const result = await rainyunFetch(route.path);
            // 截断过长的结果，避免超出 token 限制
            let str = JSON.stringify(result);
            if (str.length > 6000) str = str.substring(0, 6000) + '...(已截断)';
            return str;
        } catch (e) {
            return JSON.stringify({ error: e.message });
        }
    }

    // ===== AI API 请求 =====
    async function callAI(messages) {
        const resp = await fetch(`${AI_BASE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AI_API_KEY}`
            },
            body: JSON.stringify({
                model: AI_MODEL,
                messages: messages,
                tools: TOOLS,
                tool_choice: 'auto',
                temperature: 0.3,
                max_tokens: 2000
            })
        });
        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`AI API错误 ${resp.status}: ${errText.substring(0, 200)}`);
        }
        return await resp.json();
    }

    // ===== 处理用户消息（Function Calling 循环）=====
    async function processMessage(userMessage) {
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...chatHistory,
            { role: 'user', content: userMessage }
        ];

        let iterations = 0;
        const maxIterations = 6;

        while (iterations++ < maxIterations) {
            const response = await callAI(messages);
            const msg = response.choices[0].message;
            messages.push(msg);

            // 没有 tool_calls，返回最终文本
            if (!msg.tool_calls || msg.tool_calls.length === 0) {
                chatHistory.push({ role: 'user', content: userMessage });
                chatHistory.push({ role: 'assistant', content: msg.content || '(无回复)' });
                // 限制历史长度
                if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
                return msg.content || '(无回复)';
            }

            // 执行所有工具调用
            for (const tc of msg.tool_calls) {
                const args = JSON.parse(tc.function.arguments || '{}');
                const result = await executeTool(tc.function.name, args);
                messages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: result
                });
            }
        }

        return '抱歉，处理过程过于复杂，请尝试简化您的问题。';
    }

    // ===== UI 构建 =====
    let panel = null;
    let messagesEl = null;
    let inputEl = null;
    let sendBtn = null;
    let fabBtn = null;

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .ai-fab {
                position: fixed; bottom: 24px; right: 24px;
                width: 50px; height: 50px; border-radius: 16px;
                background: ${C.primary}; cursor: pointer; z-index: 10001;
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 4px 16px rgba(0,122,255,0.3);
                transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
            }
            .ai-fab:hover { border-radius: 25px; box-shadow: 0 6px 24px rgba(0,122,255,0.4); }
            .ai-fab svg { width: 24px; height: 24px; }

            .ai-panel {
                position: fixed; bottom: 24px; right: 24px;
                width: 380px; height: 520px; max-height: 80vh;
                border-radius: 20px; z-index: 10002;
                background: ${C.bg};
                backdrop-filter: blur(24px) saturate(180%);
                -webkit-backdrop-filter: blur(24px) saturate(180%);
                border: 1px solid ${C.border};
                box-shadow: 0 12px 48px rgba(0,0,0,0.15);
                font-family: ${C.font};
                -webkit-font-smoothing: antialiased;
                display: flex; flex-direction: column;
                overflow: hidden;
                transform: scale(0.9) translateY(20px); opacity: 0;
                transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease;
            }
            .ai-panel.visible { transform: scale(1) translateY(0); opacity: 1; }

            .ai-header {
                padding: 16px 18px 12px; display: flex;
                justify-content: space-between; align-items: center;
                border-bottom: 1px solid ${C.border};
            }
            .ai-title { font-size: 16px; font-weight: 600; color: ${C.text}; display: flex; align-items: center; gap: 6px; }
            .ai-title-dot { width: 7px; height: 7px; border-radius: 50%; background: #34C759; }
            .ai-close {
                width: 28px; height: 28px; border-radius: 8px; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                color: ${C.sub}; font-size: 15px; transition: background 0.15s;
            }
            .ai-close:hover { background: ${C.card}; color: ${C.text}; }

            .ai-messages { flex: 1; overflow-y: auto; padding: 14px 16px; }
            .ai-messages::-webkit-scrollbar { width: 4px; }
            .ai-messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 2px; }

            .ai-msg { margin-bottom: 12px; display: flex; flex-direction: column; }
            .ai-msg.user { align-items: flex-end; }
            .ai-msg.ai { align-items: flex-start; }

            .ai-bubble {
                max-width: 82%; padding: 10px 14px; border-radius: 16px;
                font-size: 13.5px; line-height: 1.5; word-break: break-word;
                white-space: pre-wrap;
            }
            .ai-msg.user .ai-bubble {
                background: ${C.userBubble}; color: #fff;
                border-bottom-right-radius: 4px;
            }
            .ai-msg.ai .ai-bubble {
                background: ${C.aiBubble}; color: ${C.text};
                border-bottom-left-radius: 4px;
            }

            .ai-typing { display: flex; gap: 4px; padding: 12px 14px; }
            .ai-typing span {
                width: 6px; height: 6px; border-radius: 50%;
                background: ${C.sub}; animation: ai-bounce 1.2s infinite;
            }
            .ai-typing span:nth-child(2) { animation-delay: 0.2s; }
            .ai-typing span:nth-child(3) { animation-delay: 0.4s; }
            @keyframes ai-bounce {
                0%,60%,100% { transform: translateY(0); opacity: 0.4; }
                30% { transform: translateY(-6px); opacity: 1; }
            }

            .ai-input-area { padding: 10px 14px 14px; border-top: 1px solid ${C.border}; display: flex; gap: 8px; }
            .ai-input {
                flex: 1; border: 1px solid ${C.border}; border-radius: 12px;
                padding: 9px 12px; font-size: 13.5px; font-family: ${C.font};
                background: ${C.card}; color: ${C.text}; outline: none;
                transition: border-color 0.2s;
            }
            .ai-input:focus { border-color: ${C.primary}; }
            .ai-input::placeholder { color: ${C.sub}; }
            .ai-send {
                width: 36px; height: 36px; border-radius: 12px; border: none;
                background: ${C.primary}; color: #fff; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                transition: all 0.15s; flex-shrink: 0;
            }
            .ai-send:active { transform: scale(0.92); }
            .ai-send:disabled { opacity: 0.4; cursor: default; }

            .ai-welcome { color: ${C.sub}; font-size: 13px; text-align: center; margin-top: 40%; }
        `;
        document.head.appendChild(style);
    }

    function createFab() {
        fabBtn = document.createElement('div');
        fabBtn.className = 'ai-fab';
        fabBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`;
        fabBtn.title = 'AI 助手';
        fabBtn.addEventListener('click', togglePanel);
        document.body.appendChild(fabBtn);
    }

    function createPanel() {
        panel = document.createElement('div');
        panel.className = 'ai-panel';

        // 头部
        const header = document.createElement('div');
        header.className = 'ai-header';
        header.innerHTML = `
            <div class="ai-title"><span class="ai-title-dot"></span>AI 助手</div>
        `;
        const closeBtn = document.createElement('div');
        closeBtn.className = 'ai-close';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', togglePanel);
        header.appendChild(closeBtn);

        // 消息区
        messagesEl = document.createElement('div');
        messagesEl.className = 'ai-messages';

        // 欢迎语
        if (chatHistory.length === 0) {
            const welcome = document.createElement('div');
            welcome.className = 'ai-welcome';
            welcome.textContent = '你好！我是雨云AI助手，可以帮你查询服务器、域名、积分等信息。试试问我"我的云服务器状态怎么样"';
            messagesEl.appendChild(welcome);
        }

        // 输入区
        const inputArea = document.createElement('div');
        inputArea.className = 'ai-input-area';
        inputEl = document.createElement('input');
        inputEl.className = 'ai-input';
        inputEl.type = 'text';
        inputEl.placeholder = '输入你的问题...';
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        sendBtn = document.createElement('button');
        sendBtn.className = 'ai-send';
        sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
        sendBtn.addEventListener('click', handleSend);

        inputArea.appendChild(inputEl);
        inputArea.appendChild(sendBtn);

        panel.appendChild(header);
        panel.appendChild(messagesEl);
        panel.appendChild(inputArea);
        document.body.appendChild(panel);

        // 延迟显示动画
        requestAnimationFrame(() => panel.classList.add('visible'));
    }

    function togglePanel() {
        if (panel) {
            panel.classList.remove('visible');
            setTimeout(() => { panel.remove(); panel = null; }, 300);
        } else {
            createPanel();
        }
    }

    function addMessage(role, content) {
        // 移除欢迎语
        const welcome = messagesEl.querySelector('.ai-welcome');
        if (welcome) welcome.remove();

        const msgEl = document.createElement('div');
        msgEl.className = `ai-msg ${role === 'user' ? 'user' : 'ai'}`;

        const bubble = document.createElement('div');
        bubble.className = 'ai-bubble';
        bubble.textContent = content;
        msgEl.appendChild(bubble);

        messagesEl.appendChild(msgEl);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return bubble;
    }

    function addTypingIndicator() {
        const welcome = messagesEl.querySelector('.ai-welcome');
        if (welcome) welcome.remove();

        const msgEl = document.createElement('div');
        msgEl.className = 'ai-msg ai';
        msgEl.id = 'ai-typing-msg';
        msgEl.innerHTML = `<div class="ai-bubble"><div class="ai-typing"><span></span><span></span><span></span></div></div>`;
        messagesEl.appendChild(msgEl);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function removeTypingIndicator() {
        const el = document.getElementById('ai-typing-msg');
        if (el) el.remove();
    }

    async function handleSend() {
        const text = inputEl.value.trim();
        if (!text || isProcessing) return;

        // 检查 API Key
        if (!AI_API_KEY) {
            addMessage('ai', '请先在模块管理器中配置 AI API Key，然后刷新页面。');
            return;
        }
        if (!RAINYUN_API_KEY) {
            addMessage('ai', '请先在模块管理器中配置雨云 API Key（在雨云控制台设置页生成），然后刷新页面。');
            return;
        }

        isProcessing = true;
        sendBtn.disabled = true;
        inputEl.value = '';

        addMessage('user', text);
        addTypingIndicator();

        try {
            const reply = await processMessage(text);
            removeTypingIndicator();
            addMessage('ai', reply);
        } catch (e) {
            removeTypingIndicator();
            addMessage('ai', `出错了：${e.message}\n\n请检查 AI API 配置是否正确。`);
        } finally {
            isProcessing = false;
            sendBtn.disabled = false;
            inputEl.focus();
        }
    }

    // ===== 初始化 =====
    function init() {
        injectStyles();
        createFab();
        console.log('[AI助手] 模块已启动', AI_API_KEY ? `(模型: ${AI_MODEL})` : '(未配置 AI API Key)', RAINYUN_API_KEY ? '(雨云API: 已配置)' : '(雨云API: 未配置)');
    }

    init();
})();
