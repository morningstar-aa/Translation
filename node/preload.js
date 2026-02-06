const { contextBridge, ipcRenderer } = require('electron');

// Telegram Web K 翻译注入脚本
// 集成后端 API + 授权验证

// ========== 配置 ==========
// 后端服务地址（本地开发用线上，线上部署改为 127.0.0.1）
const API_BASE_URL = 'https://telegram.api.shangchenghu.shop';
// const API_BASE_URL = 'http://127.0.0.1:8089';
// 本地存储 key
const STORAGE_KEY_TOKEN = 'translator_token';
const STORAGE_KEY_EXPIRE = 'translator_expire';

// 授权状态
let isAuthorized = false;
let authToken = null;
let machineId = null; // 缓存机器码
let isSecondaryWindow = false; // 是否为副窗口

// ========== 授权管理 ==========

/**
 * 检查本地存储的授权状态
 */
function checkLocalAuth() {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    const expireStr = localStorage.getItem(STORAGE_KEY_EXPIRE);

    // 只需要 Token 和过期时间
    if (!token || !expireStr) {
        return false;
    }

    const expireTime = parseInt(expireStr);
    const now = Date.now();

    // 直接比较（后端返回的时间戳已经 +10秒）
    if (expireTime < now) {
        console.log('[Translator] 本地授权已过期');
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        localStorage.removeItem(STORAGE_KEY_EXPIRE);
        return false;
    }

    authToken = token;
    isAuthorized = true;
    console.log('[Translator] ✅ 本地授权有效，剩余:', Math.round((expireTime - now) / 1000 / 60), '分钟');
    return true;
}

/**
 * 保存授权信息到本地存储
 * 直接使用后端返回的过期时间戳（已经 +10秒）
 */
function saveLocalAuth(token, expireTimestamp) {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    localStorage.setItem(STORAGE_KEY_EXPIRE, String(expireTimestamp));
    authToken = token;
    isAuthorized = true;
}

/**
 * 获取当前登录的 Telegram 用户 ID
 */
function getTelegramUserId() {
    try {
        // 方法1: 从 Telegram Web K 的全局状态获取
        if (window.__WB_DISPATCH && window.__STATE__) {
            const userId = window.__STATE__?.authState?.userId;
            if (userId) return userId;
        }

        // 方法2: 从 localStorage 获取
        const authData = localStorage.getItem('user_auth');
        if (authData) {
            const parsed = JSON.parse(authData);
            if (parsed.id) return parsed.id;
        }

        // 方法3: 从页面 DOM 获取（备用）
        const profileLink = document.querySelector('a[href*="@"]');
        if (profileLink) {
            const match = profileLink.href.match(/\/(\d+)/);
            if (match) return parseInt(match[1]);
        }

        return null;
    } catch (e) {
        console.error('[Translator] 获取用户ID失败:', e);
        return null;
    }
}

/**
 * 检查是否已登录 Telegram
 */
function isTelegramLoggedIn() {
    // 检查是否有聊天列表（登录后才有）
    return !!document.querySelector('.chatlist-container, .chats-container, .chat-list');
}

/**
 * 显示激活码输入弹窗
 */
