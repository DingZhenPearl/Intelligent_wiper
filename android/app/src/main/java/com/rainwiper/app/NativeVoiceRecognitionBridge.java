package com.rainwiper.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Log;
import android.webkit.JavascriptInterface;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Locale;

/**
 * 原生语音识别桥接器
 * 提供JavaScript调用原生语音识别功能的接口
 */
public class NativeVoiceRecognitionBridge {
    private static final String TAG = "NativeVoiceRecognition";
    private static final int VOICE_PERMISSION_REQUEST_CODE = 1003;

    private Activity activity;
    private SpeechRecognizer speechRecognizer;
    private boolean isListening = false;

    /**
     * 构造函数
     * @param activity 主活动
     */
    public NativeVoiceRecognitionBridge(Activity activity) {
        this.activity = activity;
        Log.d(TAG, "原生语音识别桥接器已创建");
    }

    /**
     * 检查麦克风权限
     * @return 是否已授予权限
     */
    @JavascriptInterface
    public boolean checkMicrophonePermission() {
        Log.d(TAG, "检查麦克风权限");

        boolean granted = ContextCompat.checkSelfPermission(activity,
                Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;

        Log.d(TAG, "麦克风权限状态: " + (granted ? "已授予" : "未授予"));
        return granted;
    }

    /**
     * 请求麦克风权限
     */
    @JavascriptInterface
    public void requestMicrophonePermission() {
        Log.d(TAG, "请求麦克风权限");

        if (checkMicrophonePermission()) {
            Log.d(TAG, "麦克风权限已授予，无需请求");
            notifyPermissionGranted();
            return;
        }

        activity.runOnUiThread(() -> {
            ActivityCompat.requestPermissions(
                activity,
                new String[] { Manifest.permission.RECORD_AUDIO },
                VOICE_PERMISSION_REQUEST_CODE
            );
        });
    }

    /**
     * 通知权限已授予
     */
    public void notifyPermissionGranted() {
        Log.d(TAG, "通知JS层麦克风权限已授予");

        activity.runOnUiThread(() -> {
            ((MainActivity) activity).getBridge().triggerWindowJSEvent(
                "nativeVoicePermissionGranted",
                "{}"
            );
        });
    }

    /**
     * 通知权限被拒绝
     */
    public void notifyPermissionDenied() {
        Log.d(TAG, "通知JS层麦克风权限被拒绝");

        activity.runOnUiThread(() -> {
            ((MainActivity) activity).getBridge().triggerWindowJSEvent(
                "nativeVoicePermissionDenied",
                "{}"
            );
        });
    }

    /**
     * 初始化语音识别器
     */
    private void initSpeechRecognizer() {
        Log.d(TAG, "初始化语音识别器");

        if (speechRecognizer != null) {
            speechRecognizer.destroy();
        }

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(activity);

        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle bundle) {
                Log.d(TAG, "准备开始语音识别");
                System.out.println("【语音识别】准备开始语音识别，请说话...");
                isListening = true;
                notifyListeningStateChanged(true);
            }

            @Override
            public void onBeginningOfSpeech() {
                Log.d(TAG, "开始语音输入");
                System.out.println("【语音识别】检测到语音输入开始");
            }

            @Override
            public void onRmsChanged(float v) {
                // 音量变化，可以用来显示音量指示器
            }

            @Override
            public void onBufferReceived(byte[] bytes) {
                // 接收到语音数据
            }

            @Override
            public void onEndOfSpeech() {
                Log.d(TAG, "语音输入结束");
                System.out.println("【语音识别】语音输入结束，正在处理...");
                isListening = false;
                notifyListeningStateChanged(false);
            }

            @Override
            public void onError(int errorCode) {
                Log.e(TAG, "语音识别错误: " + errorCode);
                isListening = false;
                notifyListeningStateChanged(false);

                String errorMessage;
                switch (errorCode) {
                    case SpeechRecognizer.ERROR_AUDIO:
                        errorMessage = "音频录制错误";
                        break;
                    case SpeechRecognizer.ERROR_CLIENT:
                        errorMessage = "客户端错误";
                        break;
                    case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                        errorMessage = "权限不足";
                        break;
                    case SpeechRecognizer.ERROR_NETWORK:
                        errorMessage = "网络错误";
                        break;
                    case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                        errorMessage = "网络超时";
                        break;
                    case SpeechRecognizer.ERROR_NO_MATCH:
                        errorMessage = "未能匹配语音";
                        break;
                    case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                        errorMessage = "识别器忙";
                        break;
                    case SpeechRecognizer.ERROR_SERVER:
                        errorMessage = "服务器错误";
                        break;
                    case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                        errorMessage = "语音超时";
                        break;
                    default:
                        errorMessage = "未知错误";
                        break;
                }

                System.out.println("【语音识别】错误: " + errorMessage + " (代码: " + errorCode + ")");
                notifyError(errorCode, errorMessage);
            }

            @Override
            public void onResults(Bundle results) {
                Log.d(TAG, "获取语音识别结果");

                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) {
                    // 获取最佳匹配结果
                    String result = matches.get(0);
                    Log.d(TAG, "最佳识别结果: " + result);

                    // 输出所有可能的匹配结果
                    Log.d(TAG, "所有识别结果:");
                    for (int i = 0; i < matches.size(); i++) {
                        Log.d(TAG, "  " + (i + 1) + ". " + matches.get(i));
                    }

                    // 获取置信度分数（如果有）
                    float[] confidenceScores = results.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);
                    if (confidenceScores != null && confidenceScores.length > 0) {
                        Log.d(TAG, "置信度分数:");
                        for (int i = 0; i < Math.min(matches.size(), confidenceScores.length); i++) {
                            Log.d(TAG, "  " + (i + 1) + ". " + matches.get(i) + " - " + confidenceScores[i]);
                        }
                    }

                    // 输出到控制台
                    System.out.println("【语音识别】识别到语音: " + result);

                    // 通知结果
                    notifyResult(result);
                } else {
                    Log.d(TAG, "未获取到识别结果");
                    System.out.println("【语音识别】未获取到识别结果");
                    notifyError(SpeechRecognizer.ERROR_NO_MATCH, "未获取到识别结果");
                }
            }

            @Override
            public void onPartialResults(Bundle bundle) {
                // 部分识别结果
                ArrayList<String> partialResults = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (partialResults != null && !partialResults.isEmpty()) {
                    String partialResult = partialResults.get(0);
                    Log.d(TAG, "部分识别结果: " + partialResult);
                    System.out.println("【语音识别】部分识别结果: " + partialResult);
                }
            }

            @Override
            public void onEvent(int i, Bundle bundle) {
                // 其他事件
            }
        });
    }

    /**
     * 开始语音识别
     */
    @JavascriptInterface
    public void startListening() {
        Log.d(TAG, "开始语音识别");

        if (!checkMicrophonePermission()) {
            Log.e(TAG, "没有麦克风权限，无法启动语音识别");
            notifyError(SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS, "没有麦克风权限");
            return;
        }

        if (isListening) {
            Log.d(TAG, "语音识别已经在运行中");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                if (speechRecognizer == null) {
                    initSpeechRecognizer();
                }

                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "zh-CN");
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, activity.getPackageName());

                speechRecognizer.startListening(intent);
                Log.d(TAG, "语音识别已启动");
                System.out.println("【语音识别】语音识别已启动");
            } catch (Exception e) {
                Log.e(TAG, "启动语音识别失败: " + e.getMessage());
                notifyError(-1, "启动语音识别失败: " + e.getMessage());
            }
        });
    }

    /**
     * 停止语音识别
     */
    @JavascriptInterface
    public void stopListening() {
        Log.d(TAG, "停止语音识别");

        if (!isListening) {
            Log.d(TAG, "语音识别未在运行");
            return;
        }

        activity.runOnUiThread(() -> {
            if (speechRecognizer != null) {
                try {
                    speechRecognizer.stopListening();
                    isListening = false;
                    notifyListeningStateChanged(false);
                    Log.d(TAG, "语音识别已停止");
                    System.out.println("【语音识别】语音识别已停止");
                } catch (Exception e) {
                    Log.e(TAG, "停止语音识别失败: " + e.getMessage());
                }
            }
        });
    }

    /**
     * 销毁语音识别器
     */
    public void destroy() {
        Log.d(TAG, "销毁语音识别器");

        if (speechRecognizer != null) {
            speechRecognizer.destroy();
            speechRecognizer = null;
        }
    }

    /**
     * 通知监听状态变化
     * @param isListening 是否正在监听
     */
    private void notifyListeningStateChanged(boolean isListening) {
        Log.d(TAG, "通知JS层监听状态变化: " + isListening);

        try {
            JSONObject data = new JSONObject();
            data.put("isListening", isListening);

            String jsonString = data.toString();

            activity.runOnUiThread(() -> {
                ((MainActivity) activity).getBridge().triggerWindowJSEvent(
                    "nativeVoiceListeningChanged",
                    jsonString
                );
            });
        } catch (JSONException e) {
            Log.e(TAG, "创建JSON数据失败: " + e.getMessage());
        }
    }

    /**
     * 通知识别结果
     * @param result 识别结果
     */
    private void notifyResult(String result) {
        Log.d(TAG, "通知JS层识别结果: " + result);

        try {
            JSONObject data = new JSONObject();
            data.put("result", result);

            String jsonString = data.toString();

            activity.runOnUiThread(() -> {
                ((MainActivity) activity).getBridge().triggerWindowJSEvent(
                    "nativeVoiceResult",
                    jsonString
                );
            });
        } catch (JSONException e) {
            Log.e(TAG, "创建JSON数据失败: " + e.getMessage());
        }
    }

    /**
     * 通知错误
     * @param errorCode 错误代码
     * @param errorMessage 错误消息
     */
    private void notifyError(int errorCode, String errorMessage) {
        Log.e(TAG, "通知JS层错误: " + errorCode + " - " + errorMessage);

        try {
            JSONObject data = new JSONObject();
            data.put("errorCode", errorCode);
            data.put("errorMessage", errorMessage);

            String jsonString = data.toString();

            activity.runOnUiThread(() -> {
                ((MainActivity) activity).getBridge().triggerWindowJSEvent(
                    "nativeVoiceError",
                    jsonString
                );
            });
        } catch (JSONException e) {
            Log.e(TAG, "创建JSON数据失败: " + e.getMessage());
        }
    }
}
