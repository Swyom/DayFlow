package expo.modules.dayflowdevice

import android.Manifest
import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process

data class AppUsageEntry(val packageName: String, val appName: String, val usageMs: Long)

object UsageStats {
  // Event type values (stable since API 21; named ACTIVITY_RESUMED / ACTIVITY_PAUSED from API 29).
  private const val RESUMED = 1
  private const val PAUSED = 2
  private const val SCREEN_NON_INTERACTIVE = 16
  private const val DEVICE_SHUTDOWN = 26

  fun hasAccess(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    @Suppress("DEPRECATION")
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    } else {
      appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    }
    return if (mode == AppOpsManager.MODE_DEFAULT) {
      context.checkCallingOrSelfPermission(Manifest.permission.PACKAGE_USAGE_STATS) == PackageManager.PERMISSION_GRANTED
    } else {
      mode == AppOpsManager.MODE_ALLOWED
    }
  }

  /**
   * Foreground time per app between [start] and [end], computed from activity resume and
   * pause events (the signal Digital Wellbeing uses). Only apps a person can open from the
   * launcher are listed; the home screen and system UI are left out.
   */
  fun query(context: Context, start: Long, end: Long): List<AppUsageEntry> {
    val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val events = manager.queryEvents(start, end)
    val event = UsageEvents.Event()

    val openActivities = HashMap<String, MutableSet<String>>() // package -> resumed activity classes
    val openedAt = HashMap<String, Long>() // package -> when it came to the foreground
    val seen = HashSet<String>()
    val totals = HashMap<String, Long>()

    fun add(pkg: String, from: Long, to: Long) {
      if (to > from) totals[pkg] = (totals[pkg] ?: 0L) + (to - from)
    }

    fun closeAll(at: Long) {
      for ((pkg, since) in openedAt) add(pkg, since, at)
      openedAt.clear()
      openActivities.clear()
    }

    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val pkg = event.packageName ?: continue
      val cls = event.className ?: ""
      val at = event.timeStamp
      when (event.eventType) {
        RESUMED -> {
          val open = openActivities.getOrPut(pkg) { mutableSetOf() }
          if (open.isEmpty()) openedAt[pkg] = at
          open.add(cls)
          seen.add(pkg)
        }
        PAUSED -> {
          val open = openActivities[pkg]
          if (open != null && open.remove(cls)) {
            if (open.isEmpty()) {
              openedAt.remove(pkg)?.let { add(pkg, it, at) }
              openActivities.remove(pkg)
            }
          } else if (!seen.contains(pkg)) {
            // Was already in the foreground when the period started.
            add(pkg, start, at)
          }
          seen.add(pkg)
        }
        SCREEN_NON_INTERACTIVE, DEVICE_SHUTDOWN -> closeAll(at)
      }
    }
    // Still in the foreground at the end of the period (normally DayFlow itself).
    closeAll(end)

    val pm = context.packageManager
    val home = pm.resolveActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0)?.activityInfo?.packageName
    val span = end - start
    return totals.mapNotNull { (pkg, ms) ->
      if (pkg == home || pm.getLaunchIntentForPackage(pkg) == null) return@mapNotNull null
      val label = try {
        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
      } catch (_: PackageManager.NameNotFoundException) {
        pkg
      }
      AppUsageEntry(pkg, label, ms.coerceAtMost(span))
    }.sortedByDescending { it.usageMs }
  }
}
