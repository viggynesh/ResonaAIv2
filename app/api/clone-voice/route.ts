import { type NextRequest, NextResponse } from "next/server"

// Default ElevenLabs voice IDs to use as fallback
const DEFAULT_VOICE_IDS = [
  "EXAVITQu4vr4xnSDxMaL", // Bella - warm and friendly
  "21m00Tcm4TlvDq8ikWAM", // Rachel - calm and clear
  "AZnzlk1XvdvUeBnXmlld", // Domi - confident and strong
  "pNInz6obpgDQGcFmaJgB", // Adam - deep and authoritative
]

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }

    // Check if ElevenLabs API key exists
    if (!process.env.ELEVENLABS_API_KEY) {
      console.error("ELEVENLABS_API_KEY environment variable is not set")
      const fallbackVoiceId = DEFAULT_VOICE_IDS[0]
      console.log("⚠️ Using fallback voice due to missing API key:", fallbackVoiceId)
      return NextResponse.json({
        success: true,
        voiceId: fallbackVoiceId,
        voiceName: "Default Voice (API Unavailable)",
        isFallback: true,
      })
    }

    // Handle API key - ElevenLabs keys start with sk_
    let elevenLabsApiKey: string
    const rawKey = process.env.ELEVENLABS_API_KEY

    if (rawKey.startsWith("sk_")) {
      elevenLabsApiKey = rawKey
    } else {
      try {
        elevenLabsApiKey = Buffer.from(rawKey, "base64").toString("utf-8")
      } catch (decodeError) {
        console.error("Failed to decode ElevenLabs API key:", decodeError)
        const fallbackVoiceId = DEFAULT_VOICE_IDS[0]
        console.log("⚠️ Using fallback voice due to key decode error:", fallbackVoiceId)
        return NextResponse.json({
          success: true,
          voiceId: fallbackVoiceId,
          voiceName: "Default Voice (API Unavailable)",
          isFallback: true,
        })
      }
    }

    console.log("🗣️ Starting voice cloning process...")

    try {
      // Step 1: Clean up existing temporary voices
      try {
        console.log("🧹 Cleaning up existing voices...")
        const voicesResponse = await fetch("https://api.elevenlabs.io/v1/voices", {
          headers: {
            "xi-api-key": elevenLabsApiKey,
          },
        })

        if (voicesResponse.ok) {
          const voicesData = await voicesResponse.json()
          const tempVoices = voicesData.voices.filter(
            (voice: any) =>
              voice.name.startsWith("UniqueVoice_") ||
              voice.name.startsWith("TempVoice_") ||
              voice.category === "cloned",
          )

          // Delete existing temp voices in parallel
          const deletePromises = tempVoices.map(async (voice: any) => {
            try {
              const deleteResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${voice.voice_id}`, {
                method: "DELETE",
                headers: {
                  "xi-api-key": elevenLabsApiKey,
                },
              })
              console.log(`🗑️ Deleted voice ${voice.name}: ${deleteResponse.status}`)
            } catch (error) {
              console.error(`Failed to delete voice ${voice.name}:`, error)
            }
          })

          await Promise.all(deletePromises)

          // Wait a bit for ElevenLabs to process deletions
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      } catch (cleanupError) {
        console.warn("Voice cleanup failed, continuing with cloning:", cleanupError)
      }

      // Step 2: Create unique voice name with session ID
      const timestamp = Date.now()
      const sessionId = Math.random().toString(36).substring(2, 8)
      const voiceName = `UniqueVoice_${timestamp}_${sessionId}`

      console.log("🎤 Creating voice clone with name:", voiceName)

      // Step 3: Create the voice clone
      const cloneFormData = new FormData()
      cloneFormData.append("name", voiceName)
      cloneFormData.append("files", audioFile)
      cloneFormData.append("description", "Temporary voice clone for chat session")

      const cloneResponse = await fetch("https://api.elevenlabs.io/v1/voices/add", {
        method: "POST",
        headers: {
          "xi-api-key": elevenLabsApiKey,
        },
        body: cloneFormData,
      })

      console.log("📡 ElevenLabs clone response:", cloneResponse.status)

      if (!cloneResponse.ok) {
        const errorText = await cloneResponse.text()
        console.error("ElevenLabs clone error:", errorText)
        throw new Error(`Voice cloning failed: ${cloneResponse.status}`)
      }

      const cloneResult = await cloneResponse.json()
      console.log("✅ Voice cloned successfully:", cloneResult.voice_id)

      return NextResponse.json({
        success: true,
        voiceId: cloneResult.voice_id,
        voiceName: voiceName,
        isFallback: false,
      })
    } catch (cloningError) {
      console.error("❌ Voice cloning failed, using fallback voice:", cloningError)
      const fallbackVoiceId = DEFAULT_VOICE_IDS[Math.floor(Math.random() * DEFAULT_VOICE_IDS.length)]
      console.log("⚠️ Using fallback voice:", fallbackVoiceId)

      return NextResponse.json({
        success: true,
        voiceId: fallbackVoiceId,
        voiceName: "Default Voice (Cloning Unavailable)",
        isFallback: true,
        message: "Voice cloning is temporarily unavailable. Using a default voice instead.",
      })
    }
  } catch (error) {
    console.error("❌ Unexpected error:", error)
    const fallbackVoiceId = DEFAULT_VOICE_IDS[0]
    return NextResponse.json({
      success: true,
      voiceId: fallbackVoiceId,
      voiceName: "Default Voice",
      isFallback: true,
      message: "An error occurred. Using a default voice.",
    })
  }
}
