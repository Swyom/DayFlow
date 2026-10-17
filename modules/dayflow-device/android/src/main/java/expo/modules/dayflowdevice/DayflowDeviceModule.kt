package expo.modules.dayflowdevice

import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.net.Uri
import android.provider.Settings
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class UsageAccessDeniedException : CodedException("ERR_USAGE_ACCESS", "Usage access has not been granted.", null)

/**
 * DayFlow's Android-only device APIs: the hardware step counter and app usage stats.
 * Nothing here invents data: when a sensor or permission is missing, JS is told so and
 * the app explains it instead of showing numbers.
 */
class DayflowDeviceModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private var liveListener: SensorEventListener? = null

  private fun sampleMap(s: StepSample) = mapOf("t" to s.t.toDouble(), "counter" to s.counter.toDouble(), "boot" to s.boot.toDouble())

  override fun definition() = ModuleDefinition {
    Name("DayflowDevice")

    Events("onStepCounter")

    // ---- Steps ------------------------------------------------------------------------

    Function("isStepCounterAvailable") { StepCounter.sensor(context) != null }

    AsyncFunction("readStepCounter") { timeoutMs: Int ->
      StepCounter.readOnce(context, timeoutMs.toLong())?.let { sampleMap(it) }
    }

    AsyncFunction("getStoredSamples") {
      StepSampleStore.read(context).map { sampleMap(it) }
    }

    AsyncFunction("clearStoredSamples") { upTo: Double ->
      StepSampleStore.clear(context, upTo.toLong())
    }

    Function("startBackgroundSampling") {
      StepSampleWorker.schedule(context)
    }

    Function("stopBackgroundSampling") {
      StepSampleWorker.cancel(context)
    }

    Function("startLiveUpdates") {
      if (liveListener != null) return@Function true
      val ctx = context
      if (!StepCounter.hasPermission(ctx)) return@Function false
      val manager = ctx.getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return@Function false
      val sensor = manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) ?: return@Function false
      val listener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
          sendEvent("onStepCounter", sampleMap(StepCounter.sampleOf(ctx, event.values[0])))
        }

        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
      }
      liveListener = listener
      manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)
    }

    Function("stopLiveUpdates") { stopLive() }

    // ---- Screen time --------------------------------------------------------------------

    Function("hasUsageAccess") { UsageStats.hasAccess(context) }

    Function("openUsageAccessSettings") {
      val ctx = context
      val activity = appContext.currentActivity
      // Some OEM settings apps reject the package URI; retry without it.
      val intents = listOf(
        Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, Uri.parse("package:${ctx.packageName}")),
        Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS),
      )
      for (intent in intents) {
        try {
          if (activity != null) activity.startActivity(intent) else ctx.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
          return@Function true
        } catch (_: Exception) {
          // try the next form
        }
      }
      false
    }

    AsyncFunction("getAppUsage") { startMs: Double, endMs: Double ->
      val ctx = context
      if (!UsageStats.hasAccess(ctx)) throw UsageAccessDeniedException()
      UsageStats.query(ctx, startMs.toLong(), endMs.toLong()).map {
        mapOf("packageName" to it.packageName, "appName" to it.appName, "usageMs" to it.usageMs.toDouble())
      }
    }

    OnDestroy { stopLive() }
  }

  private fun stopLive() {
    val listener = liveListener ?: return
    (appContext.reactContext?.getSystemService(Context.SENSOR_SERVICE) as? SensorManager)?.unregisterListener(listener)
    liveListener = null
  }
}
