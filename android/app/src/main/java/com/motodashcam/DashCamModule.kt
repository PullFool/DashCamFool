package com.motodashcam

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.camera2.*
import android.media.MediaRecorder
import android.os.Environment
import android.os.Handler
import android.os.HandlerThread
import android.util.Size
import android.view.Surface
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

class DashCamModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "DashCamRecorder"

    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var mediaRecorder: MediaRecorder? = null
    private var backgroundThread: HandlerThread? = null
    private var backgroundHandler: Handler? = null
    private var isRecording = false
    private var currentFilePath: String? = null
    private var recordingDir: String? = null

    private fun startBackgroundThread() {
        backgroundThread = HandlerThread("CameraBackground").also { it.start() }
        backgroundHandler = Handler(backgroundThread!!.looper)
    }

    private fun stopBackgroundThread() {
        backgroundThread?.quitSafely()
        try {
            backgroundThread?.join()
            backgroundThread = null
            backgroundHandler = null
        } catch (_: Exception) {}
    }

    @ReactMethod
    fun setup(storagePath: String, promise: Promise) {
        try {
            recordingDir = storagePath
            val dir = File(storagePath)
            if (!dir.exists()) dir.mkdirs()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SETUP_ERROR", e.message)
        }
    }

    @ReactMethod
    fun startRecording(quality: String, promise: Promise) {
        if (isRecording) {
            promise.reject("ALREADY_RECORDING", "Already recording")
            return
        }

        try {
            startBackgroundThread()

            val cameraManager = reactContext.getSystemService(Context.CAMERA_SERVICE) as CameraManager

            // Find back camera
            var cameraId: String? = null
            for (id in cameraManager.cameraIdList) {
                val characteristics = cameraManager.getCameraCharacteristics(id)
                val facing = characteristics.get(CameraCharacteristics.LENS_FACING)
                if (facing == CameraCharacteristics.LENS_FACING_BACK) {
                    cameraId = id
                    break
                }
            }

            if (cameraId == null) {
                promise.reject("NO_CAMERA", "No back camera found")
                return
            }

            // Get video size based on quality
            val videoSize = when (quality) {
                "fhd" -> Size(1920, 1080)
                "hd" -> Size(1280, 720)
                else -> Size(640, 480)
            }

            // Generate file path
            val timestamp = SimpleDateFormat("yyyy-MM-dd_HH-mm-ss", Locale.US).format(Date())
            val fileName = "moto_${timestamp}.mp4"
            currentFilePath = "${recordingDir}/${fileName}"

            // Setup MediaRecorder
            setupMediaRecorder(videoSize)

            // Check permission
            if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
                promise.reject("NO_PERMISSION", "Camera permission not granted")
                return
            }

            // Open camera
            cameraManager.openCamera(cameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(camera: CameraDevice) {
                    cameraDevice = camera
                    createRecordingSession(camera, promise)
                }

                override fun onDisconnected(camera: CameraDevice) {
                    camera.close()
                    cameraDevice = null
                }

                override fun onError(camera: CameraDevice, error: Int) {
                    camera.close()
                    cameraDevice = null
                    promise.reject("CAMERA_ERROR", "Camera error: $error")
                }
            }, backgroundHandler)

        } catch (e: Exception) {
            promise.reject("START_ERROR", e.message)
        }
    }

    private fun setupMediaRecorder(videoSize: Size) {
        mediaRecorder = MediaRecorder().apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setVideoSource(MediaRecorder.VideoSource.SURFACE)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setOutputFile(currentFilePath)
            setVideoEncodingBitRate(2500000)
            setVideoFrameRate(30)
            setVideoSize(videoSize.width, videoSize.height)
            setVideoEncoder(MediaRecorder.VideoEncoder.H264)
            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            setAudioEncodingBitRate(128000)
            setAudioSamplingRate(44100)
            prepare()
        }
    }

    private fun createRecordingSession(camera: CameraDevice, promise: Promise) {
        try {
            val recorder = mediaRecorder ?: return
            val recorderSurface = recorder.surface

            val captureRequestBuilder = camera.createCaptureRequest(CameraDevice.TEMPLATE_RECORD)
            captureRequestBuilder.addTarget(recorderSurface)

            camera.createCaptureSession(
                listOf(recorderSurface),
                object : CameraCaptureSession.StateCallback() {
                    override fun onConfigured(session: CameraCaptureSession) {
                        captureSession = session
                        captureRequestBuilder.set(
                            CaptureRequest.CONTROL_MODE,
                            CameraMetadata.CONTROL_MODE_AUTO
                        )
                        session.setRepeatingRequest(captureRequestBuilder.build(), null, backgroundHandler)

                        // Start recording
                        recorder.start()
                        isRecording = true

                        promise.resolve(WritableNativeMap().apply {
                            putString("filePath", currentFilePath)
                            putBoolean("recording", true)
                        })
                    }

                    override fun onConfigureFailed(session: CameraCaptureSession) {
                        promise.reject("SESSION_ERROR", "Failed to configure camera session")
                    }
                },
                backgroundHandler
            )
        } catch (e: Exception) {
            promise.reject("SESSION_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopRecording(promise: Promise) {
        if (!isRecording) {
            promise.resolve(null)
            return
        }

        try {
            isRecording = false

            // Stop recording
            mediaRecorder?.apply {
                stop()
                reset()
                release()
            }
            mediaRecorder = null

            // Close camera session
            captureSession?.close()
            captureSession = null

            cameraDevice?.close()
            cameraDevice = null

            stopBackgroundThread()

            val filePath = currentFilePath
            currentFilePath = null

            if (filePath != null) {
                val file = File(filePath)
                promise.resolve(WritableNativeMap().apply {
                    putString("filePath", filePath)
                    putDouble("fileSize", file.length().toDouble())
                    putDouble("duration", 0.0) // Will be calculated by JS
                })
            } else {
                promise.resolve(null)
            }

        } catch (e: Exception) {
            isRecording = false
            mediaRecorder?.release()
            mediaRecorder = null
            captureSession?.close()
            captureSession = null
            cameraDevice?.close()
            cameraDevice = null
            stopBackgroundThread()
            promise.reject("STOP_ERROR", e.message)
        }
    }

    @ReactMethod
    fun isCurrentlyRecording(promise: Promise) {
        promise.resolve(isRecording)
    }
}
