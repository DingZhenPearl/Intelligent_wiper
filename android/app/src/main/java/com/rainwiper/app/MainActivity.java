package com.rainwiper.app;

import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 初始化时打印日志，便于调试
        Log.d(TAG, "MainActivity onCreate");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        // 打印权限请求结果，便于调试
        Log.d(TAG, "Permission request result - requestCode: " + requestCode);
        for (int i = 0; i < permissions.length; i++) {
            Log.d(TAG, "Permission: " + permissions[i] + ", result: " + grantResults[i]);
        }
    }
}
