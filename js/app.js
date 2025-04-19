/**
 * 快速视频发布助手
 * 允许用户配置视频网站链接，保存配置并一键打开所有配置的网站
 */

// 常量和配置
const STORAGE_KEY = 'quickReleaseVideoSites';
const WELCOMED_KEY = 'quickReleaseVideoWelcomed';
const DEBOUNCE_DELAY = 300;

// DOM元素
const siteListEl = document.getElementById('siteList');
const siteNameInput = document.getElementById('siteName');
const siteUrlInput = document.getElementById('siteUrl');
const addSiteBtn = document.getElementById('addSiteBtn');
const openAllBtn = document.getElementById('openAllBtn');
const exportConfigBtn = document.getElementById('exportConfigBtn');
const importConfigInput = document.getElementById('importConfigInput');

// WebDAV同步相关元素
const syncConfigBtn = document.getElementById('syncConfigBtn');
const webdavDialog = document.getElementById('webdavDialog');
const webdavServer = document.getElementById('webdavServer');
const webdavUsername = document.getElementById('webdavUsername');
const webdavPassword = document.getElementById('webdavPassword');
const testWebdavBtn = document.getElementById('testWebdavBtn');
const saveWebdavBtn = document.getElementById('saveWebdavBtn');
const closeWebdavBtn = document.getElementById('closeWebdavBtn');
const syncStatus = document.getElementById('syncStatus');
const autoSyncCheckbox = document.getElementById('autoSyncEnabled');
const manualSyncBtn = document.getElementById('manualSyncBtn');

// 存储网站配置的数组
let sites = [];

// 常用视频平台建议
const suggestionSites = [
    { name: "Bilibili", url: "https://member.bilibili.com/platform/upload/video/frame" },
    { name: "抖音", url: "https://creator.douyin.com/creator-micro/content/upload" },
    { name: "YouTube", url: "https://studio.youtube.com" },
    { name: "西瓜视频", url: "https://studio.ixigua.com/content" },
    { name: "腾讯视频", url: "https://v.qq.com/uploader/" }
];

// 工具函数 - 防抖
function debounce(func, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}

// 初始化应用
function initApp() {
    // 从本地存储加载配置
    loadSitesFromLocalStorage();
    
    // 渲染网站列表
    renderSiteList();
    
    // 添加事件监听器
    addEventListeners();
    
    // 显示欢迎提示（如果是首次使用）
    showWelcomeTipIfNeeded();
    
    // 初始化WebDAV配置
    initWebDAV();
    
    // 更新帮助链接
    document.getElementById('helpLink').href = 'cloud-sync-guide.md';
}

// 从本地存储加载配置
function loadSitesFromLocalStorage() {
    try {
        const storedSites = localStorage.getItem(STORAGE_KEY);
        sites = storedSites ? JSON.parse(storedSites) : [];
    } catch (error) {
        console.error('加载配置失败:', error);
        sites = [];
        showToast('加载配置失败，已重置为默认配置');
    }
}

// 保存配置到本地存储
async function saveSitesToLocalStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sites));
        // 只在站点列表变更时触发自动同步
        await autoSync();
        return true;
    } catch (error) {
        console.error('保存配置失败:', error);
        showToast('保存配置失败，请检查浏览器存储空间');
        return false;
    }
}

