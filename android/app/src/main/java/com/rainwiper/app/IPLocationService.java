package com.rainwiper.app;

import android.util.Log;

import com.getcapacitor.JSObject;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * IP定位服务
 * 通过公网IP地址获取大致位置
 */
public class IPLocationService {
    private static final String TAG = "IPLocationService";

    // 公网IP获取API地址
    private static final String PUBLIC_IP_API_URL = "http://4.ipw.cn";
    private static final String BACKUP_PUBLIC_IP_API_URL = "https://api.ipify.org";

    // IP定位API地址（使用指定IP）
    private static final String IP_API_URL = "http://ip-api.com/json/%s?fields=status,message,country,regionName,city,lat,lon,query&lang=zh-CN";

    // 备用IP定位API地址（使用指定IP）
    private static final String BACKUP_IP_API_URL = "https://ipapi.co/%s/json/";

    // 线程池，用于执行网络请求
    private final ExecutorService executorService = Executors.newSingleThreadExecutor();

    /**
     * 获取IP地址位置
     * @param callback 位置回调
     */
    public void getIPLocation(final LocationCallback callback) {
        executorService.execute(() -> {
            try {
                // 先获取公网IP地址
                String publicIp = getPublicIpAddress();
                if (publicIp == null || publicIp.isEmpty()) {
                    Log.e(TAG, "无法获取公网IP地址");
                    callback.onError("无法获取公网IP地址");
                    return;
                }

                Log.d(TAG, "获取到公网IP地址: " + publicIp);

                // 使用公网IP地址进行定位
                // 先尝试使用主要API
                String apiUrl = String.format(IP_API_URL, publicIp);
                String result = fetchFromUrl(apiUrl);
                if (result != null) {
                    JSONObject json = new JSONObject(result);

                    // 检查是否成功
                    if (json.has("status") && json.getString("status").equals("success")) {
                        double latitude = json.getDouble("lat");
                        double longitude = json.getDouble("lon");
                        String country = json.getString("country");
                        String region = json.getString("regionName");
                        String city = json.getString("city");
                        String ip = json.getString("query");

                        Log.d(TAG, "IP定位成功: " + city + ", " + region + ", " + country);

                        // 创建位置对象
                        JSObject location = new JSObject();
                        JSObject coords = new JSObject();

                        coords.put("latitude", latitude);
                        coords.put("longitude", longitude);
                        coords.put("accuracy", 10000); // IP定位精度较低，设置为10公里

                        location.put("coords", coords);
                        location.put("timestamp", System.currentTimeMillis());
                        location.put("provider", "ip-api.com");
                        location.put("ip", ip);
                        location.put("city", city);
                        location.put("region", region);
                        location.put("country", country);

                        callback.onSuccess(location);
                        return;
                    }
                }

                // 如果主要API失败，尝试使用备用API
                Log.d(TAG, "主要IP定位API失败，尝试备用API");
                apiUrl = String.format(BACKUP_IP_API_URL, publicIp);
                result = fetchFromUrl(apiUrl);

                if (result != null) {
                    JSONObject json = new JSONObject(result);

                    if (json.has("latitude") && json.has("longitude")) {
                        double latitude = json.getDouble("latitude");
                        double longitude = json.getDouble("longitude");
                        String country = json.getString("country_name");
                        String region = json.getString("region");
                        String city = json.getString("city");
                        String ip = json.getString("ip");

                        Log.d(TAG, "备用IP定位成功: " + city + ", " + region + ", " + country);

                        // 创建位置对象
                        JSObject location = new JSObject();
                        JSObject coords = new JSObject();

                        coords.put("latitude", latitude);
                        coords.put("longitude", longitude);
                        coords.put("accuracy", 10000); // IP定位精度较低，设置为10公里

                        location.put("coords", coords);
                        location.put("timestamp", System.currentTimeMillis());
                        location.put("provider", "ipapi.co");
                        location.put("ip", ip);
                        location.put("city", city);
                        location.put("region", region);
                        location.put("country", country);

                        callback.onSuccess(location);
                        return;
                    }
                }

                // 所有API都失败
                Log.e(TAG, "所有IP定位API都失败");
                callback.onError("无法通过IP获取位置信息");
            } catch (Exception e) {
                Log.e(TAG, "IP定位出错", e);
                callback.onError("IP定位出错: " + e.getMessage());
            }
        });
    }

    /**
     * 获取公网IP地址
     * @return 公网IP地址
     */
    private String getPublicIpAddress() {
        try {
            // 先尝试使用主要API
            String result = fetchFromUrl(PUBLIC_IP_API_URL);
            if (result != null && !result.isEmpty()) {
                // 清理结果，确保只有IP地址
                result = result.trim();
                if (isValidIpAddress(result)) {
                    return result;
                }
            }

            // 如果主要API失败，尝试使用备用API
            Log.d(TAG, "主要公网IP获取API失败，尝试备用API");
            result = fetchFromUrl(BACKUP_PUBLIC_IP_API_URL);
            if (result != null && !result.isEmpty()) {
                result = result.trim();
                if (isValidIpAddress(result)) {
                    return result;
                }
            }

            // 所有API都失败
            Log.e(TAG, "所有公网IP获取API都失败");
            return null;
        } catch (Exception e) {
            Log.e(TAG, "获取公网IP地址出错", e);
            return null;
        }
    }

    /**
     * 验证IP地址是否有效
     * @param ip IP地址
     * @return 是否有效
     */
    private boolean isValidIpAddress(String ip) {
        // 简单验证IP地址格式
        String ipPattern = "^([01]?\\d\\d?|2[0-4]\\d|25[0-5])\\." +
                "([01]?\\d\\d?|2[0-4]\\d|25[0-5])\\." +
                "([01]?\\d\\d?|2[0-4]\\d|25[0-5])\\." +
                "([01]?\\d\\d?|2[0-4]\\d|25[0-5])$";
        return ip.matches(ipPattern);
    }

    /**
     * 从URL获取数据
     * @param urlString URL地址
     * @return 响应内容
     */
    private String fetchFromUrl(String urlString) {
        HttpURLConnection connection = null;
        BufferedReader reader = null;

        try {
            URL url = new URL(urlString);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            connection.setRequestProperty("User-Agent", "RainWiper/1.0");

            int responseCode = connection.getResponseCode();
            if (responseCode != HttpURLConnection.HTTP_OK) {
                Log.e(TAG, "HTTP请求失败，响应码: " + responseCode);
                return null;
            }

            reader = new BufferedReader(new InputStreamReader(connection.getInputStream()));
            StringBuilder response = new StringBuilder();
            String line;

            while ((line = reader.readLine()) != null) {
                response.append(line);
            }

            return response.toString();
        } catch (IOException e) {
            Log.e(TAG, "HTTP请求出错", e);
            return null;
        } finally {
            if (reader != null) {
                try {
                    reader.close();
                } catch (IOException e) {
                    Log.e(TAG, "关闭reader出错", e);
                }
            }

            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    /**
     * 位置回调接口
     */
    public interface LocationCallback {
        void onSuccess(JSObject location);
        void onError(String error);
    }
}