function showActivationDialog() {
    // 移除已有弹窗
    const existing = document.getElementById('translator-activation-dialog');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'translator-activation-dialog';
    overlay.innerHTML = `
        <div class="activation-overlay">
            <div class="activation-box">
                <h3>🔐 翻译功能授权</h3>
                <p>请输入激活码以启用翻译功能</p>
                <input type="text" id="activation-code-input" placeholder="请输入激活码" />
                <div class="activation-buttons">
                    <button id="activation-submit-btn">激活</button>
                    <button id="activation-cancel-btn">取消</button>
                </div>
                <p class="activation-status" id="activation-status"></p>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // 绑定事件
    document.getElementById('activation-submit-btn').onclick = handleActivation;
    document.getElementById('activation-cancel-btn').onclick = () => overlay.remove();
    document.getElementById('activation-code-input').focus();

    // 回车提交
    document.getElementById('activation-code-input').onkeydown = (e) => {
        if (e.key === 'Enter') handleActivation();
    };
}

/**
 * 处理激活请求
 */
async function handleActivation() {
    const codeInput = document.getElementById('activation-code-input');
    const statusEl = document.getElementById('activation-status');

    const code = codeInput.value.trim();

    if (!code) {
        statusEl.textContent = '请输入激活码';
        statusEl.style.color = '#ff6b6b';
        return;
    }

    // 自动获取 Telegram 用户 ID
    const userId = getTelegramUserId() || 0;
    console.log('[Translator] 用户 ID:', userId);

    statusEl.textContent = '正在验证...';
    statusEl.style.color = '#888';

    try {
        const response = await fetch(`${API_BASE_URL}/api/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, userId, deviceId: machineId }) // 激活时绑定机器码
        });

        const data = await response.json();

        if (data.success) {
            statusEl.textContent = '✅ 激活成功！';
            statusEl.style.color = '#4caf50';

            // 保存授权信息
            saveLocalAuth(data.token, data.expireTimestamp);

            // 延迟关闭弹窗
            setTimeout(() => {
                document.getElementById('translator-activation-dialog')?.remove();
                initTranslator();
            }, 1000);
        } else {
            statusEl.textContent = '❌ ' + (data.message || '激活失败');
            statusEl.style.color = '#ff6b6b';
        }
    } catch (error) {
        console.error('[Translator] 激活请求失败:', error);
        statusEl.textContent = '❌ 网络错误，请重试';
        statusEl.style.color = '#ff6b6b';
    }
}

// ========== 翻译 API ==========

/**
 * 调用后端翻译接口
 */
async function translateText(text, sourceLang, targetLang) {
    if (!isAuthorized || !authToken) {
        console.warn('[Translator] 未授权，无法翻译');
        return null;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': authToken,
                'X-Device-Id': machineId // 增加设备 ID 发送，防止多开
            },
            body: JSON.stringify({
                text,
                sourceLang: sourceLang === 'zh-CN' ? 'zh' : sourceLang,
                targetLang: targetLang === 'zh-CN' ? 'zh' : targetLang
            })
        });

        if (response.status === 401) {
            // 授权过期
            console.warn('[Translator] 授权已过期');
            isAuthorized = false;
            authToken = null;
            localStorage.removeItem(STORAGE_KEY_TOKEN);
            localStorage.removeItem(STORAGE_KEY_EXPIRE);
            showActivationDialog();
            return null;
        }

        const data = await response.json();

        if (data.success && data.translatedText) {
            return data.translatedText;
        }

        console.error('[Translator] 翻译失败:', data.error);
        return null;
    } catch (error) {
        console.error('[Translator] 翻译请求失败:', error);
        return null;
    }
}

// ========== 语言检测 ==========

/**
 * 检测是否是时间格式（跳过翻译）
 */
function isTimeFormat(text) {
    const trimmed = text.trim();

    // 常见时间格式匹配
    const timePatterns = [
        /^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM|am|pm)?$/,           // 12:30, 12:30:45, 12:30 PM
        /^\d{1,2}\s*(AM|PM|am|pm)$/,                            // 3 PM
        /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/,                       // 12/30, 12/30/2024
        /^\d{4}-\d{2}-\d{2}$/,                                   // 2024-01-30
        /^\d{1,2}\.\d{1,2}(\.\d{2,4})?$/,                       // 30.01.2024
        /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(,?\s+\d{4})?$/i,
        /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(,?\s+\d{4})?$/i,
        /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i,
        /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/i,
        /^(Today|Yesterday|Tomorrow)$/i,
        /^今天|昨天|明天|星期[一二三四五六日天]$/,
        /^\d+\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s*ago$/i,
        /^\d+\s*(秒|分钟?|小时|天|周|月|年)前$/,
        /^刚刚|just now$/i,
    ];

    return timePatterns.some(pattern => pattern.test(trimmed));
}

function isPureEnglish(text) {
    if (/[\u4e00-\u9fff]/.test(text)) return false;
    return /[a-zA-Z]/.test(text);
}

function containsChinese(text) {
    return /[\u4e00-\u9fff]/.test(text);
}

// ========== UI 相关 ==========

function createTranslationElement(translatedText) {
    const div = document.createElement('div');
    div.className = 'translated-text';
    div.innerHTML = `<span class="translation-icon">🌐</span> ${translatedText}`;
    return div;
}

