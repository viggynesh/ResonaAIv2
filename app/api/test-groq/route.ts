import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    console.log("🧪 Testing Groq API connection...")

    // Check if Groq API key exists
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({
        success: false,
        error: "GROQ_API_KEY environment variable is not set",
      })
    }

    // Handle Groq API key - try direct usage first, then base64 decode
    let groqApiKey: string
    const rawKey = process.env.GROQ_API_KEY

    console.log("🔑 Raw key from env:", rawKey.substring(0, 20) + "...")

    // First try using the key directly (in case it's not base64 encoded)
    if (rawKey.startsWith("gsk_")) {
      groqApiKey = rawKey
      console.log("✅ Using key directly (not base64 encoded)")
    } else {
      // Try base64 decoding
      try {
        groqApiKey = Buffer.from(rawKey, "base64").toString("utf-8")
        console.log("✅ Groq API key decoded from base64")
      } catch (decodeError) {
        console.error("❌ Base64 decode failed, trying raw key:", decodeError)
        groqApiKey = rawKey // Fallback to raw key
      }
    }

    console.log("🔑 Final key being used:", groqApiKey.substring(0, 20) + "...")

    // Test API call
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-70b-versatile",
        messages: [
          {
            role: "user",
            content: "Say hello! This is a test.",
          },
        ],
        max_tokens: 50,
      }),
    })

    console.log("📡 Groq test response status:", groqResponse.status)
    console.log("📡 Groq response headers:", Object.fromEntries(groqResponse.headers.entries()))

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      console.error("❌ Groq API test error:", errorText)
      return NextResponse.json({
        success: false,
        error: `Groq API error: ${groqResponse.status}`,
        details: errorText,
        keyUsed: groqApiKey.substring(0, 20) + "...",
      })
    }

    const groqData = await groqResponse.json()
    console.log("✅ Groq test successful:", groqData)
    const testResponse = groqData.choices[0]?.message?.content

    return NextResponse.json({
      success: true,
      message: "Groq API is working!",
      testResponse: testResponse,
      model: "llama-3.1-70b-versatile",
      keyUsed: groqApiKey.substring(0, 20) + "...",
    })
  } catch (error) {
    console.error("❌ Groq test error:", error)
    return NextResponse.json({
      success: false,
      error: "Test failed",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
