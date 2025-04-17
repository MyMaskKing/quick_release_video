/**
 * WebDAV同步功能
 * 用于将配置同步到WebDAV服务器
 */
class WebDAVSync {
    constructor() {
        this.config = {
            server: localStorage.getItem('webdav_server') || '',
            username: localStorage.getItem('webdav_username') || '',
            password: localStorage.getItem('webdav_password') || '',
            syncEnabled: localStorage.getItem('webdav_enabled') === 'true',
            autoSync: localStorage.getItem('webdav_auto_sync') !== 'false' // 默认开启自动同步
        };
    }

    // 保存WebDAV配置
    saveConfig(server, username, password, autoSync = true) {
        // 确保server以/结尾
        server = server.endsWith('/') ? server : server + '/';
        
        this.config.server = server;
        this.config.username = username;
        this.config.password = password;
        this.config.syncEnabled = true;
        this.config.autoSync = autoSync;

        localStorage.setItem('webdav_server', server);
        localStorage.setItem('webdav_username', username);
        localStorage.setItem('webdav_password', password);
        localStorage.setItem('webdav_enabled', 'true');
        localStorage.setItem('webdav_auto_sync', autoSync.toString());

        return true;
    }

    // 设置自动同步状态
    setAutoSync(enabled) {
        this.config.autoSync = enabled;
        localStorage.setItem('webdav_auto_sync', enabled.toString());
    }

    // 获取自动同步状态
    isAutoSyncEnabled() {
        return this.config.autoSync;
    }

    // 清除WebDAV配置
    clearConfig() {
        this.config = {
            server: '',
            username: '',
            password: '',
            syncEnabled: false
        };

        localStorage.removeItem('webdav_server');
        localStorage.removeItem('webdav_username');
        localStorage.removeItem('webdav_password');
        localStorage.removeItem('webdav_enabled');
    }

    // 创建基本认证头
    _createAuthHeader() {
        return 'Basic ' + btoa(this.config.username + ':' + this.config.password);
    }

    // 处理WebDAV响应
    async _handleResponse(response, ignoreNotFound = false) {
        if (response.ok || (ignoreNotFound && response.status === 404)) {
            return response;
        }
        
        let errorMessage = `HTTP错误 ${response.status}`;
        try {
            const text = await response.text();
            if (text) {
                errorMessage += ': ' + text;
            }
        } catch (e) {
            // 忽略错误文本解析失败
        }

        // 添加更友好的错误提示
        if (response.status === 403) {
            errorMessage = '访问被拒绝，请检查用户名和密码是否正确';
        } else if (response.status === 404) {
            errorMessage = '找不到指定的文件或目录，正在尝试创建...';
            return { status: 404 };
        } else if (response.status === 401) {
            errorMessage = '认证失败，请检查用户名和密码';
        }
        
        throw new Error(errorMessage);
    }

    // 测试WebDAV连接
    async testConnection() {
        if (!this.config.server || !this.config.username || !this.config.password) {
            throw new Error('请填写完整的WebDAV配置信息');
        }

        const headers = {
            'Authorization': this._createAuthHeader()
        };

        try {
            // 首先尝试PROPFIND请求
            let response = await fetch(this.config.server, {
                method: 'PROPFIND',
                headers: {
                    ...headers,
                    'Depth': '0'
                }
            });

            // 检查响应状态
            if (response.ok || response.status === 207) {
                return true;
            }

            // 如果PROPFIND失败，尝试OPTIONS请求
            if (!response.ok) {
                response = await fetch(this.config.server, {
                    method: 'OPTIONS',
                    headers: headers
                });
            }

            // 特殊处理403错误
            if (response.status === 403) {
                throw new Error('访问被拒绝，请检查用户名和密码是否正确');
            }

            // 如果返回404，说明路径不存在
            if (response.status === 404) {
                throw new Error('指定的WebDAV路径不存在，请检查服务器地址是否正确');
            }

            if (!response.ok) {
                throw new Error('服务器返回状态码: ' + response.status);
            }

            return true;
        } catch (error) {
            console.error('连接测试失败:', error);
            if (error.message.includes('Failed to fetch')) {
                throw new Error('无法连接到服务器，请检查服务器地址是否正确');
            }
            throw error;
        }
    }

    // 创建目录
    async _createDirectory() {
        const headers = {
            'Authorization': this._createAuthHeader()
        };

        try {
            // 首先检查目录是否存在
            const checkResponse = await fetch(this.config.server, {
                method: 'PROPFIND',
                headers: {
                    ...headers,
                    'Depth': '0'
                }
            });

            // 如果目录已存在，直接返回成功
            if (checkResponse.ok || checkResponse.status === 207) {
                return true;
            }

            // 如果目录不存在，尝试创建
            if (checkResponse.status === 404) {
                const createResponse = await fetch(this.config.server, {
                    method: 'MKCOL',
                    headers: headers
                });

                if (createResponse.ok || createResponse.status === 201) {
                    return true;
                }
            }

            throw new Error('创建目录失败，状态码: ' + checkResponse.status);
        } catch (error) {
            console.error('创建目录失败:', error);
            throw new Error('创建目录失败: ' + error.message);
        }
    }

    // 上传配置到WebDAV
    async uploadConfig(sites) {
        if (!this.config.syncEnabled) {
            throw new Error('WebDAV同步未启用');
        }

        const configData = JSON.stringify(sites, null, 2);
        const headers = {
            'Authorization': this._createAuthHeader(),
            'Content-Type': 'application/json'
        };

        try {
            // 确保目录存在
            await this._createDirectory();

            // 上传文件
            const response = await fetch(this.config.server + 'quick_release_video_config.json', {
                method: 'PUT',
                headers: headers,
                body: configData
            });

            if (!response.ok) {
                throw new Error('上传文件失败，状态码: ' + response.status);
            }

            return true;
        } catch (error) {
            console.error('上传配置失败:', error);
            throw error;
        }
    }

    // 从WebDAV下载配置
    async downloadConfig() {
        if (!this.config.syncEnabled) {
            throw new Error('WebDAV同步未启用');
        }

        const headers = {
            'Authorization': this._createAuthHeader()
        };

        try {
            const response = await fetch(this.config.server + 'quick_release_video_config.json', {
                method: 'GET',
                headers: headers
            });

            if (response.status === 404) {
                // 文件不存在，返回空数组
                return [];
            }

            await this._handleResponse(response);
            return await response.json();
        } catch (error) {
            console.error('下载配置失败:', error);
            throw error;
        }
    }
}

// 创建全局WebDAV同步实例
window.webDAVSync = new WebDAVSync(); 