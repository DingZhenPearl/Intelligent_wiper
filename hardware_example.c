/**
 * 硬件端示例代码
 * 演示如何通过本地数据库获取设备凭证并连接OneNET平台
 * 
 * 编译: gcc -o hardware_example hardware_example.c -lcurl -ljson-c
 * 运行: ./hardware_example
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <curl/curl.h>
#include <json-c/json.h>
#include <time.h>

// 配置常量
#define LOCAL_SERVER_IP "192.168.1.100"  // 本地服务器IP
#define LOCAL_SERVER_PORT 3000           // 本地服务器端口
#define MAX_RESPONSE_SIZE 4096
#define MAX_URL_SIZE 512
#define MAX_MAC_SIZE 18
#define MAX_SERIAL_SIZE 32
#define MAX_ACTIVATION_CODE_SIZE 32

// 设备凭证结构
typedef struct {
    char device_id[64];
    char device_name[128];
    char product_id[32];
    char device_key[256];
    char mqtt_server[64];
    int mqtt_port;
} device_credentials_t;

// HTTP响应结构
typedef struct {
    char *data;
    size_t size;
} http_response_t;

/**
 * HTTP响应回调函数
 */
static size_t http_response_callback(void *contents, size_t size, size_t nmemb, http_response_t *response) {
    size_t total_size = size * nmemb;
    
    response->data = realloc(response->data, response->size + total_size + 1);
    if (response->data == NULL) {
        printf("ERROR: 内存分配失败\n");
        return 0;
    }
    
    memcpy(&(response->data[response->size]), contents, total_size);
    response->size += total_size;
    response->data[response->size] = 0;
    
    return total_size;
}

/**
 * 发送HTTP GET请求
 */
int http_get(const char *url, char *response_buffer, size_t buffer_size) {
    CURL *curl;
    CURLcode res;
    http_response_t response = {0};
    
    curl = curl_easy_init();
    if (!curl) {
        printf("ERROR: 初始化CURL失败\n");
        return -1;
    }
    
    curl_easy_setopt(curl, CURLOPT_URL, url);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, http_response_callback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);
    
    res = curl_easy_perform(curl);
    
    if (res != CURLE_OK) {
        printf("ERROR: HTTP请求失败: %s\n", curl_easy_strerror(res));
        curl_easy_cleanup(curl);
        if (response.data) free(response.data);
        return -1;
    }
    
    long response_code;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &response_code);
    
    curl_easy_cleanup(curl);
    
    if (response_code == 200 && response.data) {
        strncpy(response_buffer, response.data, buffer_size - 1);
        response_buffer[buffer_size - 1] = '\0';
        free(response.data);
        return 0;
    } else {
        printf("ERROR: HTTP响应错误，状态码: %ld\n", response_code);
        if (response.data) {
            printf("响应内容: %s\n", response.data);
            free(response.data);
        }
        return -1;
    }
}

/**
 * 解析设备凭证JSON响应
 */
