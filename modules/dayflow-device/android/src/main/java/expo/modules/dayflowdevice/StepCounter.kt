package expo.modules.dayflowdevice

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.provider.Settings
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** One reading of the cumulative step counter. `boot` changes on every reboot (the counter restarts at 0). */
data class StepSample(val t: Long, val counter: Long, val boot: Long)

object StepCounter {
  fun sensor(context: Context): Sensor? =
    (context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager)?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

  fun hasPermission(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
      context.checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED

  /** Settings.Global.BOOT_COUNT increases on every reboot; -1 if a ROM hides it (a lower counter still reveals a reboot). */
  fun bootId(context: Context): Long =
    try {
      Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT).toLong()
    } catch (_: Exception) {
      -1L
    }

  fun sampleOf(context: Context, value: Float) = StepSample(System.currentTimeMillis(), value.toLong(), bootId(context))

  /**
   * Waits up to [timeoutMs] for one reading. Most devices report the current value as soon
   * as a listener registers; some only report on the next step, in which case this returns
   * null and nothing is recorded (no steps were taken, so nothing is lost).
   */
  fun readOnce(context: Context, timeoutMs: Long): StepSample? {
    val manager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return null
    val sensor = manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) ?: return null
    if (!hasPermission(context)) return null
    val latch = CountDownLatch(1)
    var value: Float? = null
    val thread = HandlerThread("dayflow-step-read").apply { start() }
    val listener = object : SensorEventListener {
      override fun onSensorChanged(event: SensorEvent) {
        value = event.values[0]
        latch.countDown()
      }

      override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
    }
    try {
      manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL, Handler(thread.looper))
      latch.await(timeoutMs, TimeUnit.MILLISECONDS)
    } finally {
      manager.unregisterListener(listener)
      thread.quitSafely()
    }
    return value?.let { sampleOf(context, it) }
  }
}

/** Readings taken while the app is closed, kept until the app has processed them. */
object StepSampleStore {
  private const val PREFS = "dayflow_step_samples"
  private const val KEY = "samples"
  private const val MAX_SAMPLES = 3000 // about 31 days at one reading per 15 minutes

  @Synchronized
  fun append(context: Context, sample: StepSample) {
    val all = read(context).toMutableList()
    all.add(sample)
    write(context, all.takeLast(MAX_SAMPLES))
  }

  @Synchronized
  fun read(context: Context): List<StepSample> {
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null) ?: return emptyList()
    return try {
      val arr = JSONArray(raw)
      (0 until arr.length()).mapNotNull { i ->
        val item = arr.optJSONArray(i) ?: return@mapNotNull null
        StepSample(item.optLong(0), item.optLong(1), item.optLong(2))
      }
    } catch (_: Exception) {
      emptyList()
    }
  }

  /** Drops readings up to and including [upTo] (ms since epoch). */
  @Synchronized
  fun clear(context: Context, upTo: Long) = write(context, read(context).filter { it.t > upTo })

  private fun write(context: Context, samples: List<StepSample>) {
    val arr = JSONArray()
    samples.forEach { arr.put(JSONArray().put(it.t).put(it.counter).put(it.boot)) }
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, arr.toString()).apply()
  }
}

/** Periodic job (WorkManager, at least 15 minutes apart) that stores one step-counter reading. */
class StepSampleWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    StepCounter.readOnce(applicationContext, 10_000)?.let { StepSampleStore.append(applicationContext, it) }
    return Result.success()
  }

  companion object {
    private const val NAME = "dayflow-step-samples"

    fun schedule(context: Context) {
      val request = PeriodicWorkRequest.Builder(StepSampleWorker::class.java, 15, TimeUnit.MINUTES).build()
      WorkManager.getInstance(context).enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    fun cancel(context: Context) {
      WorkManager.getInstance(context).cancelUniqueWork(NAME)
    }
  }
}