// 启用拖拽排序
function enableDragSort() {
    if (sites.length <= 1) return;
    
    const siteItems = document.querySelectorAll('.site-item');
    let draggedItem = null;
    
    siteItems.forEach(item => {
        // 添加拖拽指示器
        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.title = '拖动调整顺序';
        item.insertBefore(dragHandle, item.firstChild);
        
        // 设置拖拽属性
        item.setAttribute('draggable', 'true');
        
        // 拖拽事件
        item.addEventListener('dragstart', function(e) {
            draggedItem = this;
            setTimeout(() => this.classList.add('dragging'), 0);
            e.dataTransfer.effectAllowed = 'move';
        });
        
        item.addEventListener('dragend', function() {
            this.classList.remove('dragging');
            draggedItem = null;
            
            // 保存新顺序
            const newOrder = [];
            document.querySelectorAll('.site-item').forEach(item => {
                const index = parseInt(item.getAttribute('data-index'));
                newOrder.push(sites[index]);
            });
            
            sites = newOrder;
            saveSitesToLocalStorage();
            renderSiteList();
        });
        
        item.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        
        item.addEventListener('dragenter', function(e) {
            e.preventDefault();
            if (this !== draggedItem) {
                this.classList.add('drag-over');
            }
        });
        
        item.addEventListener('dragleave', function() {
            this.classList.remove('drag-over');
        });
        
        item.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
            
            if (this !== draggedItem) {
                const container = document.querySelector('.site-list');
                const allItems = Array.from(document.querySelectorAll('.site-item'));
                const draggedPos = allItems.indexOf(draggedItem);
                const droppedPos = allItems.indexOf(this);
                
                if (draggedPos < droppedPos) {
                    container.insertBefore(draggedItem, this.nextSibling);
                } else {
                    container.insertBefore(draggedItem, this);
                }
            }
        });
    });
}

// 渲染网站列表
function renderSiteList() {
    siteListEl.innerHTML = '';
    
    if (sites.length === 0) {
        renderEmptySuggestions();
        updateOpenButtonState(); // 确保在列表为空时更新按钮状态
        return;
    }
    
    sites.forEach((site, index) => {
        const siteItem = document.createElement('div');
        siteItem.className = 'site-item';
        siteItem.setAttribute('data-index', index);
        siteItem.innerHTML = `
            <div class="site-info">
                <div class="site-name">${escapeHtml(site.name)}</div>
                <div class="site-url">${escapeHtml(site.url)}</div>
            </div>
            <div class="site-actions">
                <button data-index="${index}" class="edit-btn" title="编辑此网站"></button>
                <button data-index="${index}" class="delete-btn" title="删除此网站"></button>
            </div>
        `;
        siteListEl.appendChild(siteItem);
    });
    
    // 添加删除按钮事件监听
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            deleteSite(index);
        });
    });
    
    // 添加编辑按钮事件监听
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            editSite(index);
        });
    });
    
    // 更新打开按钮状态
    updateOpenButtonState();
    
    // 启用拖拽排序
    enableDragSort();
}

// 渲染空列表和建议
function renderEmptySuggestions() {
    siteListEl.innerHTML = `
        <p class="empty-message">暂无配置的网站。请在下方添加视频发布网站，或者尝试以下常用平台：</p>
        <div class="suggestions">
            ${suggestionSites.map(site => 
                `<button class="suggestion-btn" data-name="${escapeHtml(site.name)}" data-url="${escapeHtml(site.url)}">${escapeHtml(site.name)}</button>`
            ).join('')}
        </div>
    `;
    
    // 添加建议站点的点击事件
    document.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const name = this.getAttribute('data-name');
            const url = this.getAttribute('data-url');
            siteNameInput.value = name;
            siteUrlInput.value = url;
            // 聚焦到添加按钮
            addSiteBtn.focus();
        });
    });
}

// HTML转义函数，防止XSS攻击
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 更新打开按钮状态
function updateOpenButtonState() {
    if (sites.length > 0) {
        openAllBtn.textContent = `一键打开全部 ${sites.length} 个网站`;
        openAllBtn.classList.remove('disabled');
    } else {
        openAllBtn.textContent = '一键打开全部网站';
        openAllBtn.classList.add('disabled');
    }
}

// 验证URL是否有效
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

