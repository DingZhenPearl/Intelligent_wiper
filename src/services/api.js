import { isNative } from '../utils/platform';
import { CapacitorHttp } from '@capacitor/core';

// 动态获取API基础URL
const getBaseUrl = () => {
  const savedUrl = localStorage.getItem('server_url');
  return savedUrl ? `http://${savedUrl}` : 'http://localhost:3000';
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
  const baseUrl = getBaseUrl();
  // 确保endpoint总是以单斜杠开头
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${normalizedEndpoint}`;
  
  console.log(`发起API请求: ${url}`, {
    method: options.method || 'GET',
    headers: options.headers,
    isNative: isNative()
  });
  
  try {
    if (isNative()) {
      // 在原生APP中使用CapacitorHttp
      try {
        console.log('使用CapacitorHttp发送请求');
        const response = await CapacitorHttp.request({
          url,
          method: options.method || 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(options.headers || {})
          },
          data: options.body ? JSON.parse(options.body) : undefined
        });
        
        console.log('CapacitorHttp响应:', response);
        return formatResponse(response);
      } catch (nativeError) {
        console.error('CapacitorHttp请求失败:', nativeError);
        return handleApiError(nativeError, url);
      }
    } else {
      // Web环境处理
      try {
        console.log('Web环境发送请求:', {
          url,
          method: options.method,
          headers: options.headers,
          body: options.body
        });
        
        // 确保请求头包含Content-Type
        const headers = {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        };
        
        const response = await fetch(url, {
          ...options,
          headers,
          mode: 'cors',
          cache: 'no-cache',
          credentials: 'include'
        });
        
        console.log('Web请求响应:', response);
        return response;
      } catch (webError) {
        console.error('Web请求失败:', webError);
        return handleApiError(webError, url);
      }
    }
  } catch (error) {
    return handleApiError(error, url);
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
