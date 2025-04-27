package com.rainwiper.app;

import android.Manifest;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import android.location.Location;
import android.util.Log;

import java.util.HashMap;
import java.util.Map;

@CapacitorPlugin(
    name = "CustomGeolocation",
    permissions = {
        @Permission(
            strings = { Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION },
            alias = CustomGeolocationPlugin.LOCATION
        ),
        @Permission(strings = { Manifest.permission.ACCESS_COARSE_LOCATION }, alias = CustomGeolocationPlugin.COARSE_LOCATION),
        @Permission(strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }, alias = CustomGeolocationPlugin.BACKGROUND_LOCATION)
    }
)
public class CustomGeolocationPlugin extends Plugin {
    private static final String TAG = "CustomGeolocationPlugin";

    static final String LOCATION = "location";
    static final String COARSE_LOCATION = "coarseLocation";
    static final String BACKGROUND_LOCATION = "backgroundLocation";

    private NativeLocationManager locationManager;
    private Map<String, PluginCall> watchingCalls = new HashMap<>();

    @Override
    public void load() {
        locationManager = new NativeLocationManager(getContext());
        Log.d(TAG, "CustomGeolocationPlugin 已加载");
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        // 暂停时清除所有位置更新
        for (String callbackId : watchingCalls.keySet()) {
            locationManager.clearWatch(callbackId);
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        // 恢复时重新启动所有位置监听
        for (Map.Entry<String, PluginCall> entry : watchingCalls.entrySet()) {
            startWatch(entry.getValue());
        }
    }

    @Override
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        if (locationManager.isLocationServiceEnabled()) {
            super.checkPermissions(call);
        } else {
            call.reject("位置服务未启用");
        }
    }

    @Override
    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (locationManager.isLocationServiceEnabled()) {
            super.requestPermissions(call);
        } else {
            call.reject("位置服务未启用");
        }
    }

    /**
     * 获取当前位置
     */
    @PluginMethod
    public void getCurrentPosition(final PluginCall call) {
        String alias = getAlias(call);
        if (getPermissionState(alias) != PermissionState.GRANTED) {
            requestPermissionForAlias(alias, call, "completeCurrentPosition");
        } else {
            getPosition(call);
        }
    }

    /**
     * 权限请求后完成获取当前位置
     */
    @PermissionCallback
    private void completeCurrentPosition(PluginCall call) {
        if (getPermissionState(CustomGeolocationPlugin.COARSE_LOCATION) == PermissionState.GRANTED) {
            getPosition(call);
        } else {
            call.reject("位置权限被拒绝");
        }
    }

    /**
     * 开始监听位置变化
     */
    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void watchPosition(PluginCall call) {
        call.setKeepAlive(true);
        String alias = getAlias(call);
        if (getPermissionState(alias) != PermissionState.GRANTED) {
            requestPermissionForAlias(alias, call, "completeWatchPosition");
        } else {
            startWatch(call);
        }
    }

    /**
     * 权限请求后完成开始监听位置变化
     */
    @PermissionCallback
    private void completeWatchPosition(PluginCall call) {
        if (getPermissionState(CustomGeolocationPlugin.COARSE_LOCATION) == PermissionState.GRANTED) {
            startWatch(call);
        } else {
            call.reject("位置权限被拒绝");
        }
    }

    /**
     * 停止监听位置变化
     */
    @PluginMethod
    public void clearWatch(PluginCall call) {
        String callbackId = call.getString("id");
        if (callbackId != null) {
            PluginCall removed = watchingCalls.remove(callbackId);
            if (removed != null) {
                removed.release(bridge);
            }
            locationManager.clearWatch(callbackId);
            call.resolve();
        } else {
            call.reject("必须提供监听ID");
        }
    }

    /**
     * 获取位置
     */
    private void getPosition(final PluginCall call) {
        locationManager.getCurrentPosition(call, call.getCallbackId());
    }

    /**
     * 开始监听位置
     */
    private void startWatch(final PluginCall call) {
        locationManager.watchPosition(call, call.getCallbackId(), new NativeLocationManager.LocationCallback() {
            @Override
            public void onLocationResult(JSObject location) {
                call.resolve(location);
            }
        });
        watchingCalls.put(call.getCallbackId(), call);
    }

    /**
     * 获取权限别名
     */
    private String getAlias(PluginCall call) {
        String alias = CustomGeolocationPlugin.LOCATION;

        // 检查是否需要后台定位权限
        boolean requireBackgroundLocation = call.getBoolean("requireBackgroundLocation", false);
        if (requireBackgroundLocation && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            alias = CustomGeolocationPlugin.BACKGROUND_LOCATION;
        }
        // 检查是否需要高精度定位
        else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            boolean enableHighAccuracy = call.getBoolean("enableHighAccuracy", false);
            if (!enableHighAccuracy) {
                alias = CustomGeolocationPlugin.COARSE_LOCATION;
            }
        }

        return alias;
    }
}
