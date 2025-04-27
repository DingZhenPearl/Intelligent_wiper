package com.rainwiper.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;

import java.util.HashMap;
import java.util.Map;

/**
 * 原生定位管理器
 * 使用Android原生LocationManager实现定位功能，不依赖Google Play服务
 */
public class NativeLocationManager {
    private static final String TAG = "NativeLocationManager";

    private final Context context;
    private LocationManager locationManager;
    private final Map<String, LocationListener> locationListeners = new HashMap<>();

    // 定位提供者优先级
    private static final String[] PROVIDERS = {
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
            LocationManager.PASSIVE_PROVIDER
    };

    // 默认定位参数
    private static final long DEFAULT_MIN_TIME = 10000; // 10秒
    private static final float DEFAULT_MIN_DISTANCE = 10; // 10米

    public NativeLocationManager(Context context) {
        this.context = context;
        this.locationManager = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        Log.d(TAG, "NativeLocationManager 初始化");
    }

    /**
     * 检查定位权限
     * @return 是否有定位权限
     */
    public boolean hasLocationPermission() {
        boolean hasFineLocation = ActivityCompat.checkSelfPermission(context,
                Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean hasCoarseLocation = ActivityCompat.checkSelfPermission(context,
                Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        // 检查是否需要后台定位权限（Android 10+）
        boolean needBackgroundPermission = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q;
        boolean hasBackgroundLocation = true; // 默认为true，如果不需要后台权限

        if (needBackgroundPermission) {
            hasBackgroundLocation = ActivityCompat.checkSelfPermission(context,
                    Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
            Log.d(TAG, "检查定位权限 - 后台定位: " + hasBackgroundLocation);
        }

        Log.d(TAG, "检查定位权限 - 精确定位: " + hasFineLocation + ", 粗略定位: " + hasCoarseLocation);
        Log.d(TAG, "Android版本: " + Build.VERSION.SDK_INT + ", 需要后台权限: " + needBackgroundPermission);

        // 前台权限是必须的，后台权限是可选的
        boolean hasForegroundPermission = hasFineLocation || hasCoarseLocation;

        // 如果需要后台权限但没有，记录日志但仍然返回true（只要有前台权限）
        if (needBackgroundPermission && !hasBackgroundLocation) {
            Log.w(TAG, "没有后台定位权限，某些功能可能受限");
        }

        return hasForegroundPermission;
    }

    /**
     * 检查定位服务是否可用
     * @return 是否有可用的定位提供者
     */
    public boolean isLocationServiceEnabled() {
        if (locationManager == null) {
            Log.e(TAG, "LocationManager为空");
            return false;
        }

        boolean gpsEnabled = false;
        boolean networkEnabled = false;

        try {
            gpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
        } catch (Exception ex) {
            Log.e(TAG, "检查GPS提供者时出错", ex);
        }

        try {
            networkEnabled = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        } catch (Exception ex) {
            Log.e(TAG, "检查网络提供者时出错", ex);
        }

        Log.d(TAG, "定位服务状态 - GPS: " + gpsEnabled + ", 网络: " + networkEnabled);
        return gpsEnabled || networkEnabled;
    }

    /**
     * 获取最后已知位置
     * @return 位置信息的JSObject
     */
    public JSObject getLastKnownLocation() {
        if (!hasLocationPermission()) {
            Log.e(TAG, "没有定位权限");
            return null;
        }

        Location bestLocation = null;

        for (String provider : PROVIDERS) {
            try {
                if (locationManager.isProviderEnabled(provider)) {
                    Location location = locationManager.getLastKnownLocation(provider);
                    if (isBetterLocation(location, bestLocation)) {
                        bestLocation = location;
                    }
                }
            } catch (SecurityException e) {
                Log.e(TAG, "获取最后已知位置时出错: " + provider, e);
            } catch (Exception e) {
                Log.e(TAG, "获取最后已知位置时发生异常: " + provider, e);
            }
        }

        if (bestLocation != null) {
            return locationToJSObject(bestLocation);
        }

        Log.d(TAG, "没有可用的最后已知位置");
        return null;
    }

    /**
     * 请求单次位置更新
     * @param call Capacitor插件调用
     * @param callbackId 回调ID
     */
    public void getCurrentPosition(final PluginCall call, final String callbackId) {
        if (!hasLocationPermission()) {
            call.reject("没有定位权限");
            return;
        }

        if (!isLocationServiceEnabled()) {
            call.reject("定位服务未启用");
            return;
        }

        // 获取定位选项
        int timeout = call.getInt("timeout", 10000);
        boolean enableHighAccuracy = call.getBoolean("enableHighAccuracy", true);

        // 创建位置监听器
        LocationListener locationListener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                Log.d(TAG, "位置已更新: " + location);

                // 移除监听器
                for (String provider : PROVIDERS) {
                    try {
                        locationManager.removeUpdates(this);
                    } catch (SecurityException e) {
                        Log.e(TAG, "移除位置更新时出错: " + provider, e);
                    } catch (Exception e) {
                        Log.e(TAG, "移除位置更新时发生异常: " + provider, e);
                    }
                }

                // 返回位置信息
                JSObject result = locationToJSObject(location);
                call.resolve(result);

                // 从监听器映射中移除
                locationListeners.remove(callbackId);
            }

            @Override
            public void onStatusChanged(String provider, int status, Bundle extras) {
                Log.d(TAG, "提供者状态已更改: " + provider + ", 状态: " + status);
            }

            @Override
            public void onProviderEnabled(String provider) {
                Log.d(TAG, "提供者已启用: " + provider);
            }

            @Override
            public void onProviderDisabled(String provider) {
                Log.d(TAG, "提供者已禁用: " + provider);
            }
        };

        // 保存监听器
        locationListeners.put(callbackId, locationListener);

        // 尝试获取最后已知位置
        JSObject lastLocation = getLastKnownLocation();
        if (lastLocation != null) {
            Log.d(TAG, "使用最后已知位置");
            call.resolve(lastLocation);
            return;
        }

        // 请求位置更新
        boolean requestSent = false;
        for (String provider : PROVIDERS) {
            try {
                if (locationManager.isProviderEnabled(provider)) {
                    // 对于高精度请求，只使用GPS提供者
                    if (enableHighAccuracy && !provider.equals(LocationManager.GPS_PROVIDER)) {
                        continue;
                    }

                    Log.d(TAG, "请求位置更新: " + provider);
                    locationManager.requestLocationUpdates(
                            provider,
                            DEFAULT_MIN_TIME,
                            DEFAULT_MIN_DISTANCE,
                            locationListener,
                            Looper.getMainLooper()
                    );
                    requestSent = true;
                }
            } catch (SecurityException e) {
                Log.e(TAG, "请求位置更新时出错: " + provider, e);
            } catch (Exception e) {
                Log.e(TAG, "请求位置更新时发生异常: " + provider, e);
            }
        }

        if (!requestSent) {
            call.reject("无法请求位置更新，没有可用的提供者");
            locationListeners.remove(callbackId);
        }

        // 设置超时
        if (timeout > 0) {
            new android.os.Handler(Looper.getMainLooper()).postDelayed(() -> {
                // 检查调用是否已经解决
                if (call.isKeptAlive()) {
                    Log.d(TAG, "位置请求超时");

                    // 移除监听器
                    LocationListener listener = locationListeners.get(callbackId);
                    if (listener != null) {
                        for (String provider : PROVIDERS) {
                            try {
                                locationManager.removeUpdates(listener);
                            } catch (SecurityException e) {
                                Log.e(TAG, "移除位置更新时出错: " + provider, e);
                            } catch (Exception e) {
                                Log.e(TAG, "移除位置更新时发生异常: " + provider, e);
                            }
                        }

                        // 从监听器映射中移除
                        locationListeners.remove(callbackId);
                    }

                    // 尝试获取最后已知位置作为备用
                    JSObject lastKnownLocation = getLastKnownLocation();
                    if (lastKnownLocation != null) {
                        call.resolve(lastKnownLocation);
                    } else {
                        call.reject("获取位置超时");
                    }
                }
            }, timeout);
        }
    }

    /**
     * 开始监听位置更新
     * @param call Capacitor插件调用
     * @param callbackId 回调ID
     * @param callback 位置更新回调
     */
    public void watchPosition(final PluginCall call, final String callbackId, final LocationCallback callback) {
        if (!hasLocationPermission()) {
            call.reject("没有定位权限");
            return;
        }

        if (!isLocationServiceEnabled()) {
            call.reject("定位服务未启用");
            return;
        }

        // 获取定位选项
        boolean enableHighAccuracy = call.getBoolean("enableHighAccuracy", true);
        long minTime = call.getInt("timeout", (int)DEFAULT_MIN_TIME);
        float minDistance = call.getInt("maximumAge", (int)DEFAULT_MIN_DISTANCE);

        // 创建位置监听器
        LocationListener locationListener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                Log.d(TAG, "监听位置已更新: " + location);

                // 返回位置信息
                JSObject result = locationToJSObject(location);
                callback.onLocationResult(result);
            }

            @Override
            public void onStatusChanged(String provider, int status, Bundle extras) {
                Log.d(TAG, "监听提供者状态已更改: " + provider + ", 状态: " + status);
            }

            @Override
            public void onProviderEnabled(String provider) {
                Log.d(TAG, "监听提供者已启用: " + provider);
            }

            @Override
            public void onProviderDisabled(String provider) {
                Log.d(TAG, "监听提供者已禁用: " + provider);
            }
        };