// 编辑网站
function editSite(index) {
    if (index < 0 || index >= sites.length) return;
    
    const site = sites[index];
    
    // 填充编辑表单
    siteNameInput.value = site.name;
    siteUrlInput.value = site.url;
    
    // 更改添加按钮为保存按钮
    addSiteBtn.textContent = '保存修改';
    addSiteBtn.classList.add('editing');
    addSiteBtn.setAttribute('data-edit-index', index);
    
    // 聚焦到名称输入框
    siteNameInput.focus();
    
    // 滚动到编辑区域
    addSiteBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // 添加取消编辑按钮
    if (!document.getElementById('cancelEditBtn')) {
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancelEditBtn';
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'cancel-btn';
        cancelBtn.addEventListener('click', cancelEdit);
        
        // 添加到DOM
        addSiteBtn.parentNode.insertBefore(cancelBtn, addSiteBtn.nextSibling);
    }
}

// 取消编辑
function cancelEdit() {
    // 重置表单
    siteNameInput.value = '';
    siteUrlInput.value = '';
    
    // 恢复添加按钮
    addSiteBtn.textContent = '添加网站';
    addSiteBtn.classList.remove('editing');
    addSiteBtn.removeAttribute('data-edit-index');
    
    // 移除取消按钮
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) {
        cancelBtn.parentNode.removeChild(cancelBtn);
    }
    
    // 聚焦到名称输入框
    siteNameInput.focus();
}

// 添加网站
async function addSite() {
    const name = siteNameInput.value.trim();
    let url = siteUrlInput.value.trim();
    
    // 验证输入
    if (name === '' || url === '') {
        showToast('请输入网站名称和链接');
        return;
    }
    
    // 确保URL格式正确
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    // 验证URL格式
    if (!isValidUrl(url)) {
        showToast('请输入有效的网站链接');
        return;
    }
    
    // 检查是否是编辑模式
    if (addSiteBtn.classList.contains('editing')) {
        const editIndex = parseInt(addSiteBtn.getAttribute('data-edit-index'));
        
        // 检查是否与其他网站重复（不包括当前编辑的网站）
        const isDuplicate = sites.some((site, index) => index !== editIndex && site.url === url);
        if (isDuplicate) {
            showToast('此网站已经添加过了');
            return;
        }
        
        // 更新站点数据
        sites[editIndex] = { name, url };
        
        // 保存并刷新
        if (await saveSitesToLocalStorage()) {
            renderSiteList();
            
            // 重置表单和按钮
            cancelEdit();
            
            // 显示成功提示
            showToast(`已成功更新 ${name}`);
        }
        
        return;
    }
    
    // 添加新网站模式
    
    // 检查是否有重复
    const isDuplicate = sites.some(site => site.url === url);
    if (isDuplicate) {
        showToast('此网站已经添加过了');
        return;
    }
    
    // 添加到数组
    sites.push({ name, url });
    
    // 保存并刷新
    if (await saveSitesToLocalStorage()) {
        renderSiteList();
        
        // 显示成功提示
        showToast(`已成功添加 ${name}`);
        
        // 清空输入框
        siteNameInput.value = '';
        siteUrlInput.value = '';
        siteNameInput.focus();
    }
}

// 删除网站
function deleteSite(index) {
    if (index < 0 || index >= sites.length) return;
    
    const siteName = sites[index].name;
    sites.splice(index, 1);
    
    if (saveSitesToLocalStorage()) {
        renderSiteList();
        showToast(`已删除 ${siteName}`);
    }
}

// 打开所有网站
function openAllSites() {
    if (sites.length === 0) {
        showToast('请先添加视频发布网站');
        return;
    }
    
    let openedCount = 0;
    
    // 依次打开所有站点，使用较小延迟避免浏览器拦截
    function openSiteWithDelay(index) {
        if (index >= sites.length) {
            showToast(`已成功打开 ${openedCount} 个视频网站`);
            return;
        }
        
        const site = sites[index];
        
        try {
            // 简单地在新标签页打开
            window.open(site.url, '_blank');
            openedCount++;
        } catch(e) {
            console.error('打开网站失败:', e);
        }
        
        // 延迟打开下一个，避免被浏览器拦截
        setTimeout(() => {
            openSiteWithDelay(index + 1);
        }, 300);
    }
    
    // 开始打开第一个网站
    openSiteWithDelay(0);
    
    showToast('正在打开视频网站...');
}

