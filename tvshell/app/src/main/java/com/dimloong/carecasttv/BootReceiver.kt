/**
 * 开机自启广播接收器
 *
 * 电视开机后自动拉起 CareCastTV，实现"打开电视就能继续看"。
 * 注意：Android 10+ 部分设备限制后台启动界面，需要在系统设置中
 * 为本应用授予"自启动"权限（各厂商入口不同，一般在 应用设置 → 权限/自启管理）。
 *
 * 维护者：DimLoong
 */
package com.dimloong.carecasttv

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (
            intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON"
        ) {
            val launch = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(launch)
        }
    }
}
