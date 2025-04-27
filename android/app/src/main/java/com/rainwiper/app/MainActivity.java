package com.rainwiper.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final int LOCATION_PERMISSION_REQUEST_CODE = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 初始化时打印日志，便于调试
        Log.d(TAG, "MainActivity onCreate");

        // 主动检查并请求位置权限
        checkAndRequestLocationPermissions();
    }

    /**
     * 检查并请求位置权限
     */
    private void checkAndRequestLocationPermissions() {
        Log.d(TAG, "检查位置权限状态");

        boolean fineLocationGranted = ContextCompat.checkSelfPermission(this,
                Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarseLocationGranted = ContextCompat.checkSelfPermission(this,
                Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        Log.d(TAG, "精确位置权限状态: " + (fineLocationGranted ? "已授权" : "未授权"));
        Log.d(TAG, "粗略位置权限状态: " + (coarseLocationGranted ? "已授权" : "未授权"));

        // 如果没有位置权限，请求权限
        if (!fineLocationGranted || !coarseLocationGranted) {
            Log.d(TAG, "请求位置权限");
            ActivityCompat.requestPermissions(
                this,
                new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                },
                LOCATION_PERMISSION_REQUEST_CODE
            );
        } else {
            Log.d(TAG, "已有位置权限，无需请求");
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

        // 处理位置权限请求结果
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
                Log.d(TAG, "位置权限已授予，可以获取位置信息");
                // 权限已授予，可以通知JS层
                notifyLocationPermissionGranted();
            } else {
                Log.d(TAG, "位置权限被拒绝，无法获取位置信息");
                // 权限被拒绝，可以通知JS层
                notifyLocationPermissionDenied();
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
}