int parse_credentials_response(const char *json_str, device_credentials_t *credentials) {
    json_object *root = json_tokener_parse(json_str);
    if (!root) {
        printf("ERROR: 解析JSON失败\n");
        return 0;
    }
    
    json_object *success_obj;
    if (!json_object_object_get_ex(root, "success", &success_obj) || 
        !json_object_get_boolean(success_obj)) {
        printf("ERROR: API调用失败\n");
        json_object_put(root);
        return 0;
    }
    
    json_object *credentials_obj;
    if (!json_object_object_get_ex(root, "credentials", &credentials_obj)) {
        printf("ERROR: 响应中没有credentials字段\n");
        json_object_put(root);
        return 0;
    }
    
    // 解析设备凭证
    json_object *device_id_obj, *device_name_obj, *product_id_obj, 
                *device_key_obj, *mqtt_server_obj, *mqtt_port_obj;
    
    if (json_object_object_get_ex(credentials_obj, "device_id", &device_id_obj)) {
        strncpy(credentials->device_id, json_object_get_string(device_id_obj), 
                sizeof(credentials->device_id) - 1);
    }
    
    if (json_object_object_get_ex(credentials_obj, "device_name", &device_name_obj)) {
        strncpy(credentials->device_name, json_object_get_string(device_name_obj), 
                sizeof(credentials->device_name) - 1);
    }
    
    if (json_object_object_get_ex(credentials_obj, "product_id", &product_id_obj)) {
        strncpy(credentials->product_id, json_object_get_string(product_id_obj), 
                sizeof(credentials->product_id) - 1);
    }
    
    if (json_object_object_get_ex(credentials_obj, "device_key", &device_key_obj)) {
        const char *key_str = json_object_get_string(device_key_obj);
        if (key_str) {
            strncpy(credentials->device_key, key_str, sizeof(credentials->device_key) - 1);
        }
    }
    
    if (json_object_object_get_ex(credentials_obj, "mqtt_server", &mqtt_server_obj)) {
        strncpy(credentials->mqtt_server, json_object_get_string(mqtt_server_obj), 
                sizeof(credentials->mqtt_server) - 1);
    }
    
    if (json_object_object_get_ex(credentials_obj, "mqtt_port", &mqtt_port_obj)) {
        credentials->mqtt_port = json_object_get_int(mqtt_port_obj);
    }
    
    json_object_put(root);
    return 1;
}

/**
 * 获取MAC地址（简化版本，实际实现需要根据平台调整）
 */
void get_mac_address(char *mac_buffer, size_t buffer_size) {
    // 这里是示例MAC地址，实际实现需要读取网卡MAC地址
    strncpy(mac_buffer, "AA:BB:CC:DD:EE:FF", buffer_size - 1);
    mac_buffer[buffer_size - 1] = '\0';
}

/**
 * 从Flash读取激活码（示例实现）
 */
void read_activation_code_from_flash(char *code_buffer, size_t buffer_size) {
    // 这里是示例激活码，实际实现需要从Flash存储器读取
    strncpy(code_buffer, "WIPE-2550-92F7-98A9", buffer_size - 1);
    code_buffer[buffer_size - 1] = '\0';
}

/**
 * 通过激活码获取设备凭证
 */
int get_device_credentials_by_activation_code(const char *activation_code, device_credentials_t *credentials) {
    char url[MAX_URL_SIZE];
    char response[MAX_RESPONSE_SIZE];
    
    snprintf(url, sizeof(url), 
        "http://%s:%d/api/hardware/device/credentials?activation_code=%s",
        LOCAL_SERVER_IP, LOCAL_SERVER_PORT, activation_code);
    
    printf("LOG: 通过激活码获取设备凭证: %s\n", activation_code);
    printf("LOG: 请求URL: %s\n", url);
    
    if (http_get(url, response, sizeof(response)) == 0) {
        if (parse_credentials_response(response, credentials)) {
            printf("SUCCESS: 通过激活码获取设备凭证成功\n");
            return 1;
        }
    }
    
    printf("ERROR: 通过激活码获取设备凭证失败\n");
    return 0;
}

/**
 * 通过硬件标识符获取设备凭证
 */
int get_device_credentials_by_hardware(const char *mac, const char *serial, device_credentials_t *credentials) {
    char url[MAX_URL_SIZE];
    char response[MAX_RESPONSE_SIZE];
    
    snprintf(url, sizeof(url), 
        "http://%s:%d/api/hardware/device/credentials?mac=%s&serial=%s",
        LOCAL_SERVER_IP, LOCAL_SERVER_PORT, mac, serial);
    
    printf("LOG: 通过硬件标识符获取设备凭证: MAC=%s, Serial=%s\n", mac, serial);
    printf("LOG: 请求URL: %s\n", url);
    
    if (http_get(url, response, sizeof(response)) == 0) {
        if (parse_credentials_response(response, credentials)) {
            printf("SUCCESS: 通过硬件标识符获取设备凭证成功\n");
            return 1;
        }
    }
    
    printf("ERROR: 通过硬件标识符获取设备凭证失败\n");
    return 0;
}

