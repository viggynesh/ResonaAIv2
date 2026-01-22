import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { groq } from "@ai-sdk/groq"

export async function POST(request: NextRequest) {
  try {
    console.log("🧪 Testing Groq integration...")

    // Check if Groq API key exists
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "GROQ_API_KEY not found" }, { status: 400 })
    }

    const groqApiKey = process.env.GROQ_API_KEY

    // Test Groq API
    const result = await generateText({
      model: groq("llama3-70b-8192", {
        apiKey: groqApiKey,
      }),
      prompt: "Say hello and confirm you're working!",
      maxTokens: 50,
    })

    console.log("✅ Groq test successful:", result.text)

    // Test ElevenLabs API if available
    let elevenLabsTest = null
    if (process.env.ELEVENLABS_API_KEY) {
      try {
        const elevenLabsResponse = await fetch("https://api.elevenlabs.io/v1/voices", {
          headers: {
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
          },
        })

        if (elevenLabsResponse.ok) {
          const voices = await elevenLabsResponse.json()
          elevenLabsTest = {
            status: "success",
            voiceCount: voices.voices?.length || 0,
          }
        } else {
          elevenLabsTest = {
            status: "error",
            message: `HTTP ${elevenLabsResponse.status}`,
          }
        }
      } catch (error) {
        elevenLabsTest = {
          status: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        }
      }
    }

    return NextResponse.json({
      groq: {
        status: "success",
        response: result.text,
        model: "llama3-70b-8192",
      },
      elevenlabs: elevenLabsTest,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Integration test failed:", error)

    return NextResponse.json(
      {
        groq: {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
