package com.rainwiper.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

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
    private static final int MICROPHONE_PERMISSION_REQUEST_CODE = 1002;
    private static final int VOICE_PERMISSION_REQUEST_CODE = 1003;

    private NativeVoiceRecognitionBridge nativeVoiceRecognitionBridge;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 初始化时打印日志，便于调试
        Log.d(TAG, "MainActivity onCreate");

        // 配置WebView
        configureWebView();

        // 注册原生定位桥接器
        getBridge().getWebView().addJavascriptInterface(new NativeLocationBridge(this), "NativeLocation");
        Log.d(TAG, "已注册原生定位桥接器");

        // 初始化并注册原生语音识别桥接器
        nativeVoiceRecognitionBridge = new NativeVoiceRecognitionBridge(this);
        getBridge().getWebView().addJavascriptInterface(nativeVoiceRecognitionBridge, "NativeVoice");
        Log.d(TAG, "已注册原生语音识别桥接器");

        // 主动检查并请求位置权限
        checkAndRequestLocationPermissions();

        // 主动检查并请求麦克风权限
        checkAndRequestMicrophonePermission();
    }

    /**
     * 配置WebView以支持麦克风访问
     */
    private void configureWebView() {
        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();

        // 启用JavaScript
        settings.setJavaScriptEnabled(true);

        // 启用DOM存储
        settings.setDomStorageEnabled(true);

        // 启用媒体播放
        settings.setMediaPlaybackRequiresUserGesture(false);

        // 设置WebChromeClient以处理权限请求
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                Log.d(TAG, "WebView请求权限: " + Arrays.toString(request.getResources()));

                // 在UI线程上授予权限
                runOnUiThread(() -> {
                    // 授予所有请求的资源权限
                    request.grant(request.getResources());
                    Log.d(TAG, "已授予WebView请求的权限");
                });
            }
        });

        Log.d(TAG, "WebView配置完成");
    }

    /**
     * 检查并请求麦克风权限
     */
    private void checkAndRequestMicrophonePermission() {
        Log.d(TAG, "检查麦克风权限");

        boolean microphonePermissionGranted = ContextCompat.checkSelfPermission(this,
                Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;

        Log.d(TAG, "麦克风权限状态: " + (microphonePermissionGranted ? "已授权" : "未授权"));

        if (!microphonePermissionGranted) {
            Log.d(TAG, "请求麦克风权限");
            ActivityCompat.requestPermissions(
                this,
                new String[] { Manifest.permission.RECORD_AUDIO },
                MICROPHONE_PERMISSION_REQUEST_CODE
            );
        } else {
            Log.d(TAG, "麦克风权限已授予");
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
        // 处理麦克风权限请求结果
        else if (requestCode == MICROPHONE_PERMISSION_REQUEST_CODE) {
            boolean microphoneGranted = false;

            for (int i = 0; i < permissions.length; i++) {
                if (permissions[i].equals(Manifest.permission.RECORD_AUDIO)) {
                    microphoneGranted = grantResults[i] == PackageManager.PERMISSION_GRANTED;
                    break;
                }
            }

            if (microphoneGranted) {
                Log.d(TAG, "麦克风权限已授予，可以使用语音识别功能");
                notifyMicrophonePermissionGranted();
            } else {
                Log.d(TAG, "麦克风权限被拒绝，无法使用语音识别功能");
                notifyMicrophonePermissionDenied();
            }
        }
        // 处理语音识别权限请求结果
        else if (requestCode == VOICE_PERMISSION_REQUEST_CODE) {
            boolean voicePermissionGranted = false;

            for (int i = 0; i < permissions.length; i++) {
                if (permissions[i].equals(Manifest.permission.RECORD_AUDIO)) {
                    voicePermissionGranted = grantResults[i] == PackageManager.PERMISSION_GRANTED;
                    break;
                }
            }

            if (voicePermissionGranted) {
                Log.d(TAG, "语音识别权限已授予");
                if (nativeVoiceRecognitionBridge != null) {
                    // 通知原生桥接器权限已授予
                    nativeVoiceRecognitionBridge.notifyPermissionGranted();
                }
            } else {
                Log.d(TAG, "语音识别权限被拒绝");
                if (nativeVoiceRecognitionBridge != null) {
                    // 通知原生桥接器权限被拒绝
                    nativeVoiceRecognitionBridge.notifyPermissionDenied();
                }
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
     * 通知JS层麦克风权限已授予
     */
    private void notifyMicrophonePermissionGranted() {
        // 通过Bridge通知JS层
        Log.d(TAG, "通知JS层麦克风权限已授予");
        getBridge().triggerWindowJSEvent("microphonePermissionGranted", "{}");
    }

    /**
     * 通知JS层麦克风权限被拒绝
     */
    private void notifyMicrophonePermissionDenied() {
        // 通过Bridge通知JS层
        Log.d(TAG, "通知JS层麦克风权限被拒绝");
        getBridge().triggerWindowJSEvent("microphonePermissionDenied", "{}");
    }

    @Override
    public void onDestroy() {
        // 清理语音识别资源
        if (nativeVoiceRecognitionBridge != null) {
            nativeVoiceRecognitionBridge.destroy();
            nativeVoiceRecognitionBridge = null;
        }

        super.onDestroy();
    }
}
