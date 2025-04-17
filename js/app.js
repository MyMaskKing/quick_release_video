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
function saveSitesToLocalStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sites));
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
        openAllBtn.textContent = '一键打开所有视频网站';
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

// 添加网站
function addSite() {
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
    
    // 检查是否有重复
    const isDuplicate = sites.some(site => site.url === url);
    if (isDuplicate) {
        showToast('此网站已经添加过了');
        return;
    }
    
    // 添加到数组
    sites.push({ name, url });
    
    // 保存并刷新
    if (saveSitesToLocalStorage()) {
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

// 初始化应用
document.addEventListener('DOMContentLoaded', initApp); 