// ========== 消息处理 ==========

async function processMessage(bubbleElement) {
    if (!isAuthorized) return;
    if (bubbleElement.dataset.translated) return;

    // 1. 尝试标准选择器
    let messageElement =
        bubbleElement.querySelector('.media-caption') ||
        bubbleElement.querySelector('.caption') ||
        bubbleElement.querySelector('.message.spoilers-container') ||
        bubbleElement.querySelector('.message') ||
        bubbleElement.querySelector('.text-content') ||
        bubbleElement.querySelector('.message-text');

    // 2. 如果标准选择器失败，尝试在 bubble-content 中寻找非 time 的文本节点
    if (!messageElement) {
        const content = bubbleElement.querySelector('.bubble-content');
        if (content) {
            // 排除已翻译的文本
            const potential = Array.from(content.children).find(child =>
                !child.classList.contains('translated-text') &&
                !child.classList.contains('time') &&
                child.textContent.trim().length > 1
            );
            if (potential) messageElement = potential;
        }
    }

    if (!messageElement) return;

    // 克隆元素以便修改，避免影响原始 DOM
    const clonedElement = messageElement.cloneNode(true);

    // 移除时间、表情符号标记、按钮等杂音
    const noise = clonedElement.querySelectorAll('.time, .time-inner, .message-time, [class*="time"], .bubble-time, .emoji, .btn-icon');
    noise.forEach(el => el.remove());

    const text = clonedElement.textContent.trim();
    if (!text || text.length < 2) return;

    // 跳过纯数字或时间格式
    if (isTimeFormat(text) || /^\d+$/.test(text)) {
        bubbleElement.dataset.translated = 'skip-noise';
        return;
    }

    let sourceLang = null;
    let targetLang = null;

    if (isPureEnglish(text)) {
        sourceLang = 'en';
        targetLang = 'zh-CN';
    } else if (containsChinese(text)) {
        // 只有中文字符占比达到一定程度才翻译为英文，避免误伤
        const chineseChars = text.match(/[\u4e00-\u9fff]/g) || [];
        if (chineseChars.length > 0) {
            sourceLang = 'zh-CN';
            targetLang = 'en';
        }
    }

    if (!sourceLang) {
        bubbleElement.dataset.translated = 'skip-lang';
        return;
    }

    bubbleElement.dataset.translated = 'processing';
    console.log('[Translator] 正在处理:', text.substring(0, 30));

    const translatedText = await translateText(text, sourceLang, targetLang);

    if (translatedText && translatedText.toLowerCase() !== text.toLowerCase()) {
        // 寻找合适的插入位置：通常是气泡内容的末尾
        const bubbleContent = bubbleElement.querySelector('.bubble-content') || messageElement.parentElement || bubbleElement;

        // 避免重复插入
        if (!bubbleContent.querySelector('.translated-text')) {
            bubbleContent.appendChild(createTranslationElement(translatedText));
            bubbleElement.dataset.translated = 'done';
            console.log('[Translator] ✅ 翻译完成');
        }
    } else {
        bubbleElement.dataset.translated = 'skip-no-result';
    }
}

// ========== 发送拦截 ==========

const sendingFlags = new Set(); // 记录正在处理发送的元素

