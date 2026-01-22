"use client"

import { useEffect, useRef, useState } from "react"

export interface EmotionData {
  emotion: string
  confidence: number
}

declare global {
  interface Window {
    faceapi: any
  }
}

export function useEmotionDetection(isActive: boolean) {
  const [currentEmotion, setCurrentEmotion] = useState<EmotionData | null>(null)
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const faceapiLoadedRef = useRef(false)

  useEffect(() => {
    const loadFaceApi = async () => {
      if (faceapiLoadedRef.current || window.faceapi) {
        setIsModelLoaded(true)
        return
      }

      try {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script")
          script.src = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/dist/face-api.min.js"
          script.async = true
          script.onload = () => resolve()
          script.onerror = () => reject(new Error("Failed to load face-api.js"))
          document.head.appendChild(script)
        })

        const faceapi = window.faceapi
        if (!faceapi) {
          throw new Error("face-api.js not loaded")
        }

        const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model"

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ])

        faceapiLoadedRef.current = true
        setIsModelLoaded(true)
        setLoadingError(null)
      } catch (error) {
        console.error("Error loading face-api.js:", error)
        setLoadingError("Failed to load emotion detection")
        setIsModelLoaded(false)
      }
    }

    loadFaceApi()
  }, [])

  useEffect(() => {
    if (!isActive || !isModelLoaded || loadingError) {
      stopDetection()
      return
    }

    startWebcam()

    return () => {
      stopDetection()
    }
  }, [isActive, isModelLoaded, loadingError])

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream

        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          setTimeout(() => {
            startEmotionDetection()
          }, 1000)
        }
      }
    } catch (error) {
      console.error("Error accessing webcam:", error)
      setLoadingError("Failed to access webcam")
    }
  }

  const startEmotionDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current)
    }

    detectionIntervalRef.current = setInterval(async () => {
      await detectEmotion()
    }, 500)
  }

  const detectEmotion = async () => {
    const faceapi = window.faceapi
    if (!faceapi || !videoRef.current || !canvasRef.current) return

    try {
      if (videoRef.current.readyState !== 4) return

      const detections = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions()

      if (detections && detections.expressions) {
        const expressions = detections.expressions
        
        let dominantEmotion = "neutral"
        let maxScore = 0

        const emotionMap: Record<string, number> = {
          neutral: expressions.neutral || 0,
          happy: expressions.happy || 0,
          sad: expressions.sad || 0,
          angry: expressions.angry || 0,
          fearful: expressions.fearful || 0,
          disgusted: expressions.disgusted || 0,
          surprised: expressions.surprised || 0,
        }

        for (const [emotion, score] of Object.entries(emotionMap)) {
          if (score > maxScore) {
            maxScore = score
            dominantEmotion = emotion
          }
        }

        setCurrentEmotion({
          emotion: dominantEmotion,
          confidence: maxScore,
        })

        const context = canvasRef.current.getContext("2d")
        if (context) {
          const displaySize = {
            width: videoRef.current.videoWidth,
            height: videoRef.current.videoHeight,
          }
          faceapi.matchDimensions(canvasRef.current, displaySize)
          context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
          
          const resizedDetections = faceapi.resizeResults(detections, displaySize)
          faceapi.draw.drawDetections(canvasRef.current, resizedDetections)
        }
      } else {
        setCurrentEmotion({ emotion: "neutral", confidence: 0.5 })
      }
    } catch {
      // Silently handle errors
    }
  }

  const stopDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current)
      detectionIntervalRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setCurrentEmotion(null)
  }

  return {
    currentEmotion,
    isModelLoaded,
    loadingError,
    videoRef,
    canvasRef,
  }
}
