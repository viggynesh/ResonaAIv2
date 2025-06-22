import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const keys = {
      groq: !!process.env.GROQ_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      elevenlabs: !!process.env.ELEVENLABS_API_KEY,
      vapi_private: !!process.env.VAPI_PRIVATE_KEY,
      vapi_public: !!process.env.VAPI_PUBLIC_KEY,
    }

    // Test decoding/validation of each key
    const validatedKeys: Record<string, boolean> = {}

    // Groq API Key (starts with gsk_)
    if (keys.groq) {
      try {
        const groqKey = process.env.GROQ_API_KEY!
        validatedKeys.groq = groqKey.startsWith("gsk_") && groqKey.length > 20
      } catch (error) {
        validatedKeys.groq = false
      }
    } else {
      validatedKeys.groq = false
    }

    // Anthropic API Key (starts with sk-ant-)
    if (keys.anthropic) {
      try {
        const anthropicKey = process.env.ANTHROPIC_API_KEY!
        validatedKeys.anthropic = anthropicKey.startsWith("sk-ant-") && anthropicKey.length > 20
      } catch (error) {
        validatedKeys.anthropic = false
      }
    } else {
      validatedKeys.anthropic = false
    }

    // ElevenLabs API Key (starts with sk_)
    if (keys.elevenlabs) {
      try {
        const elevenLabsKey = process.env.ELEVENLABS_API_KEY!
        validatedKeys.elevenlabs = elevenLabsKey.startsWith("sk_") && elevenLabsKey.length > 20
      } catch (error) {
        validatedKeys.elevenlabs = false
      }
    } else {
      validatedKeys.elevenlabs = false
    }

    // VAPI Keys (UUID format)
    if (keys.vapi_private) {
      try {
        const vapiPrivateKey = process.env.VAPI_PRIVATE_KEY!
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        validatedKeys.vapi_private = uuidRegex.test(vapiPrivateKey)
      } catch (error) {
        validatedKeys.vapi_private = false
      }
    } else {
      validatedKeys.vapi_private = false
    }

    if (keys.vapi_public) {
      try {
        const vapiPublicKey = process.env.VAPI_PUBLIC_KEY!
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        validatedKeys.vapi_public = uuidRegex.test(vapiPublicKey)
      } catch (error) {
        validatedKeys.vapi_public = false
      }
    } else {
      validatedKeys.vapi_public = false
    }

    return NextResponse.json({
      keysPresent: keys,
      keysValidated: validatedKeys,
      allValid: Object.values(validatedKeys).every(Boolean),
      summary: {
        total: Object.keys(keys).length,
        present: Object.values(keys).filter(Boolean).length,
        valid: Object.values(validatedKeys).filter(Boolean).length,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
