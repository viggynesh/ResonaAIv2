"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Upload, Mic, Square, Play, Pause, Loader2, AlertCircle, Sparkles, Zap, CheckCircle, Clock } from "lucide-react"

interface PremiumVoiceClonerProps {
  onVoiceCloned: (voiceId: string, audioUrl: string) => void
}

export default function PremiumVoiceCloner({ onVoiceCloned }: PremiumVoiceClonerProps) {
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string>("")
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [recordingTime, setRecordingTime] = useState(20)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleFileUpload = (file: File) => {
    if (file && file.type.startsWith("audio/")) {
      const url = URL.createObjectURL(file)
      setAudioFile(file)
      setRecordedBlob(null)
      setAudioUrl(url)
      setError(null)
    } else {
      setError("Please select a valid audio file (MP3, WAV, M4A, etc.)")
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      })

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      })
      chunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        const url = URL.createObjectURL(blob)
        setRecordedBlob(blob)
        setAudioFile(null)
        setAudioUrl(url)
        stream.getTracks().forEach((track) => track.stop())

        // Reset timer
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current)
          recordingTimerRef.current = null
        }
        setRecordingTime(20)
      }

      mediaRecorderRef.current.start(100)
      setIsRecording(true)
      setError(null)
      setRecordingTime(20)

      // Start countdown timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev <= 1) {
            // Auto-stop recording when timer reaches 0
            stopRecording()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (error) {
      setError("Could not access microphone. Please check permissions.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      // Clear timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }
  }

  // Cleanup timer on component unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
    }
  }, [])

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        audioRef.current.play()
        setIsPlaying(true)
      }
    }
  }

  const processVoiceClone = async () => {
    if (!audioUrl) return

    setIsProcessing(true)
    setProgress(0)
    setError(null)

    try {
      const audioBlob = recordedBlob || audioFile
      if (!audioBlob) throw new Error("No audio available")

      // Step 1: Upload to ElevenLabs for voice cloning
      setCurrentStep("🎤 Uploading voice sample...")
      setProgress(25)

      const formData = new FormData()
      formData.append("audio", audioBlob, "voice-sample.wav")

      const cloneResponse = await fetch("/api/clone-voice", {
        method: "POST",
        body: formData,
      })

      if (!cloneResponse.ok) {
        const errorData = await cloneResponse.json()
        throw new Error(errorData.details || "Voice cloning failed")
      }

      setCurrentStep("🧠 Processing neural patterns...")
      setProgress(50)

      const cloneResult = await cloneResponse.json()

      if (cloneResult.isFallback) {
        setCurrentStep("⚠️ Using default voice...")
        setError(cloneResult.message || "Voice cloning unavailable. Using a default voice instead.")
      } else {
        setCurrentStep("⚡ Optimizing voice model...")
      }
      setProgress(75)

      // Small delay for better UX
      await new Promise((resolve) => setTimeout(resolve, 1000))

      setCurrentStep(cloneResult.isFallback ? "✨ Default voice ready!" : "✨ Voice clone ready!")
      setProgress(100)

      // Complete the process
      setTimeout(() => {
        onVoiceCloned(cloneResult.voiceId, audioUrl)
      }, 1000)
    } catch (error) {
      console.error("Voice cloning error:", error)
      setError(error instanceof Error ? error.message : "Voice cloning failed")
      setIsProcessing(false)
    }
  }

  return (
    <Card className="glass-dark border-yellow-500/30 shadow-2xl glow-gold">
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 gradient-gold-bg rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-black" />
            </div>
            <div>
              <CardTitle className="text-2xl gradient-gold">Neural Voice Cloning</CardTitle>
              <p className="text-gray-400">Advanced AI voice synthesis technology</p>
            </div>
          </div>
          <Badge className="gradient-gold-bg text-black px-4 py-2 font-semibold">
            <Zap className="w-4 h-4 mr-2" />
            Premium
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {error && (
          <div className="glass-dark border-red-500/30 rounded-xl p-4 flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {!isProcessing && (
          <>
            {/* Upload Section */}
            <div
              className="glass-dark border-2 border-dashed border-yellow-500/30 rounded-2xl p-12 text-center cursor-pointer hover:border-yellow-400/50 transition-all duration-300 group"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="space-y-6">
                <div className="w-20 h-20 gradient-gold-bg rounded-2xl mx-auto flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Upload className="w-10 h-10 text-black" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-3">Upload Audio Sample</h3>
                  <p className="text-gray-400 text-lg">Drop your audio file here or click to browse</p>
                  <p className="text-gray-500 text-sm mt-2">Supports MP3, WAV, M4A • Minimum 10 seconds recommended</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                className="hidden"
              />
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent"></div>
              <span className="text-gray-400 font-medium px-4">OR</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent"></div>
            </div>

            {/* Recording Section */}
            <div className="text-center space-y-8">
              <div className="flex justify-center">
                <div
                  className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 relative ${
                    isRecording
                      ? "bg-red-500/20 border-4 border-red-500/50 scale-110"
                      : "gradient-gold-bg hover:scale-105"
                  }`}
                >
                  <Mic className={`w-16 h-16 ${isRecording ? "text-red-500" : "text-black"}`} />

                  {/* Recording Timer */}
                  {isRecording && (
                    <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
                      <div className="flex items-center space-x-2 glass-dark rounded-full px-4 py-2 border border-red-500/30">
                        <Clock className="w-4 h-4 text-red-400" />
                        <span className="text-red-300 font-mono text-lg font-bold">{recordingTime}s</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {!isRecording ? (
                  <Button
                    onClick={startRecording}
                    className="gradient-gold-bg text-black hover:opacity-90 px-12 py-6 text-xl font-bold rounded-2xl"
                    size="lg"
                  >
                    <Mic className="w-6 h-6 mr-3" />
                    Start Recording
                  </Button>
                ) : (
                  <Button
                    onClick={stopRecording}
                    className="bg-red-500 hover:bg-red-600 text-white px-12 py-6 text-xl font-bold rounded-2xl"
                    size="lg"
                  >
                    <Square className="w-6 h-6 mr-3" />
                    Stop Recording
                  </Button>
                )}
                <p className="text-gray-400 text-lg">
                  {isRecording
                    ? `Recording... ${recordingTime} seconds remaining`
                    : "Record 15-30 seconds for optimal results (20 second max)"}
                </p>
              </div>
            </div>

            {/* Audio Preview & Process */}
            {audioUrl && (
              <div className="glass-dark rounded-2xl p-8 border border-yellow-500/30">
                <div className="space-y-6">
                  <div className="flex items-center space-x-4">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        {audioFile ? `📁 ${audioFile.name}` : "🎤 Voice Recording"}
                      </h3>
                      <p className="text-gray-400">Ready for neural processing</p>
                    </div>
                  </div>

                  <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />

                  <div className="flex space-x-4">
                    <Button
                      onClick={togglePlayback}
                      variant="outline"
                      className="flex-1 border-yellow-500/30 text-white hover:bg-yellow-500/10 py-6 text-lg bg-transparent"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-5 h-5 mr-3" />
                          Pause Preview
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5 mr-3" />
                          Preview Audio
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={processVoiceClone}
                      className="flex-1 gradient-gold-bg text-black hover:opacity-90 py-6 text-lg font-bold"
                    >
                      <Sparkles className="w-5 h-5 mr-3" />
                      Clone Voice
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Processing */}
        {isProcessing && (
          <div className="text-center space-y-8 py-12">
            <div className="flex justify-center">
              <div className="w-32 h-32 gradient-gold-bg rounded-full flex items-center justify-center animate-pulse">
                <Loader2 className="w-16 h-16 animate-spin text-black" />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-white">{currentStep}</h3>
              <Progress value={progress} className="w-full h-3 bg-gray-800" />
              <p className="text-gray-400 text-lg">Neural networks are analyzing your voice patterns...</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
