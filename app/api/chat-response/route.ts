import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { groq } from "@ai-sdk/groq"

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json()

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    console.log("💬 Chat response request:", message)

    // Check if Groq API key exists
    if (!process.env.GROQ_API_KEY) {
      console.error("GROQ_API_KEY environment variable is not set")
      return NextResponse.json({ error: "Groq API key not configured" }, { status: 500 })
    }

    // Handle Groq API key
    let groqApiKey: string
    const rawKey = process.env.GROQ_API_KEY

    if (rawKey.startsWith("gsk_")) {
      groqApiKey = rawKey
    } else {
      try {
        groqApiKey = Buffer.from(rawKey, "base64").toString("utf-8")
      } catch (decodeError) {
        console.error("Failed to decode Groq API key:", decodeError)
        return NextResponse.json({ error: "API key decode error" }, { status: 500 })
      }
    }

    const systemPrompt = `
    You are a helpful AI assistant that provides natural, conversational responses.
    Keep your responses concise and engaging (1-3 sentences).
    Be friendly and match the user's tone.
    `

    console.log("🤖 Generating Groq response...")

    const result = await generateText({
      model: groq("llama-3.1-8b-instant", {
        apiKey: groqApiKey,
      }),
      prompt: message,
      system: systemPrompt,
      maxTokens: 150,
    })

    console.log("💬 Groq response:", result.text)

    return NextResponse.json({
      response: result.text,
    })
  } catch (error) {
    console.error("❌ Chat response error:", error)

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
