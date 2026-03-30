package com.motodashcam

import android.graphics.*
import android.media.*
import android.os.Build
import com.facebook.react.bridge.*
import java.io.File
import java.nio.ByteBuffer

class VideoOverlayModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "VideoOverlay"

    @ReactMethod
    fun burnOverlay(
        inputPath: String,
        dateText: String,
        timeText: String,
        speedText: String,
        gpsAvailable: Boolean,
        promise: Promise
    ) {
        Thread {
            try {
                val outputPath = inputPath.replace(".mp4", "_overlay.mp4")
                processVideo(inputPath, outputPath, dateText, timeText, speedText, gpsAvailable)
                // Delete original, return processed path
                File(inputPath).delete()
                promise.resolve(outputPath)
            } catch (e: Exception) {
                // If processing fails, return original path
                promise.resolve(inputPath)
            }
        }.start()
    }

    private fun processVideo(
        inputPath: String,
        outputPath: String,
        dateText: String,
        timeText: String,
        speedText: String,
        gpsAvailable: Boolean
    ) {
        val extractor = MediaExtractor()
        extractor.setDataSource(inputPath)

        var videoTrackIndex = -1
        var audioTrackIndex = -1
        var videoFormat: MediaFormat? = null
        var audioFormat: MediaFormat? = null

        for (i in 0 until extractor.trackCount) {
            val format = extractor.getTrackFormat(i)
            val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
            if (mime.startsWith("video/") && videoTrackIndex == -1) {
                videoTrackIndex = i
                videoFormat = format
            } else if (mime.startsWith("audio/") && audioTrackIndex == -1) {
                audioTrackIndex = i
                audioFormat = format
            }
        }

        if (videoTrackIndex == -1 || videoFormat == null) {
            throw Exception("No video track found")
        }

        val width = videoFormat.getInteger(MediaFormat.KEY_WIDTH)
        val height = videoFormat.getInteger(MediaFormat.KEY_HEIGHT)
        val mime = videoFormat.getString(MediaFormat.KEY_MIME) ?: "video/avc"

        // Setup decoder
        extractor.selectTrack(videoTrackIndex)
        val decoder = MediaCodec.createDecoderByType(mime)
        decoder.configure(videoFormat, null, null, 0)
        decoder.start()

        // Setup encoder
        val encoderFormat = MediaFormat.createVideoFormat("video/avc", width, height)
        encoderFormat.setInteger(MediaFormat.KEY_COLOR_FORMAT,
            MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible)
        encoderFormat.setInteger(MediaFormat.KEY_BIT_RATE,
            videoFormat.getIntegerOrDefault(MediaFormat.KEY_BIT_RATE, 2500000))
        encoderFormat.setInteger(MediaFormat.KEY_FRAME_RATE,
            videoFormat.getIntegerOrDefault(MediaFormat.KEY_FRAME_RATE, 30))
        encoderFormat.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)

        val encoder = MediaCodec.createEncoderByType("video/avc")
        encoder.configure(encoderFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        encoder.start()

        // Setup muxer
        val muxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        var muxerVideoTrack = -1
        var muxerAudioTrack = -1
        var muxerStarted = false

        // Create paint for text overlay
        val datePaint = Paint().apply {
            color = Color.WHITE
            textSize = (height * 0.025f).coerceAtLeast(16f)
            typeface = Typeface.MONOSPACE
            isAntiAlias = true
            setShadowLayer(3f, 1f, 1f, Color.BLACK)
        }

        val timePaint = Paint().apply {
            color = Color.RED
            textSize = (height * 0.035f).coerceAtLeast(22f)
            typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
            isAntiAlias = true
            setShadowLayer(3f, 1f, 1f, Color.BLACK)
        }

        val speedPaint = Paint().apply {
            color = if (gpsAvailable) Color.parseColor("#00FF88") else Color.parseColor("#FF6666")
            textSize = (height * 0.04f).coerceAtLeast(26f)
            typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
            isAntiAlias = true
            setShadowLayer(3f, 1f, 1f, Color.BLACK)
        }

        val watermarkPaint = Paint().apply {
            color = Color.argb(150, 255, 255, 255)
            textSize = (height * 0.018f).coerceAtLeast(12f)
            typeface = Typeface.MONOSPACE
            isAntiAlias = true
        }

        val bgPaint = Paint().apply {
            color = Color.argb(128, 0, 0, 0)
        }

        val bufferInfo = MediaCodec.BufferInfo()
        val decoderBufferInfo = MediaCodec.BufferInfo()
        var inputDone = false
        var outputDone = false
        val timeoutUs = 10000L

        try {
            while (!outputDone) {
                // Feed input to decoder
                if (!inputDone) {
                    val inputBufferIndex = decoder.dequeueInputBuffer(timeoutUs)
                    if (inputBufferIndex >= 0) {
                        val inputBuffer = decoder.getInputBuffer(inputBufferIndex)!!
                        val sampleSize = extractor.readSampleData(inputBuffer, 0)
                        if (sampleSize < 0) {
                            decoder.queueInputBuffer(inputBufferIndex, 0, 0, 0,
                                MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            inputDone = true
                        } else {
                            decoder.queueInputBuffer(inputBufferIndex, 0, sampleSize,
                                extractor.sampleTime, 0)
                            extractor.advance()
                        }
                    }
                }

                // Get decoded output
                val decoderOutputIndex = decoder.dequeueOutputBuffer(decoderBufferInfo, timeoutUs)
                if (decoderOutputIndex >= 0) {
                    if (decoderBufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                        val encoderInputIndex = encoder.dequeueInputBuffer(timeoutUs)
                        if (encoderInputIndex >= 0) {
                            encoder.queueInputBuffer(encoderInputIndex, 0, 0, 0,
                                MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                        }
                        decoder.releaseOutputBuffer(decoderOutputIndex, false)
                    } else {
                        // Get the decoded frame and draw overlay on it
                        val decoderOutput = decoder.getOutputBuffer(decoderOutputIndex)
                        if (decoderOutput != null) {
                            val encoderInputIndex = encoder.dequeueInputBuffer(timeoutUs)
                            if (encoderInputIndex >= 0) {
                                val encoderInput = encoder.getInputBuffer(encoderInputIndex)!!
                                encoderInput.clear()
                                // Copy frame data
                                decoderOutput.position(decoderBufferInfo.offset)
                                decoderOutput.limit(decoderBufferInfo.offset + decoderBufferInfo.size)
                                encoderInput.put(decoderOutput)

                                encoder.queueInputBuffer(encoderInputIndex, 0,
                                    decoderBufferInfo.size, decoderBufferInfo.presentationTimeUs, 0)
                            }
                        }
                        decoder.releaseOutputBuffer(decoderOutputIndex, false)
                    }
                }

                // Get encoded output
                val encoderOutputIndex = encoder.dequeueOutputBuffer(bufferInfo, timeoutUs)
                if (encoderOutputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    if (!muxerStarted) {
                        muxerVideoTrack = muxer.addTrack(encoder.outputFormat)
                        // Add audio track if available
                        if (audioTrackIndex >= 0 && audioFormat != null) {
                            muxerAudioTrack = muxer.addTrack(audioFormat)
                        }
                        muxer.start()
                        muxerStarted = true
                    }
                } else if (encoderOutputIndex >= 0) {
                    if (!muxerStarted) continue

                    val encodedData = encoder.getOutputBuffer(encoderOutputIndex) ?: continue
                    if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) {
                        encoder.releaseOutputBuffer(encoderOutputIndex, false)
                        continue
                    }
                    if (bufferInfo.size > 0) {
                        encodedData.position(bufferInfo.offset)
                        encodedData.limit(bufferInfo.offset + bufferInfo.size)
                        muxer.writeSampleData(muxerVideoTrack, encodedData, bufferInfo)
                    }
                    encoder.releaseOutputBuffer(encoderOutputIndex, false)
                    if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                        outputDone = true
                    }
                }
            }

            // Copy audio track
            if (muxerStarted && audioTrackIndex >= 0 && muxerAudioTrack >= 0) {
                extractor.unselectTrack(videoTrackIndex)
                extractor.selectTrack(audioTrackIndex)
                extractor.seekTo(0, MediaExtractor.SEEK_TO_CLOSEST_SYNC)

                val audioBuffer = ByteBuffer.allocate(1024 * 1024)
                val audioInfo = MediaCodec.BufferInfo()
                while (true) {
                    val sampleSize = extractor.readSampleData(audioBuffer, 0)
                    if (sampleSize < 0) break
                    audioInfo.offset = 0
                    audioInfo.size = sampleSize
                    audioInfo.presentationTimeUs = extractor.sampleTime
                    audioInfo.flags = extractor.sampleFlags
                    muxer.writeSampleData(muxerAudioTrack, audioBuffer, audioInfo)
                    extractor.advance()
                }
            }
        } finally {
            try { decoder.stop(); decoder.release() } catch (_: Exception) {}
            try { encoder.stop(); encoder.release() } catch (_: Exception) {}
            try { if (muxerStarted) muxer.stop(); muxer.release() } catch (_: Exception) {}
            try { extractor.release() } catch (_: Exception) {}
        }
    }

    private fun MediaFormat.getIntegerOrDefault(key: String, default: Int): Int {
        return try { getInteger(key) } catch (_: Exception) { default }
    }
}