// 转义JavaScript字符串
function escapeJS(str) {
    return str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

// 生成站点列表页面
function generateSitesPage() {
    // 准备网站链接HTML
    const linksHtml = sites.map(site => 
        `<li><a href="${escapeHtml(site.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(site.name)}</a></li>`
    ).join('');
    
    // 创建一个包含所有链接的HTML页面
    return `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';">
            <title>视频发布平台</title>
            <style>
                body {
                    font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
                    line-height: 1.6;
                    color: #333;
                    background-color: #f7f9fc;
                    margin: 0;
                    padding: 20px;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    background-color: #fff;
                    padding: 30px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                }
                h1 {
                    color: #3f51b5;
                    margin-bottom: 20px;
                    text-align: center;
                }
                p {
                    text-align: center;
                    margin-bottom: 30px;
                    color: #666;
                }
                ul {
                    list-style-type: none;
                    padding: 0;
                    margin: 0;
                }
                li {
                    margin-bottom: 15px;
                    padding: 15px;
                    background-color: #f8f9fa;
                    border-radius: 4px;
                    border-left: 3px solid #3f51b5;
                    transition: all 0.2s ease;
                }
                li:hover {
                    background-color: #f0f2ff;
                    transform: translateY(-2px);
                    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.05);
                }
                a {
                    color: #3f51b5;
                    text-decoration: none;
                    font-weight: 500;
                    font-size: 1.1rem;
                    display: block;
                }
                a:hover {
                    text-decoration: underline;
                }
                .btn-container {
                    text-align: center;
                    margin-top: 30px;
                }
                .open-all-btn {
                    background-color: #3f51b5;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 12px 25px;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .open-all-btn:hover {
                    background-color: #303f9f;
                    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
                }
                .status {
                    text-align: center;
                    margin-top: 20px;
                    font-size: 0.9rem;
                    color: #888;
                    display: none;
                }
                .counter {
                    font-weight: bold;
                    color: #3f51b5;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>视频发布平台</h1>
                <p>点击下方链接打开各个视频网站，或使用下方按钮一键打开所有网站</p>
                <ul id="siteLinks">${linksHtml}</ul>
                <div class="btn-container">
                    <button class="open-all-btn" id="openAllBtn">一键打开所有视频网站</button>
                </div>
                <div class="status" id="status">
                    已打开 <span class="counter" id="counter">0</span>/${sites.length} 个网站
                </div>
            </div>

            <script>
                // 当页面加载完成后执行
                document.addEventListener('DOMContentLoaded', function() {
                    // 获取元素
                    const openAllBtn = document.getElementById('openAllBtn');
                    const links = document.querySelectorAll('#siteLinks a');
                    const status = document.getElementById('status');
                    const counter = document.getElementById('counter');
                    
                    // 跟踪打开的网站数量
                    let openCount = 0;
                    
                    // 为每个链接添加点击事件
                    links.forEach(link => {
                        link.addEventListener('click', function(e) {
                            // 阻止默认行为
                            e.preventDefault();
                            
                            // 打开链接
                            const newWindow = window.open(this.href, '_blank');
                            
                            if (newWindow) {
                                // 标记为已访问
                                this.parentNode.classList.add('visited');
                                
                                // 更新计数
                                openCount++;
                                updateCounter();
                            } else {
                                alert('浏览器阻止了弹出窗口，请允许弹出窗口后重试');
                            }
                        });
                    });
                    
                    // 一键打开所有网站
                    openAllBtn.addEventListener('click', function() {
                        let successful = 0;
                        
                        links.forEach(link => {
                            try {
                                const newWindow = window.open(link.href, '_blank');
                                if (newWindow) {
                                    link.parentNode.classList.add('visited');
                                    successful++;
                                }
                            } catch (e) {
                                console.error('打开网站失败:', e);
                            }
                        });
                        
                        // 更新打开状态
                        openCount = successful;
                        updateCounter();
                        
                        if (successful === 0) {
                            alert('浏览器阻止了弹出窗口，请允许弹出窗口后重试');
                        } else if (successful < links.length) {
                            alert('部分网站被拦截，只成功打开了 ' + successful + ' 个网站');
                        }
                    });
                    
                    // 更新计数显示
                    function updateCounter() {
                        counter.textContent = openCount;
                        status.style.display = 'block';
                    }
                    
                    // 自动聚焦到按钮
                    openAllBtn.focus();
                    
                    // 添加样式
                    document.head.insertAdjacentHTML('beforeend', 
                    '<style>' +
                    '.visited { opacity: 0.6; }' +
                    '.visited a { color: #666; }' +
                    '.visited a::after { content: " (已打开)"; font-size: 0.8rem; color: #888; }' +
                    '</style>');
                });
            </script>
        </body>
        </html>
    `;
}

// 导出配置
function exportConfig() {
    if (sites.length === 0) {
        showToast('没有可导出的配置');
        return;
    }
    
    try {
        const config = JSON.stringify(sites, null, 2);
        const blob = new Blob([config], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `quick_release_video_config_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('配置已成功导出');
    } catch (error) {
        console.error('导出配置失败:', error);
        showToast('导出配置失败');
    }
}

// 导入配置
function importConfig(event) {
    const file = event.target.files[0];
    
    if (!file) {
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedSites = JSON.parse(e.target.result);
            
            if (!Array.isArray(importedSites)) {
                throw new Error('配置格式不正确');
            }
            
            // 验证导入的每个网站
            for (const site of importedSites) {
                if (!site.name || !site.url) {
                    throw new Error('配置格式不正确');
                }
            }
            
            // 导入成功
            sites = importedSites;
            
            if (saveSitesToLocalStorage()) {
                renderSiteList();
                showToast(`成功导入了 ${sites.length} 个网站配置`);
            }
        } catch (error) {
            showToast('配置导入失败: ' + error.message);
        }
    };
    
    reader.readAsText(file);
    // 重置 file input，允许再次选择同一个文件
    event.target.value = '';
}

// 显示欢迎提示
function showWelcomeTipIfNeeded() {
    const hasShownWelcome = localStorage.getItem(WELCOMED_KEY);
    if (!hasShownWelcome && sites.length === 0) {
        setTimeout(() => {
            showToast('欢迎使用快速视频发布助手！请添加您常用的视频网站。', 5000);
            localStorage.setItem(WELCOMED_KEY, 'true');
        }, 1000);
    }
}

// 显示提示消息
function showToast(message, duration = 3000) {
    // 移除现有的 toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // 显示 toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // 隐藏并移除 toast
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);
}

// 添加事件监听器
function addEventListeners() {
    // 添加网站按钮
    addSiteBtn.addEventListener('click', addSite);
    
    // 回车添加网站 (使用防抖处理)
    const debouncedAddSite = debounce(addSite, DEBOUNCE_DELAY);
    
    siteUrlInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            debouncedAddSite();
        }
    });
    
    siteNameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            siteUrlInput.focus();
        }
    });
    
    // 打开所有网站按钮
    openAllBtn.addEventListener('click', openAllSites);
    
    // 导出配置按钮
    exportConfigBtn.addEventListener('click', exportConfig);
    
    // 导入配置按钮
    importConfigInput.addEventListener('change', importConfig);
    
    // 添加键盘快捷键
    document.addEventListener('keydown', function(e) {
        // Alt+O: 打开所有网站
        if (e.altKey && e.key === 'o' && !openAllBtn.classList.contains('disabled')) {
            e.preventDefault();
            openAllSites();
        }
        
        // Alt+A: 聚焦到添加输入框
        if (e.altKey && e.key === 'a') {
            e.preventDefault();
            siteNameInput.focus();
        }
    });
}

// 显示同步状态
function showSyncStatus(message, type = 'info') {
    syncStatus.textContent = message;
    syncStatus.className = 'sync-status ' + type;
    setTimeout(() => {
        syncStatus.className = 'sync-status';
    }, 5000);
}

// 初始化WebDAV配置
function initWebDAV() {
    const manualSyncBtn = document.getElementById('manualSyncBtn');
    
    // 检查WebDAV配置状态
    if (window.webDAVSync.config.syncEnabled) {
        webdavServer.value = window.webDAVSync.config.server;
        webdavUsername.value = window.webDAVSync.config.username;
        webdavPassword.value = window.webDAVSync.config.password;
        autoSyncCheckbox.checked = window.webDAVSync.isAutoSyncEnabled();
        
        // 更新UI状态
        syncConfigBtn.classList.add('active');
        manualSyncBtn.style.display = 'inline-flex';
        
        // 在主界面显示手动同步按钮
        const configActions = document.querySelector('.config-actions');
        if (configActions && !configActions.contains(manualSyncBtn)) {
            configActions.appendChild(manualSyncBtn);
        }
    }
}

// 打开WebDAV配置对话框
syncConfigBtn.addEventListener('click', () => {
    webdavDialog.classList.add('show');
    initWebDAV();
});

// 关闭对话框
closeWebdavBtn.addEventListener('click', () => {
    webdavDialog.classList.remove('show');
});

// 自动同步开关
autoSyncCheckbox.addEventListener('change', (e) => {
    window.webDAVSync.setAutoSync(e.target.checked);
    showSyncStatus(e.target.checked ? '已开启自动同步' : '已关闭自动同步', 'info');
});

// 手动同步按钮事件处理
manualSyncBtn.addEventListener('click', async () => {
    if (!window.webDAVSync.config.syncEnabled) {
        showToast('请先配置WebDAV设置');
        return;
    }

    try {
        // 显示同步中状态
        manualSyncBtn.disabled = true;
        manualSyncBtn.classList.add('syncing');
        showToast('正在同步配置到云端...');
        
        // 执行同步
        await window.webDAVSync.uploadConfig(sites);
        
        // 显示成功消息
        showToast('云同步成功！配置已保存到云端');
    } catch (error) {
        // 显示错误消息
        showToast('云同步失败: ' + error.message);
    } finally {
        // 恢复按钮状态
        manualSyncBtn.disabled = false;
        manualSyncBtn.classList.remove('syncing');
    }
});

// 在保存配置时自动同步
async function autoSync() {
    // 检查是否启用了自动同步
    if (!window.webDAVSync.config.syncEnabled || !window.webDAVSync.isAutoSyncEnabled()) {
        return;
    }
    
    try {
        syncConfigBtn.classList.add('syncing');
        showToast('正在自动同步到云端...');
        await window.webDAVSync.uploadConfig(sites);
        showToast('自动同步成功！配置已保存到云端');
    } catch (error) {
        console.error('自动同步失败:', error);
        showToast('自动同步失败: ' + error.message);
    } finally {
        syncConfigBtn.classList.remove('syncing');
    }
}

// 添加从云端恢复配置的功能
async function restoreFromCloud() {
    if (!window.webDAVSync.config.syncEnabled) return;
    
    try {
        const cloudConfig = await window.webDAVSync.downloadConfig();
        if (cloudConfig && Array.isArray(cloudConfig)) {
            sites = cloudConfig;
            saveSitesToLocalStorage();
            renderSiteList();
            showToast('已从云端恢复配置');
        }
    } catch (error) {
        console.error('从云端恢复配置失败:', error);
        showToast('恢复失败: ' + error.message);
    }
}

// 在页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    // 尝试从云端恢复配置
    restoreFromCloud().catch(error => {
        console.error('从云端恢复配置失败:', error);
    });
});

// 保存WebDAV配置的逻辑
saveWebdavBtn.addEventListener('click', async () => {
    const server = webdavServer.value.trim();
    const username = webdavUsername.value.trim();
    const password = webdavPassword.value.trim();
    const autoSync = autoSyncCheckbox.checked;

    if (!server || !username || !password) {
        showSyncStatus('请填写完整的WebDAV配置信息', 'error');
        return;
    }

    // 禁用保存按钮，显示加载状态
    saveWebdavBtn.disabled = true;
    saveWebdavBtn.textContent = '保存中...';
    showSyncStatus('正在测试连接...', 'info');

    try {
        // 临时配置用于测试
        const tempConfig = {
            server: server.endsWith('/') ? server : server + '/',
            username,
            password,
            syncEnabled: true
        };
        
        // 设置临时配置进行测试
        window.webDAVSync.config = tempConfig;
        
        // 测试连接
        await window.webDAVSync.testConnection();
        
        // 保存配置
        window.webDAVSync.saveConfig(server, username, password, autoSync);
        
        // 显示手动同步按钮
        const manualSyncBtn = document.getElementById('manualSyncBtn');
        manualSyncBtn.style.display = 'inline-flex';
        
        // 确保手动同步按钮在主界面显示
        const configActions = document.querySelector('.config-actions');
        if (configActions && !configActions.contains(manualSyncBtn)) {
            configActions.appendChild(manualSyncBtn);
        }
        
        showSyncStatus('WebDAV配置已保存', 'success');
        syncConfigBtn.classList.add('active');
        
        // 关闭对话框
        setTimeout(() => {
            webdavDialog.classList.remove('show');
        }, 1000);
    } catch (error) {
        showSyncStatus('配置测试失败: ' + error.message, 'error');
    } finally {
        // 恢复保存按钮状态
        saveWebdavBtn.disabled = false;
        saveWebdavBtn.textContent = '保存设置';
    }
});

// 清除WebDAV配置时不隐藏手动同步按钮
function clearWebDAVConfig() {
    window.webDAVSync.clearConfig();
    syncConfigBtn.classList.remove('active');
    
    // 重置表单
    webdavServer.value = '';
    webdavUsername.value = '';
    webdavPassword.value = '';
    autoSyncCheckbox.checked = true;
}

// 测试WebDAV连接
testWebdavBtn.addEventListener('click', async () => {
    const server = webdavServer.value.trim();
    const username = webdavUsername.value.trim();
    const password = webdavPassword.value.trim();

    if (!server || !username || !password) {
        showSyncStatus('请填写完整的WebDAV配置信息', 'error');
        return;
    }

    // 提示用户可能的混合内容问题
    if (window.location.protocol === 'https:' && server.startsWith('http://')) {
        showSyncStatus('提示：您正在通过HTTPS访问网站，可能无法连接到HTTP的WebDAV服务。如果测试失败，请考虑使用HTTPS地址。', 'info');
    }

    try {
        // 显示测试中状态
        showSyncStatus('正在测试连接...', 'info');
        testWebdavBtn.disabled = true;
        testWebdavBtn.textContent = '测试中...';
        
        // 创建临时WebDAV对象进行测试
        const tempWebDAV = new WebDAVSync();
        tempWebDAV.config = {
            server: server.endsWith('/') ? server : server + '/',
            username: username,
            password: password,
            syncEnabled: true
        };
        
        // 测试连接
        await tempWebDAV.testConnection();
        
        showSyncStatus('连接测试成功！用户名和密码验证通过', 'success');
    } catch (error) {
        // 自定义错误消息，特别处理混合内容错误
        if (error.message.includes('Failed to fetch') && window.location.protocol === 'https:' && server.startsWith('http://')) {
            showSyncStatus('连接测试失败：可能是由于混合内容限制。您正通过HTTPS访问此页面，浏览器阻止了HTTP的WebDAV连接。您可以尝试使用HTTPS的WebDAV地址，或在HTTP环境下使用此工具。', 'error');
        } else {
            showSyncStatus('连接测试失败: ' + error.message, 'error');
        }
    } finally {
        testWebdavBtn.disabled = false;
        testWebdavBtn.textContent = '测试连接';
    }
}); 