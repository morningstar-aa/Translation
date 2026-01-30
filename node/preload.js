// Telegram Web K 翻译注入脚本
// 集成后端 API + 授权验证

// ========== 配置 ==========
// 后端服务地址（本地开发用线上，线上部署改为 127.0.0.1）
const API_BASE_URL = 'http://127.0.0.1:8089';

// 本地存储 key
const STORAGE_KEY_TOKEN = 'translator_token';
const STORAGE_KEY_EXPIRE = 'translator_expire';

// 授权状态
let isAuthorized = false;
let authToken = null;

// ========== 授权管理 ==========

/**
 * 检查本地存储的授权状态
 */
function checkLocalAuth() {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    const expireStr = localStorage.getItem(STORAGE_KEY_EXPIRE);

    if (!token || !expireStr) {
        console.log('[Translator] 未找到本地授权信息');
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
            body: JSON.stringify({ code, userId })
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
                'X-Auth-Token': authToken
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

    // 获取消息文本，排除时间元素
    const messageElement = bubbleElement.querySelector('.message.spoilers-container') ||
        bubbleElement.querySelector('.message') ||
        bubbleElement.querySelector('.text-content');
    if (!messageElement) return;

    // 克隆元素以便修改
    const clonedElement = messageElement.cloneNode(true);

    // 移除时间相关元素
    const timeElements = clonedElement.querySelectorAll('.time, .time-inner, .message-time, [class*="time"], .bubble-time');
    timeElements.forEach(el => el.remove());

    const text = clonedElement.textContent.trim();
    if (!text || text.length < 2) return;

    // 跳过时间格式
    if (isTimeFormat(text)) {
        bubbleElement.dataset.translated = 'skip-time';
        return;
    }

    let sourceLang = null;
    let targetLang = null;

    if (isPureEnglish(text)) {
        sourceLang = 'en';
        targetLang = 'zh-CN';
    } else if (containsChinese(text)) {
        const chineseChars = text.match(/[\u4e00-\u9fff]/g) || [];
        if (chineseChars.length > text.replace(/\s/g, '').length * 0.3) {
            sourceLang = 'zh-CN';
            targetLang = 'en';
        }
    }

    if (!sourceLang) {
        bubbleElement.dataset.translated = 'skip-lang';
        return;
    }

    bubbleElement.dataset.translated = 'processing';
    console.log('[Translator] 翻译中:', text.substring(0, 40));

    const translatedText = await translateText(text, sourceLang, targetLang);

    if (translatedText && translatedText.toLowerCase() !== text.toLowerCase()) {
        const bubbleContent = bubbleElement.querySelector('.bubble-content') || messageElement.parentElement;
        if (bubbleContent) {
            bubbleContent.appendChild(createTranslationElement(translatedText));
            bubbleElement.dataset.translated = 'done';
            console.log('[Translator] ✅', text.substring(0, 20), '->', translatedText.substring(0, 20));
        }
    } else {
        bubbleElement.dataset.translated = 'skip-same';
    }
}

// ========== 发送拦截 ==========

function setupSendInterceptor() {
    document.addEventListener('keydown', async (e) => {
        if (!isAuthorized) return;

        if (e.key === 'Enter' && !e.shiftKey) {
            const inputField = document.querySelector('.input-message-input');
            if (!inputField || document.activeElement !== inputField) return;

            const text = inputField.textContent.trim();
            if (!text || !containsChinese(text)) return;

            e.preventDefault();
            e.stopPropagation();

            const translated = await translateText(text, 'zh-CN', 'en');
            if (translated) {
                inputField.innerHTML = '';
                inputField.textContent = translated;
                inputField.dispatchEvent(new InputEvent('input', { bubbles: true }));

                setTimeout(() => {
                    const sendBtn = document.querySelector('.btn-send, .send-button');
                    if (sendBtn) sendBtn.click();
                }, 150);
            }
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
  `;
    document.head.appendChild(style);
}

// ========== 初始化翻译器 ==========

function initTranslator() {
    if (!isAuthorized) {
        console.log('[Translator] 未授权，等待激活');
        return;
    }

    setupMessageObserver();
    setupSendInterceptor();
    console.log('[Translator] ✅ 翻译器就绪');
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

window.addEventListener('DOMContentLoaded', () => {
    console.log('[Translator] 🔄 初始化...');
    injectStyles();

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
