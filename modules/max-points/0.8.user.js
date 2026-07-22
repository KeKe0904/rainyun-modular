(function() {
    'use strict';

    // 初始化模块
    function initModule() {
        // 监听URL变化（使用 history API + 事件，性能优于 MutationObserver 监听整个 document）
        let lastUrl = location.href;

        const onRouteChange = () => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                checkAndInject();
            }
        };

        // 拦截 pushState / replaceState，覆盖 SPA 内部跳转
        ['pushState', 'replaceState'].forEach(method => {
            const original = history[method];
            history[method] = function(...args) {
                const result = original.apply(this, args);
                onRouteChange();
                return result;
            };
        });
        window.addEventListener('popstate', onRouteChange);
        window.addEventListener('hashchange', onRouteChange);

        checkAndInject();
    }

    // 检查并注入按钮
    async function checkAndInject() {
        if (location.href === 'https://app.rainyun.com/account/reward/withdraw') {
            const input = await waitForElement('input[placeholder*="提现的积分"]', 5000);
            if (input && !document.getElementById('maxPointsBtn')) {
                injectMaxButton(input);
            }
        }
    }

    // 注入最大积分按钮
    function injectMaxButton(input) {
        // 创建按钮容器
        const btnGroup = document.createElement('div');
        btnGroup.className = 'input-group-append';

        // 创建按钮
        const btn = document.createElement('button');
        btn.id = 'maxPointsBtn';
        btn.className = 'btn btn-outline-primary';
        btn.type = 'button';
        btn.innerHTML = '填充最大积分';
        btn.style.cssText = 'white-space: nowrap; transition: all 0.3s;';

        // 添加点击事件
        btn.addEventListener('click', async () => {
            try {
                // 通过 API 获取用户数据
                const resp = await fetch('https://api.v2.rainyun.com/user/?no_cache=true', {
                    credentials: 'include'
                });
                if (!resp.ok) throw new Error('接口请求失败');
                const result = await resp.json();
                if (result.code !== 200 || !result.data) throw new Error('接口返回异常');

                const userData = result.data;
                // 雨云积分由三个独立字段组成（来源：雨云前端 GetPoints 实现）
                // 总积分(页面显示) = Points + PointsFromProduct + LockPoints
                // 可提现积分 = Points + PointsFromProduct（LockPoints 为冻结积分，不可提现）
                const points = userData.Points || 0;
                const pointsFromProduct = userData.PointsFromProduct || 0;
                const lockPoints = userData.LockPoints || 0;
                const totalPoints = points + pointsFromProduct + lockPoints;
                const availablePoints = points + pointsFromProduct;

                // 判断提现方式
                let feeRate = 0;
                let feeLabel = '无手续费';
                const alipayRadio = document.querySelector('input[type="radio"][value="alipay"]');
                if (alipayRadio && alipayRadio.checked) {
                    feeRate = 0.01; // 支付宝提现有1%手续费
                    feeLabel = '1%手续费';
                }

                // 计算最大可提现积分
                let maxWithdraw;
                if (feeRate > 0) {
                    // 公式：提现金额 + 提现金额×手续费 ≤ 可用积分 → 提现金额 ≤ 可用积分 ÷ (1 + feeRate)
                    maxWithdraw = Math.floor(availablePoints / (1 + feeRate));
                } else {
                    maxWithdraw = availablePoints;
                }

                // 检查是否达到最低提现额度（最低60000是指用户输入的提现额）
                if (maxWithdraw < 60000) {
                    showToast(`可提现积分不足（${maxWithdraw}），最低需60000积分`, 'warning');
                    return;
                }

                input.value = maxWithdraw;
                // 触发Vue数据更新
                const event = new Event('input', { bubbles: true });
                input.dispatchEvent(event);

                // 诊断信息：显示积分明细
                const totalDeduct = feeRate > 0 ? Math.ceil(maxWithdraw * (1 + feeRate)) : maxWithdraw;
                showToast(
                    `已填充：${maxWithdraw}（${feeLabel}，实扣${totalDeduct}）\n` +
                    `总积分${totalPoints}（含冻结${lockPoints}），可提现${availablePoints}`,
                    'success',
                    6000
                );
            } catch (e) {
                showToast('获取积分数据失败，请刷新页面', 'error');
                console.error(e);
            }
        });

        // 添加悬停效果
        btn.addEventListener('mouseover', () => {
            btn.style.transform = 'translateY(-1px)';
            btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
        });
        btn.addEventListener('mouseout', () => {
            btn.style.transform = 'none';
            btn.style.boxShadow = 'none';
        });

        // 插入到DOM
        btnGroup.appendChild(btn);
        input.closest('.input-group').appendChild(btnGroup);
    }

    // 显示提示信息
    function showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = 'custom-toast';
        // 使用 cssText 而非直接给 style 赋字符串，兼容性更好
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${getColor(type)};
            color: white;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            z-index: 9999;
            white-space: pre-line;
            max-width: 420px;
            line-height: 1.6;
        `;
        toast.textContent = message;

        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function getColor(type) {
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        return colors[type] || '#333';
    }

    // 等待元素加载
    function waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const check = () => {
                const el = document.querySelector(selector);
                if (el) {
                    resolve(el);
                } else if (Date.now() - start > timeout) {
                    reject(new Error('元素加载超时'));
                } else {
                    setTimeout(check, 200);
                }
            };
            check();
        });
    }

    // 添加CSS动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes custom-slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes custom-fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        .custom-toast {
            animation: custom-slideIn 0.3s ease-out;
        }
        .custom-toast.fade-out {
            animation: custom-fadeOut 0.3s ease-out;
        }
    `;
    document.head.appendChild(style);

    // 启动模块
    initModule();
})();
