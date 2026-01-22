import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { groq } from "@ai-sdk/groq"

export async function POST(request: NextRequest) {
  try {
    const { messages, personality, voiceId, audioEnabled, emotion } = await request.json()

    if (!messages || !personality) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

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

    const result = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      prompt: lastUserMessage.content,
      system: systemPrompt,
      maxTokens: 150,
    })

    let audioUrl = null

    // Generate audio with ElevenLabs if enabled and voiceId is available
    if (audioEnabled && voiceId && !voiceId.startsWith("mock-voice-")) {
      try {
        audioUrl = await generateElevenLabsAudio(result.text, voiceId)
      } catch (audioError) {
        console.error("Audio generation failed:", audioError)
      }
    }

    return NextResponse.json({
      message: result.text,
      audioUrl,
      voiceId: voiceId.startsWith("mock-voice-") ? null : voiceId,
    })
  } catch (error) {
    console.error("Chat error:", error)

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
    if (!process.env.ELEVENLABS_API_KEY) {
      return null
    }

    let elevenLabsApiKey: string
    const rawKey = process.env.ELEVENLABS_API_KEY

    if (rawKey.startsWith("sk_")) {
      elevenLabsApiKey = rawKey
    } else {
      try {
        elevenLabsApiKey = Buffer.from(rawKey, "base64").toString("utf-8")
      } catch {
        return null
      }
    }

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

    if (!response.ok) {
      return null
    }

    const audioBuffer = await response.arrayBuffer()
    const base64Audio = Buffer.from(audioBuffer).toString("base64")
    return `data:audio/mpeg;base64,${base64Audio}`
  } catch {
    return null
  }
}
