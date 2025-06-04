package com.rainwiper.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final int LOCATION_PERMISSION_REQUEST_CODE = 1001;
    private static final int AUDIO_PERMISSION_REQUEST_CODE = 1002;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 初始化时打印日志，便于调试
        Log.d(TAG, "MainActivity onCreate");

        // 注册原生定位桥接器
        getBridge().getWebView().getSettings().setJavaScriptEnabled(true);
        getBridge().getWebView().addJavascriptInterface(new NativeLocationBridge(this), "NativeLocation");
        Log.d(TAG, "已注册原生定位桥接器");

        // 配置WebView以支持媒体设备访问
        configureWebViewForMedia();

        // 主动检查并请求位置权限
        checkAndRequestLocationPermissions();

        // 主动检查并请求录音权限
        checkAndRequestAudioPermissions();
    }

    /**
     * 配置WebView以支持媒体设备访问
     */
    private void configureWebViewForMedia() {
        Log.d(TAG, "配置WebView以支持媒体设备访问");

        // 启用媒体播放和录制
        getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        getBridge().getWebView().getSettings().setDomStorageEnabled(true);
        getBridge().getWebView().getSettings().setDatabaseEnabled(true);

        // Android 11+ 特定配置
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) { // Android 11 (API 30)
            Log.d(TAG, "Android 11+，启用额外的WebView媒体配置");

            // 启用混合内容模式（允许HTTPS页面加载HTTP资源）
            getBridge().getWebView().getSettings().setMixedContentMode(
                android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

            // 启用安全浏览
            getBridge().getWebView().getSettings().setSafeBrowsingEnabled(false);

            // 允许文件访问
            getBridge().getWebView().getSettings().setAllowFileAccess(true);
            getBridge().getWebView().getSettings().setAllowContentAccess(true);

            // 启用JavaScript接口
            getBridge().getWebView().getSettings().setJavaScriptCanOpenWindowsAutomatically(true);
        }

        // 强制启用安全上下文特性（关键配置）
        try {
            // 通过反射启用WebView的安全上下文特性
            android.webkit.WebSettings settings = getBridge().getWebView().getSettings();

            // 启用所有必要的权限
            settings.setGeolocationEnabled(true);
            settings.setAllowUniversalAccessFromFileURLs(true);
            settings.setAllowFileAccessFromFileURLs(true);

            Log.d(TAG, "已启用WebView安全上下文特性");
        } catch (Exception e) {
            Log.w(TAG, "启用WebView安全上下文特性失败: " + e.getMessage());
        }

        // 设置WebView客户端以处理权限请求
        getBridge().getWebView().setWebChromeClient(new android.webkit.WebChromeClient() {
            @Override
            public void onPermissionRequest(android.webkit.PermissionRequest request) {
                Log.d(TAG, "WebView权限请求: " + Arrays.toString(request.getResources()));

                // 检查是否请求录音权限
                for (String resource : request.getResources()) {
                    if (resource.equals(android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                        Log.d(TAG, "WebView请求录音权限");

                        // 检查应用是否已有录音权限
                        if (ContextCompat.checkSelfPermission(MainActivity.this,
                                Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                            Log.d(TAG, "应用已有录音权限，授予WebView权限");
                            request.grant(request.getResources());
                        } else {
                            Log.d(TAG, "应用无录音权限，拒绝WebView权限请求");
                            request.deny();
                        }
                        return;
                    }
                }

                // 对于其他权限，默认授予
                request.grant(request.getResources());
            }
        });

        Log.d(TAG, "WebView媒体配置完成");
    }

    /**
     * 检查并请求录音权限
     */
    public void checkAndRequestAudioPermissions() {
        Log.d(TAG, "检查录音权限状态");

        boolean recordAudioGranted = ContextCompat.checkSelfPermission(this,
                Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        boolean modifyAudioGranted = ContextCompat.checkSelfPermission(this,
                Manifest.permission.MODIFY_AUDIO_SETTINGS) == PackageManager.PERMISSION_GRANTED;

        Log.d(TAG, "录音权限状态: " + (recordAudioGranted ? "已授权" : "未授权"));
        Log.d(TAG, "音频设置权限状态: " + (modifyAudioGranted ? "已授权" : "未授权"));

        // 如果没有录音权限，请求权限
        if (!recordAudioGranted || !modifyAudioGranted) {
            Log.d(TAG, "请求录音权限");
            ActivityCompat.requestPermissions(
                this,
                new String[]{
                    Manifest.permission.RECORD_AUDIO,
                    Manifest.permission.MODIFY_AUDIO_SETTINGS
                },
                AUDIO_PERMISSION_REQUEST_CODE
            );
        } else {
            Log.d(TAG, "已有所有需要的录音权限，无需请求");
        }
    }

    /**
     * 检查并请求位置权限
     */
    public void checkAndRequestLocationPermissions() {
        Log.d(TAG, "检查位置权限状态");

        boolean fineLocationGranted = ContextCompat.checkSelfPermission(this,
                Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarseLocationGranted = ContextCompat.checkSelfPermission(this,
                Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        // 检查Android版本，Android 10+需要额外的后台定位权限
        boolean needBackgroundPermission = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q; // Android 10 (API 29)
        boolean backgroundLocationGranted = true; // 默认为true，如果不需要后台权限

        if (needBackgroundPermission) {
            backgroundLocationGranted = ContextCompat.checkSelfPermission(this,
                    Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
            Log.d(TAG, "后台位置权限状态: " + (backgroundLocationGranted ? "已授权" : "未授权"));
        }

        Log.d(TAG, "精确位置权限状态: " + (fineLocationGranted ? "已授权" : "未授权"));
        Log.d(TAG, "粗略位置权限状态: " + (coarseLocationGranted ? "已授权" : "未授权"));
        Log.d(TAG, "Android版本: " + Build.VERSION.SDK_INT + ", 需要后台权限: " + needBackgroundPermission);

        // 如果没有前台位置权限，先请求前台权限
        if (!fineLocationGranted || !coarseLocationGranted) {
            Log.d(TAG, "请求前台位置权限");
            ActivityCompat.requestPermissions(
                this,
                new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                },
                LOCATION_PERMISSION_REQUEST_CODE
            );
        }
        // 如果已有前台权限但需要后台权限且未授权，请求后台权限
        else if (needBackgroundPermission && !backgroundLocationGranted) {
            Log.d(TAG, "请求后台位置权限");
            // Android 10+需要单独请求后台位置权限
            ActivityCompat.requestPermissions(
                this,
                new String[]{
                    Manifest.permission.ACCESS_BACKGROUND_LOCATION
                },
                LOCATION_PERMISSION_REQUEST_CODE + 1 // 使用不同的请求码
            );
        } else {
            Log.d(TAG, "已有所有需要的位置权限，无需请求");
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        // 打印权限请求结果，便于调试
        Log.d(TAG, "Permission request result - requestCode: " + requestCode);
        for (int i = 0; i < permissions.length; i++) {
            Log.d(TAG, "Permission: " + permissions[i] + ", result: " + grantResults[i]);
        }

        // 处理前台位置权限请求结果
        if (requestCode == LOCATION_PERMISSION_REQUEST_CODE) {
            boolean allGranted = true;

            for (int i = 0; i < permissions.length; i++) {
                if (permissions[i].equals(Manifest.permission.ACCESS_FINE_LOCATION) ||
                    permissions[i].equals(Manifest.permission.ACCESS_COARSE_LOCATION)) {
                    if (grantResults[i] != PackageManager.PERMISSION_GRANTED) {
                        allGranted = false;
                        break;
                    }
                }
            }

            if (allGranted) {
                Log.d(TAG, "前台位置权限已授予");

                // 如果是Android 10+，检查是否需要请求后台位置权限
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    boolean backgroundLocationGranted = ContextCompat.checkSelfPermission(this,
                            Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;

                    if (!backgroundLocationGranted) {
                        Log.d(TAG, "前台权限已授予，现在请求后台位置权限");
                        ActivityCompat.requestPermissions(
                            this,
                            new String[]{
                                Manifest.permission.ACCESS_BACKGROUND_LOCATION
                            },
                            LOCATION_PERMISSION_REQUEST_CODE + 1
                        );
                        return; // 等待后台权限请求结果
                    }
                }

                // 所有权限都已授予，通知JS层
                Log.d(TAG, "所有位置权限已授予，可以获取位置信息");
                notifyLocationPermissionGranted();
            } else {
                Log.d(TAG, "前台位置权限被拒绝，无法获取位置信息");
                notifyLocationPermissionDenied();
            }
        }
        // 处理后台位置权限请求结果
        else if (requestCode == LOCATION_PERMISSION_REQUEST_CODE + 1) {
            boolean backgroundGranted = false;

            for (int i = 0; i < permissions.length; i++) {
                if (permissions[i].equals(Manifest.permission.ACCESS_BACKGROUND_LOCATION)) {
                    backgroundGranted = grantResults[i] == PackageManager.PERMISSION_GRANTED;
                    break;
                }
            }

            if (backgroundGranted) {
                Log.d(TAG, "后台位置权限已授予，可以在后台获取位置信息");
                notifyLocationPermissionGranted();
            } else {
                Log.d(TAG, "后台位置权限被拒绝，只能在前台获取位置信息");
                // 即使后台权限被拒绝，前台权限仍然可用，所以仍然通知JS层权限已授予
                notifyLocationPermissionGranted();
            }
        }
        // 处理录音权限请求结果
        else if (requestCode == AUDIO_PERMISSION_REQUEST_CODE) {
            boolean allAudioGranted = true;

            for (int i = 0; i < permissions.length; i++) {
                if (permissions[i].equals(Manifest.permission.RECORD_AUDIO) ||
                    permissions[i].equals(Manifest.permission.MODIFY_AUDIO_SETTINGS)) {
                    if (grantResults[i] != PackageManager.PERMISSION_GRANTED) {
                        allAudioGranted = false;
                        break;
                    }
                }
            }

            if (allAudioGranted) {
                Log.d(TAG, "录音权限已授予，可以使用语音识别功能");
                notifyAudioPermissionGranted();
            } else {
                Log.d(TAG, "录音权限被拒绝，无法使用语音识别功能");
                notifyAudioPermissionDenied();
            }
        }
    }

    /**
     * 通知JS层位置权限已授予
     */
    private void notifyLocationPermissionGranted() {
        // 通过Bridge通知JS层
        Log.d(TAG, "通知JS层位置权限已授予");
        getBridge().triggerWindowJSEvent("locationPermissionGranted", "{}");
    }

    /**
     * 通知JS层位置权限被拒绝
     */
    private void notifyLocationPermissionDenied() {
        // 通过Bridge通知JS层
        Log.d(TAG, "通知JS层位置权限被拒绝");
        getBridge().triggerWindowJSEvent("locationPermissionDenied", "{}");
    }

    /**
     * 通知JS层录音权限已授予
     */
    private void notifyAudioPermissionGranted() {
        // 通过Bridge通知JS层
        Log.d(TAG, "通知JS层录音权限已授予");
        getBridge().triggerWindowJSEvent("audioPermissionGranted", "{}");
    }

    /**
     * 通知JS层录音权限被拒绝
     */
    private void notifyAudioPermissionDenied() {
        // 通过Bridge通知JS层
        Log.d(TAG, "通知JS层录音权限被拒绝");
        getBridge().triggerWindowJSEvent("audioPermissionDenied", "{}");
    }
}