/**
 * 连接到OneNET平台（示例实现）
 */
void connect_to_onenet(const device_credentials_t *credentials) {
    printf("LOG: 开始连接OneNET平台\n");
    printf("LOG: 设备ID: %s\n", credentials->device_id);
    printf("LOG: 设备名称: %s\n", credentials->device_name);
    printf("LOG: 产品ID: %s\n", credentials->product_id);
    printf("LOG: MQTT服务器: %s:%d\n", credentials->mqtt_server, credentials->mqtt_port);
    
    // 这里应该实现真正的MQTT连接逻辑
    // 包括：
    // 1. 生成MQTT连接密码
    // 2. 建立MQTT连接
    // 3. 订阅命令主题
    // 4. 发布设备状态
    
    printf("SUCCESS: OneNET平台连接成功（示例）\n");
}

/**
 * 进入配网模式
 */
void enter_config_mode() {
    printf("LOG: 进入配网模式\n");
    printf("LOG: 等待用户配置激活码或网络参数\n");
    
    // 这里应该实现配网逻辑，例如：
    // 1. 开启WiFi热点
    // 2. 提供Web配置界面
    // 3. 接收用户输入的激活码
    // 4. 保存配置到Flash
}

/**
 * 硬件启动主流程
 */
void hardware_startup() {
    char mac_address[MAX_MAC_SIZE];
    char activation_code[MAX_ACTIVATION_CODE_SIZE];
    char hardware_serial[MAX_SERIAL_SIZE] = "HW123456789"; // 示例序列号
    device_credentials_t credentials = {0};
    
    printf("=== 智能雨刷硬件设备启动 ===\n");
    
    // 1. 读取硬件标识符
    get_mac_address(mac_address, sizeof(mac_address));
    read_activation_code_from_flash(activation_code, sizeof(activation_code));
    
    printf("LOG: 硬件MAC地址: %s\n", mac_address);
    printf("LOG: 硬件序列号: %s\n", hardware_serial);
    printf("LOG: 激活码: %s\n", activation_code);
    
    // 2. 尝试通过激活码获取设备凭证
    if (strlen(activation_code) > 0) {
        if (get_device_credentials_by_activation_code(activation_code, &credentials)) {
            connect_to_onenet(&credentials);
            return;
        }
    }
    
    // 3. 尝试通过硬件标识符获取设备凭证
    if (get_device_credentials_by_hardware(mac_address, hardware_serial, &credentials)) {
        connect_to_onenet(&credentials);
        return;
    }
    
    // 4. 获取凭证失败，进入配网模式
    printf("ERROR: 无法获取设备凭证\n");
    enter_config_mode();
}

/**
 * 主函数
 */
int main() {
    // 初始化CURL
    curl_global_init(CURL_GLOBAL_DEFAULT);
    
    // 启动硬件设备
    hardware_startup();
    
    // 清理CURL
    curl_global_cleanup();
    
    return 0;
}

/*
编译和运行说明：

1. 安装依赖库：
   Ubuntu/Debian: sudo apt-get install libcurl4-openssl-dev libjson-c-dev
   CentOS/RHEL: sudo yum install libcurl-devel json-c-devel

2. 编译：
   gcc -o hardware_example hardware_example.c -lcurl -ljson-c

3. 运行：
   ./hardware_example

4. 配置：
   - 修改 LOCAL_SERVER_IP 为实际的本地服务器IP地址
   - 修改 LOCAL_SERVER_PORT 为实际的服务器端口
   - 实现真正的MAC地址获取函数
   - 实现Flash存储的激活码读取函数
   - 实现真正的MQTT连接逻辑

5. 硬件集成：
   - 将此代码移植到目标硬件平台（如ESP32、STM32等）
   - 根据硬件平台调整网络和存储相关的函数
   - 集成MQTT客户端库
   - 添加传感器数据采集和雨刷控制逻辑
*/