        // 保存监听器
        locationListeners.put(callbackId, locationListener);

        // 请求位置更新
        boolean requestSent = false;
        for (String provider : PROVIDERS) {
            try {
                if (locationManager.isProviderEnabled(provider)) {
                    // 对于高精度请求，只使用GPS提供者
                    if (enableHighAccuracy && !provider.equals(LocationManager.GPS_PROVIDER)) {
                        continue;
                    }

                    Log.d(TAG, "请求监听位置更新: " + provider);
                    locationManager.requestLocationUpdates(
                            provider,
                            minTime,
                            minDistance,
                            locationListener,
                            Looper.getMainLooper()
                    );
                    requestSent = true;
                }
            } catch (SecurityException e) {
                Log.e(TAG, "请求监听位置更新时出错: " + provider, e);
            } catch (Exception e) {
                Log.e(TAG, "请求监听位置更新时发生异常: " + provider, e);
            }
        }

        if (!requestSent) {
            call.reject("无法请求位置更新，没有可用的提供者");
            locationListeners.remove(callbackId);
        } else {
            // 返回监听ID
            JSObject result = new JSObject();
            result.put("watchId", callbackId);
            call.resolve(result);
        }
    }

    /**
     * 停止监听位置更新
     * @param watchId 监听ID
     */
    public void clearWatch(String watchId) {
        LocationListener locationListener = locationListeners.get(watchId);
        if (locationListener != null) {
            for (String provider : PROVIDERS) {
                try {
                    locationManager.removeUpdates(locationListener);
                } catch (SecurityException e) {
                    Log.e(TAG, "移除监听位置更新时出错: " + provider, e);
                } catch (Exception e) {
                    Log.e(TAG, "移除监听位置更新时发生异常: " + provider, e);
                }
            }

            // 从监听器映射中移除
            locationListeners.remove(watchId);
            Log.d(TAG, "已停止位置监听: " + watchId);
        }
    }

    /**
     * 清理所有位置监听器
     */
    public void cleanup() {
        for (LocationListener listener : locationListeners.values()) {
            try {
                locationManager.removeUpdates(listener);
            } catch (SecurityException e) {
                Log.e(TAG, "清理位置监听器时出错", e);
            } catch (Exception e) {
                Log.e(TAG, "清理位置监听器时发生异常", e);
            }
        }

        locationListeners.clear();
        Log.d(TAG, "已清理所有位置监听器");
    }

    /**
     * 将Location对象转换为JSObject
     * @param location 位置对象
     * @return JSObject格式的位置信息
     */
    private JSObject locationToJSObject(Location location) {
        JSObject obj = new JSObject();
        JSObject coords = new JSObject();

        coords.put("latitude", location.getLatitude());
        coords.put("longitude", location.getLongitude());
        coords.put("accuracy", location.getAccuracy());

        if (location.hasAltitude()) {
            coords.put("altitude", location.getAltitude());
        }

        if (location.hasSpeed()) {
            coords.put("speed", location.getSpeed());
        }

        if (location.hasBearing()) {
            coords.put("heading", location.getBearing());
        }

        obj.put("coords", coords);
        obj.put("timestamp", location.getTime());
        obj.put("provider", location.getProvider());

        return obj;
    }

    /**
     * 判断新位置是否比当前位置更好
     * @param location 新位置
     * @param currentBestLocation 当前最佳位置
     * @return 新位置是否更好
     */
    private boolean isBetterLocation(Location location, Location currentBestLocation) {
        if (location == null) {
            return false;
        }

        if (currentBestLocation == null) {
            return true;
        }

        // 检查位置是否明显更新
        long timeDelta = location.getTime() - currentBestLocation.getTime();
        boolean isSignificantlyNewer = timeDelta > 60000; // 1分钟
        boolean isSignificantlyOlder = timeDelta < -60000;

        if (isSignificantlyNewer) {
            return true;
        } else if (isSignificantlyOlder) {
            return false;
        }

        // 检查精度
        int accuracyDelta = (int) (location.getAccuracy() - currentBestLocation.getAccuracy());
        boolean isLessAccurate = accuracyDelta > 0;
        boolean isMoreAccurate = accuracyDelta < 0;
        boolean isSignificantlyLessAccurate = accuracyDelta > 200;

        // 检查提供者
        boolean isFromSameProvider = isSameProvider(location.getProvider(), currentBestLocation.getProvider());

        // 确定是否更好的位置
        if (isMoreAccurate) {
            return true;
        } else if (isFromSameProvider && !isSignificantlyLessAccurate) {
            return true;
        }

        return false;
    }

    /**
     * 检查两个提供者是否相同
     * @param provider1 提供者1
     * @param provider2 提供者2
     * @return 是否相同
     */
    private boolean isSameProvider(String provider1, String provider2) {
        if (provider1 == null) {
            return provider2 == null;
        }
        return provider1.equals(provider2);
    }

    /**
     * 位置回调接口
     */
    public interface LocationCallback {
        void onLocationResult(JSObject location);
    }
}
