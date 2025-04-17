/**
 * 快速视频发布助手
 * 允许用户配置视频网站链接，保存配置并一键打开所有配置的网站
 */

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

// 初始化应用
function initApp() {
    // 从本地存储加载配置
    loadSitesFromLocalStorage();
    
    // 渲染网站列表
    renderSiteList();
    
    // 添加事件监听器
    addEventListeners();
}

// 从本地存储加载配置
function loadSitesFromLocalStorage() {
    const storedSites = localStorage.getItem('quickReleaseVideoSites');
    sites = storedSites ? JSON.parse(storedSites) : [];
}

// 保存配置到本地存储
function saveSitesToLocalStorage() {
    localStorage.setItem('quickReleaseVideoSites', JSON.stringify(sites));
}

// 渲染网站列表
function renderSiteList() {
    siteListEl.innerHTML = '';
    
    if (sites.length === 0) {
        siteListEl.innerHTML = '<p class="empty-message">暂无配置的网站。请在下方添加视频发布网站。</p>';
        return;
    }
    
    sites.forEach((site, index) => {
        const siteItem = document.createElement('div');
        siteItem.className = 'site-item';
        siteItem.innerHTML = `
            <div class="site-info">
                <div class="site-name">${site.name}</div>
                <div class="site-url">${site.url}</div>
            </div>
            <div class="site-actions">
                <button data-index="${index}" class="delete-btn">删除</button>
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
}

// 添加网站
function addSite() {
    const name = siteNameInput.value.trim();
    let url = siteUrlInput.value.trim();
    
    // 验证输入
    if (name === '' || url === '') {
        alert('请输入网站名称和链接');
        return;
    }
    
    // 确保URL格式正确
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    // 添加到数组
    sites.push({ name, url });
    
    // 保存并刷新
    saveSitesToLocalStorage();
    renderSiteList();
    
    // 清空输入框
    siteNameInput.value = '';
    siteUrlInput.value = '';
}

// 删除网站
function deleteSite(index) {
    sites.splice(index, 1);
    saveSitesToLocalStorage();
    renderSiteList();
}

// 打开所有网站
function openAllSites() {
    if (sites.length === 0) {
        alert('请先添加视频发布网站');
        return;
    }
    
    sites.forEach(site => {
        window.open(site.url, '_blank');
    });
}

// 导出配置
function exportConfig() {
    if (sites.length === 0) {
        alert('没有可导出的配置');
        return;
    }
    
    const config = JSON.stringify(sites, null, 2);
    const blob = new Blob([config], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quick_release_video_config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
            saveSitesToLocalStorage();
            renderSiteList();
            alert('配置导入成功');
        } catch (error) {
            alert('配置导入失败: ' + error.message);
        }
    };
    
    reader.readAsText(file);
    // 重置 file input，允许再次选择同一个文件
    event.target.value = '';
}

// 添加事件监听器
function addEventListeners() {
    // 添加网站按钮
    addSiteBtn.addEventListener('click', addSite);
    
    // 回车添加网站
    siteUrlInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addSite();
        }
    });
    
    // 打开所有网站按钮
    openAllBtn.addEventListener('click', openAllSites);
    
    // 导出配置按钮
    exportConfigBtn.addEventListener('click', exportConfig);
    
    // 导入配置按钮
    importConfigInput.addEventListener('change', importConfig);
}

// 初始化应用
document.addEventListener('DOMContentLoaded', initApp); 