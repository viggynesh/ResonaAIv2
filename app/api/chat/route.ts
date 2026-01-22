import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { createGroq } from "@ai-sdk/groq"

export async function POST(request: NextRequest) {
  try {
    const { messages, personality, voiceId, audioEnabled, emotion } = await request.json()

    if (!messages || !personality) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    console.log("💬 Chat request with voiceId:", voiceId)
    console.log("😊 Detected emotion:", emotion)

    // Check if Groq API key exists
    if (!process.env.GROQ_API_KEY) {
      console.error("GROQ_API_KEY environment variable is not set")
      return NextResponse.json({ error: "Groq API key not configured" }, { status: 500 })
    }

    const groq = createGroq({
      apiKey: process.env.GROQ_API_KEY,
    })

    // Get the last user message
    const lastUserMessage = messages[messages.length - 1]

    const conversationHistory = messages
      .map((msg: any) => `${msg.role === "user" ? "Human" : "Assistant"}: ${msg.content}`)
      .join("\n")

    const emotionContext = emotion ? getEmotionContext(emotion) : "The user's emotional state is neutral."

    const systemPrompt = `
You are a helpful AI assistant with a friendly and engaging personality.

Personality Profile: ${personality}

${emotionContext}

Full Conversation History:
${conversationHistory}

Instructions:
- Be conversational, helpful, and engaging
- Keep responses natural and concise (1-3 sentences)
- Match the personality traits described in the profile
- Remember all previous messages in this conversation
- Naturally acknowledge and respond to the user's emotions when appropriate
- Use phrases like "I can see that you're [emotion]", "Don't worry", "I understand you're feeling [emotion]"
- Adjust your tone and approach based on the user's detected emotion
- Respond directly to what the user said
- Be authentic and personable in your responses
- Don't mention anything about voices, cloning, or audio technology

Respond naturally and helpfully with the appropriate emotional tone, acknowledging their feelings when appropriate.
`

    console.log("🤖 Generating Groq response...")

    const result = await generateText({
      model: groq("llama3-70b-8192"),
      prompt: lastUserMessage.content,
      system: systemPrompt,
      maxTokens: 150,
    })

    console.log("💬 Groq response:", result.text)

    let audioUrl = null

    // Generate audio with ElevenLabs if enabled and voiceId is available
    if (audioEnabled && voiceId && !voiceId.startsWith("mock-voice-")) {
      try {
        console.log("🗣️ Generating audio response...")
        audioUrl = await generateElevenLabsAudio(result.text, voiceId)
        console.log("🎵 Audio generated:", audioUrl ? "Success" : "Failed")
      } catch (audioError) {
        console.error("❌ Audio generation failed:", audioError)
        // Continue without audio if generation fails
      }
    }

    return NextResponse.json({
      message: result.text,
      audioUrl,
      voiceId: voiceId.startsWith("mock-voice-") ? null : voiceId,
    })
  } catch (error) {
    console.error("❌ Chat error:", error)

    if (error instanceof Error && error.message.includes("401")) {
      return NextResponse.json({ error: "Invalid Groq API key" }, { status: 401 })
    }

    return NextResponse.json(
      {
        error: "Failed to generate response",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

function getEmotionContext(emotion: string): string {
  const emotionMap: Record<string, string> = {
    happy:
      "The user is feeling happy and content. Match their positive energy with an upbeat, cheerful tone. You can say things like 'I can see that you're happy!' or 'It's wonderful to see you in such good spirits!'",
    sad: "The user is feeling sad or down. Be extra compassionate and supportive. Acknowledge their feelings with phrases like 'I can see that you're feeling sad' or 'Don't be sad, I'm here for you' or 'It's okay to feel this way.'",
    angry:
      "The user is feeling upset or frustrated. Stay calm and be patient. Acknowledge their feelings with phrases like 'I can see that you're angry' or 'I understand you're frustrated' or 'Let's work through this together calmly.'",
    fearful:
      "The user is feeling anxious or worried. Be reassuring and calming. Say things like 'Don't be worried' or 'I can see you're concerned, but everything will be okay' or 'There's no need to be afraid.'",
    disgusted:
      "The user appears displeased or uncomfortable. Acknowledge their feelings with understanding, saying things like 'I can see that bothers you' or 'I understand your concern.'",
    surprised:
      "The user seems surprised or curious. Match their energy with phrases like 'I can see that surprised you!' or 'That's exciting, isn't it?'",
    neutral: "The user has a neutral expression. Maintain a balanced, friendly tone that's warm and supportive.",
  }

  return (
    emotionMap[emotion.toLowerCase()] ||
    "Adapt your tone naturally to the conversation flow, being warm and supportive. Acknowledge the user's emotions when appropriate."
  )
}

async function generateElevenLabsAudio(text: string, voiceId: string): Promise<string | null> {
  try {
    // Check if API key exists
    if (!process.env.ELEVENLABS_API_KEY) {
      console.warn("ElevenLabs API key not configured, skipping audio generation")
      return null
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
        return null
      }
    }

    console.log("🗣️ Calling ElevenLabs TTS with voice:", voiceId)

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": elevenLabsApiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.7,
          similarity_boost: 0.8,
          style: 0.5,
          use_speaker_boost: true,
        },
      }),
    })

    console.log("📡 ElevenLabs TTS response:", response.status)

    if (!response.ok) {
      console.warn(`ElevenLabs TTS error: ${response.status}`)
      const errorText = await response.text()
      console.error("ElevenLabs error details:", errorText)
      return null
    }

    const audioBuffer = await response.arrayBuffer()

    // Convert to base64 data URL for client-side playback
    const base64Audio = Buffer.from(audioBuffer).toString("base64")
    return `data:audio/mpeg;base64,${base64Audio}`
  } catch (error) {
    console.error("❌ ElevenLabs audio generation error:", error)
    return null
  }
}
