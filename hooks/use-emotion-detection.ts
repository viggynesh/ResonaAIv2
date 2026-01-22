"use client"

import { useEffect, useRef, useState } from "react"

export interface EmotionData {
  emotion: string
  confidence: number
}

export function useEmotionDetection(isActive: boolean) {
  const [currentEmotion, setCurrentEmotion] = useState<EmotionData | null>(null)
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const humanRef = useRef<any>(null)

  useEffect(() => {
    const loadHuman = async () => {
      try {
        console.log("[v0] Loading Human library...")
        const Human = (await import("@vladmandic/human")).default

        const config = {
          modelBasePath: "https://cdn.jsdelivr.net/npm/@vladmandic/human/models",
          face: {
            enabled: true,
            detector: { rotation: false },
            mesh: { enabled: false },
            iris: { enabled: false },
            description: { enabled: false },
            emotion: { enabled: true },
          },
          body: { enabled: false },
          hand: { enabled: false },
          object: { enabled: false },
          gesture: { enabled: false },
        }

        humanRef.current = new Human(config)

        console.log("[v0] Loading Human models...")
        await humanRef.current.load()

        console.log("[v0] Human library loaded successfully")
        setIsModelLoaded(true)
        setLoadingError(null)
      } catch (error) {
        console.error("[v0] Error loading Human library:", error)
        setLoadingError("Failed to load emotion detection")
        setIsModelLoaded(false)
      }
    }

    loadHuman()
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
      console.log("[v0] Starting webcam for emotion detection...")
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
      console.error("[v0] Error accessing webcam:", error)
      setLoadingError("Failed to access webcam")
    }
  }

  const startEmotionDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current)
    }

    console.log("[v0] Starting emotion detection interval...")
    detectionIntervalRef.current = setInterval(async () => {
      await detectEmotion()
    }, 1000)
  }

  const detectEmotion = async () => {
    const human = humanRef.current
    if (!human || !videoRef.current || !canvasRef.current) return

    try {
      if (videoRef.current.readyState !== 4) return

      const result = await human.detect(videoRef.current)

      if (result.face && result.face.length > 0 && result.face[0].emotion) {
        const emotions = result.face[0].emotion

        // Find dominant emotion
        let dominantEmotion = "neutral"
        let maxScore = 0

        for (const [emotion, score] of Object.entries(emotions)) {
          if (score > maxScore) {
            maxScore = score
            dominantEmotion = emotion
          }
        }

        setCurrentEmotion({
          emotion: dominantEmotion,
          confidence: maxScore,
        })

        // Draw on canvas
        const context = canvasRef.current.getContext("2d")
        if (context) {
          context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

          // Draw results using Human's draw methods
          if (human.draw) {
            await human.draw.face(canvasRef.current, result.face)
          }
        }
      } else {
        setCurrentEmotion({ emotion: "neutral", confidence: 0.5 })
      }
    } catch (error) {
      // Silently handle errors
      console.log("[v0] Detection skipped")
    }
  }

  const stopDetection = () => {
    console.log("[v0] Stopping emotion detection...")

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
