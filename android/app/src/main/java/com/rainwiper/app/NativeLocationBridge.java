package com.rainwiper.app;

import android.util.Log;
import android.webkit.JavascriptInterface;

import com.getcapacitor.JSObject;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * 原生定位桥接器
 * 提供JavaScript接口，用于在前端直接调用原生定位功能
 */
public class NativeLocationBridge {
    private static final String TAG = "NativeLocationBridge";

    private final NativeLocationManager locationManager;
    private final MainActivity activity;

    public NativeLocationBridge(MainActivity activity) {
        this.activity = activity;
        this.locationManager = new NativeLocationManager(activity);
        Log.d(TAG, "NativeLocationBridge 初始化");
    }

    /**
     * 检查定位权限
     * @return JSON格式的权限状态
     */
    @JavascriptInterface
    public String checkLocationPermission() {
        Log.d(TAG, "JS调用: checkLocationPermission()");

        boolean hasPermission = locationManager.hasLocationPermission();
        boolean isEnabled = locationManager.isLocationServiceEnabled();

        JSONObject result = new JSONObject();
        try {
            result.put("hasPermission", hasPermission);
            result.put("isEnabled", isEnabled);
        } catch (JSONException e) {
            Log.e(TAG, "创建JSON结果时出错", e);
        }

        return result.toString();
    }

    /**
     * 请求定位权限
     */
    @JavascriptInterface
    public void requestLocationPermission() {
        Log.d(TAG, "JS调用: requestLocationPermission()");

        // 在UI线程上请求权限
        activity.runOnUiThread(() -> {
            activity.checkAndRequestLocationPermissions();
        });
    }

    /**
     * 获取当前位置
     * @param enableHighAccuracy 是否启用高精度定位
     * @param timeout 超时时间（毫秒）
     * @param callback JavaScript回调函数名称
     */
    @JavascriptInterface
    public void getCurrentPosition(boolean enableHighAccuracy, int timeout, final String callback) {
        Log.d(TAG, "JS调用: getCurrentPosition(enableHighAccuracy=" + enableHighAccuracy +
                ", timeout=" + timeout + ", callback=" + callback + ")");

        // 检查权限
        if (!locationManager.hasLocationPermission()) {
            sendErrorCallback(callback, "没有定位权限");
            return;
        }

        // 检查定位服务
        if (!locationManager.isLocationServiceEnabled()) {
            sendErrorCallback(callback, "定位服务未启用");
            return;
        }

        // 在UI线程上获取位置
        activity.runOnUiThread(() -> {
            // 尝试获取最后已知位置
            JSObject lastLocation = locationManager.getLastKnownLocation();
            if (lastLocation != null) {
                Log.d(TAG, "使用最后已知位置");
                sendSuccessCallback(callback, lastLocation.toString());
                return;
            }

            // 生成一个唯一的回调ID
            String callbackId = "native_" + System.currentTimeMillis();

            // 请求位置更新
            locationManager.getCurrentPosition(enableHighAccuracy, timeout, callbackId, new NativeLocationManager.LocationResultCallback() {
                @Override
                public void onSuccess(JSObject location) {
                    sendSuccessCallback(callback, location.toString());
                }

                @Override
                public void onError(String error) {
                    sendErrorCallback(callback, error);
                }
            });
        });
    }

    /**
     * 发送成功回调
     * @param callback JavaScript回调函数名称
     * @param data 位置数据
     */
    private void sendSuccessCallback(String callback, String data) {
        final String js = "javascript:try { " + callback + "({success:true, data:" + data + "}); } catch(e) { console.error(e); }";
        activity.runOnUiThread(() -> {
            activity.getBridge().getWebView().evaluateJavascript(js, null);
        });
    }

    /**
     * 发送错误回调
     * @param callback JavaScript回调函数名称
     * @param error 错误信息
     */
    private void sendErrorCallback(String callback, String error) {
        final String js = "javascript:try { " + callback + "({success:false, error:\"" + error.replace("\"", "\\\"") + "\"}); } catch(e) { console.error(e); }";
        activity.runOnUiThread(() -> {
            activity.getBridge().getWebView().evaluateJavascript(js, null);
        });
    }


}