function setupSendInterceptor() {
    document.addEventListener('keydown', async (e) => {
        try {
            if (!isAuthorized) return;

            if (e.key === 'Enter' && !e.shiftKey) {
                const activeEl = document.activeElement;
                if (!activeEl) return;

                // 检查是否已经在处理中，防止死循环
                if (sendingFlags.has(activeEl)) return;

                // 识别可输入区域
                const isContentEditable = activeEl.hasAttribute('contenteditable');
                const isInputOrTextArea = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA';
                if (!isContentEditable && !isInputOrTextArea) return;

                const text = isContentEditable ? activeEl.innerText : activeEl.value;
                if (!text || !text.trim()) return;

                // 如果不包含中文，直接让电报处理
                if (!containsChinese(text)) return;

                // 拦截原生发送
                e.preventDefault();
                e.stopImmediatePropagation();

                console.log('[Translator] 拦截并开始翻译:', text.substring(0, 15));
                sendingFlags.add(activeEl);

                const translated = await translateText(text.trim(), 'zh-CN', 'en');

                if (translated) {
                    console.log('[Translator] 翻译成功，准备安全注入');

                    if (isContentEditable) {
                        activeEl.focus();
                        // 尝试设置新内容。使用 textContent 往往比 innerHTML 更安全
                        activeEl.textContent = translated;
                    } else {
                        activeEl.value = translated;
                    }

                    // 显式触发输入事件，确保电报识别到变化
                    activeEl.dispatchEvent(new Event('input', { bubbles: true }));

                    // --- 关键改变：不直接 click 发送按钮，而是模拟一次“非中文”的 Enter ---
                    setTimeout(() => {
                        console.log('[Translator] 触发最终发送动作');
                        // 移除标记，以便下一次按键能正常捕获（虽然我们会立即模拟一次）
                        sendingFlags.delete(activeEl);

                        // 模拟 Enter 按键。因为此时文字已经是英文，containsChinese(text) 将为 false，
                        // 本拦截器会直接 return，从而让电报原本的监听器处理这次发送。
                        activeEl.dispatchEvent(new KeyboardEvent('keydown', {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true,
                            cancelable: true
                        }));
                    }, 50);
                } else {
                    console.warn('[Translator] 翻译异常，恢复');
                    sendingFlags.delete(activeEl);
                }
            }
        } catch (globalErr) {
            console.error('[Translator] 发送拦截异常:', globalErr);
            // 确保标记被清除
            if (document.activeElement) sendingFlags.delete(document.activeElement);
        }
    }, true);
}

// ========== 观察器 ==========

function setupMessageObserver() {
    const observer = new MutationObserver((mutations) => {
        if (!isAuthorized) return;

        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                if (node.classList?.contains('bubble')) processMessage(node);
                node.querySelectorAll?.('.bubble').forEach(b => processMessage(b));
            }
        }
    });

    const wait = setInterval(() => {
        const container = document.querySelector('.bubbles-group-container, .bubbles, .chat');
        if (container) {
            clearInterval(wait);
            observer.observe(container, { childList: true, subtree: true });
            console.log('[Translator] ✅ 消息监听已启动');

            setTimeout(() => {
                document.querySelectorAll('.bubble').forEach(b => processMessage(b));
            }, 500);
        }
    }, 1000);
}

// ========== 样式 ==========

