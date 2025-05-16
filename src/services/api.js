import { isNative } from '../utils/platform';
import { CapacitorHttp } from '@capacitor/core';

// 动态获取API基础URL
const getBaseUrl = () => {
  if (isNative()) {
    // 原生应用中使用固定地址
    // 从localStorage中获取服务器地址，如果没有则使用默认地址
    const savedServerUrl = localStorage.getItem('serverUrl');

    // 默认服务器地址 - 可以根据实际情况修改
    // 注意：在实际部署时，这应该是您的服务器公网地址
    const defaultServerUrl = 'http://10.29.101.231:3000';

    const nativeBaseUrl = savedServerUrl || defaultServerUrl;
    console.log(`[API] 原生环境使用服务器地址: ${nativeBaseUrl}`);
    return nativeBaseUrl;
  } else {
    // Web环境中，使用当前页面的协议和主机
    const protocol = window.location.protocol;
    const host = window.location.host;
    const webBaseUrl = `${protocol}//${host}`;
    console.log(`[API] Web环境使用当前页面地址: ${webBaseUrl}`);
    return webBaseUrl;
  }
};

// 格式化响应对象，使其与fetch API返回格式一致
const formatResponse = (capResponse) => {
  return {
    ok: capResponse.status >= 200 && capResponse.status < 300,
    status: capResponse.status,
    statusText: capResponse.statusText || '',
    headers: capResponse.headers,
    data: capResponse.data,
    json: () => Promise.resolve(capResponse.data)
  };
};

// 处理错误情况
const handleApiError = (error, url) => {
  console.error(`API请求失败: ${url}`, error);

  // 创建一个类似fetch的错误响应
  return {
    ok: false,
    status: 0,
    statusText: '网络请求失败',
    error: error,
    json: () => Promise.resolve({
      error: error.message || '网络连接错误',
      details: '请确保服务器正在运行并且可以从此设备访问'
    })
  };
};

// API请求核心函数
const apiRequest = async (endpoint, options = {}) => {
  try {
    console.log(`[API] 开始处理API请求: ${endpoint}`);
    console.log(`[API] 请求选项:`, JSON.stringify(options));
    console.log(`[API] 运行环境: ${isNative() ? '原生应用' : 'Web浏览器'}`);

    const baseUrl = getBaseUrl();
    // 确保endpoint总是以单斜杠开头
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${normalizedEndpoint}`;

    console.log(`[API] API基础URL: ${baseUrl}`);
    console.log(`[API] 完整请求URL: ${url}`);
    console.log(`[API] 请求方法: ${options.method || 'GET'}`);
    console.log(`[API] 请求头:`, JSON.stringify(options.headers || {}));

    if (options.body) {
      console.log(`[API] 请求体:`, options.body.substring(0, 1000) + (options.body.length > 1000 ? '...(截断)' : ''));
    }

    if (isNative()) {
      // 在原生APP中使用CapacitorHttp
      try {
        console.log('[API] 使用CapacitorHttp发送请求');

        // 准备请求配置
        const requestConfig = {
          url,
          method: options.method || 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(options.headers || {})
          },
          data: options.body ? JSON.parse(options.body) : undefined
        };

        console.log('[API] CapacitorHttp请求配置:', JSON.stringify(requestConfig));

        // 发送请求
        console.log('[API] 正在发送CapacitorHttp请求...');
        const response = await CapacitorHttp.request(requestConfig);

        console.log('[API] CapacitorHttp响应状态码:', response.status);
        console.log('[API] CapacitorHttp响应头:', JSON.stringify(response.headers));
        console.log('[API] CapacitorHttp响应数据:', JSON.stringify(response.data).substring(0, 1000) + (JSON.stringify(response.data).length > 1000 ? '...(截断)' : ''));

        const formattedResponse = formatResponse(response);
        console.log('[API] 格式化后的响应:', JSON.stringify({
          ok: formattedResponse.ok,
          status: formattedResponse.status,
          statusText: formattedResponse.statusText
        }));

        return formattedResponse;
      } catch (nativeError) {
        console.error('[API] CapacitorHttp请求失败:', nativeError);
        console.error('[API] 错误详情:', nativeError.message);
        console.error('[API] 错误堆栈:', nativeError.stack);
        return handleApiError(nativeError, url);
      }
    } else {
      // Web环境处理
      try {
        console.log('[API] Web环境发送请求');

        // 确保请求头包含Content-Type
        const headers = {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        };

        console.log('[API] 完整请求头:', JSON.stringify(headers));

        // 准备fetch选项
        const fetchOptions = {
          ...options,
          headers,
          mode: 'cors',
          cache: 'no-cache',
          credentials: 'include'
        };

        console.log('[API] fetch选项:', JSON.stringify(fetchOptions, (key, value) => {
          // 避免序列化body，因为它可能很大
          if (key === 'body') return value ? '[请求体已省略]' : undefined;
          return value;
        }));

        // 发送请求
        console.log('[API] 正在发送fetch请求...');
        const response = await fetch(url, fetchOptions);

        console.log('[API] fetch响应状态:', response.status, response.statusText);
        console.log('[API] fetch响应类型:', response.type);
        console.log('[API] fetch响应URL:', response.url);

        // 尝试克隆并读取响应内容（仅用于日志）
        try {
          const clonedResponse = response.clone();
          const responseText = await clonedResponse.text();
          console.log('[API] fetch响应内容:', responseText.substring(0, 1000) + (responseText.length > 1000 ? '...(截断)' : ''));
        } catch (readError) {
          console.warn('[API] 无法读取响应内容用于日志:', readError.message);
        }

        return response;
      } catch (webError) {
        console.error('[API] Web请求失败:', webError);
        console.error('[API] 错误详情:', webError.message);
        console.error('[API] 错误堆栈:', webError.stack);
        return handleApiError(webError, url);
      }
    }
  } catch (error) {
    console.error('[API] 请求处理过程中发生未捕获错误:', error);
    console.error('[API] 错误详情:', error.message);
    console.error('[API] 错误堆栈:', error.stack);
    return handleApiError(error, endpoint);
  }
};

// 常用API方法
export const get = (endpoint, headers = {}) => {
  return apiRequest(endpoint, { method: 'GET', headers });
};

export const post = (endpoint, data = {}, headers = {}) => {
  console.log('准备发送POST请求:', {
    endpoint,
    data,
    isNative: isNative()
  });

  // 确保body数据格式正确
  const body = JSON.stringify(data);

  return apiRequest(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body
  });
};

export default apiRequest;
