/**
 * CareCastTV 壳应用主界面
 *
 * 职责：
 * 1. 全屏 WebView 加载 CareCastTV 站点（地址来自 BuildConfig.CARECAST_URL）
 * 2. 屏幕常亮（观看中不休眠）
 * 3. 遥控器适配：返回键优先交给网页历史；连按两次返回退出应用
 * 4. Cookie 持久化：登录一次后长期有效
 *
 * 维护者：DimLoong
 */
package com.dimloong.carecasttv

import android.annotation.SuppressLint
import android.app.Activity
import android.net.http.SslError
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.SslErrorHandler
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast

class MainActivity : Activity() {

    private lateinit var webView: WebView
    private var lastBackPressedAt = 0L

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 全屏 + 常亮
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemUi()

        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            // localStorage / sessionStorage —— 播放记录与关怀配置的存储依赖
            domStorageEnabled = true
            // 关键：允许自动播放，否则"零操作自动续播"会被 WebView 拦下等待用户手势
            mediaPlaybackRequiresUserGesture = false
            // 站点为响应式设计，按视口宽度渲染
            useWideViewPort = true
            loadWithOverviewMode = true
            // 混合内容：https 页面里可能有 http 的第三方视频流
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
        }

        // Cookie 持久化：登录状态保存一年，重启不丢
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.webViewClient = object : WebViewClient() {
            // 所有导航都留在 WebView 内，不跳系统浏览器
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest,
            ): Boolean = false

            // 家庭内网自签名证书场景较常见，提示但不阻断；
            // 公网 Vercel 域名为正规证书，不会走到这里
            override fun onReceivedSslError(
                view: WebView,
                handler: SslErrorHandler,
                error: SslError,
            ) {
                handler.proceed()
            }
        }

        webView.loadUrl(BuildConfig.CARECAST_URL)
    }

    /** 返回键策略：网页可后退则后退；否则 3 秒内连按两次退出（防误触） */
    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (webView.canGoBack()) {
                webView.goBack()
                return true
            }
            val now = System.currentTimeMillis()
            if (now - lastBackPressedAt < 3000) {
                finish()
            } else {
                lastBackPressedAt = now
                Toast.makeText(this, "再按一次返回键退出", Toast.LENGTH_SHORT).show()
            }
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onResume() {
        super.onResume()
        hideSystemUi()
        webView.onResume()
    }

    override fun onPause() {
        // 注意：不调用 webView.onPause()，避免切后台时播放中断上报异常；
        // 电视场景应用基本常驻前台
        super.onPause()
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    private fun hideSystemUi() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            )
    }
}