function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
    /* 翻译样式 - 高对比度深色背景 */
    .translated-text {
      font-size: 13px;
      color: #fff;
      padding: 8px 12px;
      margin-top: 8px;
      background: rgba(0, 0, 0, 0.75);
      border-radius: 8px;
      line-height: 1.4;
    }
    .translated-text .translation-icon { 
      margin-right: 6px;
      opacity: 0.8;
    }
    .bubble.is-out .translated-text {
      background: rgba(0, 0, 0, 0.6);
      color: #fff;
    }
    html.night .translated-text { 
      background: rgba(255, 255, 255, 0.9); 
      color: #222;
    }
    html.night .bubble.is-out .translated-text {
      background: rgba(255, 255, 255, 0.85);
      color: #222;
    }
    
    /* 激活弹窗样式 */
    .activation-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 99999;
    }
    .activation-box {
      background: #fff;
      border-radius: 12px;
      padding: 24px 32px;
      width: 360px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    html.night .activation-box {
      background: #2b2b2b;
      color: #fff;
    }
    .activation-box h3 {
      margin: 0 0 12px 0;
      font-size: 18px;
    }
    .activation-box p {
      margin: 0 0 16px 0;
      color: #666;
      font-size: 14px;
    }
    html.night .activation-box p {
      color: #aaa;
    }
    .activation-box input {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 12px;
      box-sizing: border-box;
    }
    html.night .activation-box input {
      background: #3a3a3a;
      border-color: #555;
      color: #fff;
    }
    .activation-buttons {
      display: flex;
      gap: 12px;
    }
    .activation-buttons button {
      flex: 1;
      padding: 12px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .activation-buttons button:hover {
      opacity: 0.8;
    }
    #activation-submit-btn {
      background: #3390ec;
      color: #fff;
    }
    #activation-cancel-btn {
      background: #e0e0e0;
      color: #333;
    }
    html.night #activation-cancel-btn {
      background: #444;
      color: #fff;
    }
    .activation-status {
      margin-top: 12px !important;
      text-align: center;
      font-size: 13px !important;
    }
    
    /* 新窗口按钮样式 */
    .btn-new-window {
      position: absolute;
      top: 10px;
      right: 16px; /* 改为右侧定位，避免覆盖左侧菜单 */
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.05);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      transition: background 0.2s;
    }
    .btn-new-window:hover {
      background: rgba(51, 144, 236, 0.1);
    }
    html.night .btn-new-window {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    html.night .btn-new-window:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  `;

    // 副窗口特殊样式：不再隐藏菜单按钮，允许用户自行切换账号
    if (isSecondaryWindow) {
        console.log('[Translator] 检测到副窗口，保留菜单按钮以供切换账号');
        // 可选：添加一些标记样式区分
    }

    document.head.appendChild(style);
}

// ========== 初始化翻译器 ==========

async function initTranslator() {
    if (!isAuthorized) {
        console.log('[Translator] 未授权，等待激活');
        return;
    }

    setupMessageObserver();
    setupSendInterceptor();
    setupNewWindowButton(); // 注入新窗口按钮
    console.log('[Translator] ✅ 翻译器就绪');
}

/**
 * 注入“在新窗口打开”按钮
 */
function setupNewWindowButton() {
    // 如果是副窗口，不注入此按钮
    if (isSecondaryWindow) return;

    const checkHeader = setInterval(() => {
        const sidebarHeader = document.querySelector('.sidebar-header');
        if (sidebarHeader && !document.querySelector('.btn-new-window')) {
            const btn = document.createElement('button');
            btn.className = 'btn-new-window';
            btn.title = '在新窗口中打开';
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                </svg>
            `;

            btn.onclick = () => {
                ipcRenderer.send('open-new-window');
            };

            sidebarHeader.appendChild(btn);
            // 调整搜索栏位置避免遮挡 (可选，视实际布局而定)
            // sidebarHeader.style.paddingLeft = '50px'; 
            console.log('[Translator] ✅ 新窗口按钮已注入');
            clearInterval(checkHeader);
        }
    }, 1000);
}

/**
 * 等待 Telegram 登录完成
 */
function waitForTelegramLogin(callback) {
    console.log('[Translator] 等待 Telegram 登录...');

    const checkLogin = setInterval(() => {
        // 检查是否有聊天列表（登录后才有）
        const chatList = document.querySelector('.chatlist-container, .chats-container, .chat-list, .folders-container');
        const authForm = document.querySelector('.auth-form, .input-wrapper');

        if (chatList && !authForm) {
            clearInterval(checkLogin);
            console.log('[Translator] ✅ Telegram 已登录');
            callback();
        }
    }, 1000);

    // 最多等待 60 秒
    setTimeout(() => {
        clearInterval(checkLogin);
    }, 60000);
}

// ========== 主入口 ==========

window.addEventListener('DOMContentLoaded', async () => {
    console.log('[Translator] 🔄 初始化...');

    // 1. 并行获取机器码和窗口类型
    try {
        const [id, isSecondary] = await Promise.all([
            ipcRenderer.invoke('get-machine-id'),
            ipcRenderer.invoke('is-secondary-window')
        ]);

        machineId = id;
        isSecondaryWindow = isSecondary;
        console.log('[Translator] ✅ 初始化完成: ID=', machineId, '副窗口=', isSecondaryWindow);

        // 2. 注入样式 (此时 isSecondaryWindow 已有值)
        injectStyles();
    } catch (e) {
        console.error('[Translator] ❌ 初始化失败:', e);
        // 即使失败也尝试注入默认样式
        injectStyles();
    }

    // 等待 Telegram 登录完成
    waitForTelegramLogin(() => {
        setTimeout(() => {
            // 检查本地授权
            if (checkLocalAuth()) {
                initTranslator();
            } else {
                console.log('[Translator] 未找到授权，显示激活弹窗');
                showActivationDialog();
            }
        }, 1000);
    });
});
