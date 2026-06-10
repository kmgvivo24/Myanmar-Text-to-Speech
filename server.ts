import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize GoogleGenAI lazily as recommended to avoid crashes if the key is missing at load time
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not defined in the environment. Please configure your API key in the Settings Secrets tab.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

/**
 * Utility to convert 16-bit Mono PCM buffer to standard RIFF WAV format
 * @param pcmBuffer Raw 16-bit PCM buffer
 * @param sampleRate Sampling rate (default 24000Hz for Gemini TTS)
 */
function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000): Buffer {
  const buffer = Buffer.alloc(44 + pcmBuffer.length);
  
  // "RIFF" chunk descriptor
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + pcmBuffer.length, 4); // File size - 8 bytes
  buffer.write("WAVE", 8);
  
  // "fmt " sub-chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // Sub-chunk 1 size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // Audio format: 1 (PCM)
  buffer.writeUInt16LE(1, 22); // Channels: 1 (Mono)
  buffer.writeUInt32LE(sampleRate, 24); // Sample rate
  buffer.writeUInt32LE(sampleRate * 2, 28); // Byte rate (SampleRate * Channels * BitsPerSample/8)
  buffer.writeUInt16LE(2, 32); // Block align (Channels * BitsPerSample/8)
  buffer.writeUInt16LE(16, 34); // Bits per sample (16-bit)
  
  // "data" sub-chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(pcmBuffer.length, 40); // Data size
  
  // Attach raw PCM data
  pcmBuffer.copy(buffer, 44);
  
  return buffer;
}

// REST API endpoint: Translate or polish text representation to Myanmar
app.post("/api/translate-polish", async (req, res) => {
  try {
    const { text, sourceLang } = req.body;
    if (!text || typeof text !== "string") {
       res.status(400).json({ error: "Text prompt is required" });
       return;
    }

    const ai = getAiClient();
    const systemPrompt = `You are an expert translator and linguist specialized in Myanmar (Burmese).
Translate the input text to perfect, high-quality, natural-sounding Burmese (both formal/written or clean spoken depending on context, preferring elegant and standard forms). 
If the text is already in Burmese, polish it to make it read perfectly, correcting spelling/grammar, and make sure it sounds natural when spoken aloud.
Return only accurate JSON representation following the schema specification. Do NOT include any unrequested text description outside of the structured keys.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: text,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            translatedText: {
              type: Type.STRING,
              description: "The translated or polished Myanmar (Burmese) text, in Unicode script. Do NOT include any English or other explanations here, only the Burmese output."
            },
            explanation: {
              type: Type.STRING,
              description: "A short, friendly, 1-2 sentence explanation in English of the translated phrase and its register (e.g. conversational, formal)."
            }
          },
          required: ["translatedText", "explanation"]
        }
      }
    });

    let bodyText = response.text || "{}";
    bodyText = bodyText.trim();

    // Self-healing cleanups for formatting backticks
    if (bodyText.startsWith("```json")) {
      bodyText = bodyText.substring(7);
    } else if (bodyText.startsWith("```")) {
      bodyText = bodyText.substring(3);
    }
    if (bodyText.endsWith("```")) {
      bodyText = bodyText.substring(0, bodyText.length - 3);
    }
    bodyText = bodyText.trim();

    // Boundary extractor for raw json strings
    const firstBrace = bodyText.indexOf("{");
    const lastBrace = bodyText.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      bodyText = bodyText.substring(firstBrace, lastBrace + 1);
    }

    let data;
    try {
      data = JSON.parse(bodyText);
    } catch (parseErr) {
      console.warn("JSON dynamic parsing fallback activated. Original text was:", bodyText);
      // Clean fallback format structure in case parsed chunk fails
      data = {
        translatedText: response.text || text,
        explanation: "Processed translation complete."
      };
    }

    res.json(data);
  } catch (error: any) {
    console.error("Translation error:", error);
    res.status(500).json({ error: error.message || "Failed to translate or polish text." });
  }
});

// REST API endpoint: Generate Speech (Myanmar TTS)
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice, tone, speed } = req.body;
    
    if (!text || typeof text !== "string" || text.trim() === "") {
       res.status(400).json({ error: "Please enter Myanmar text to speak." });
       return;
    }

    const ai = getAiClient();
    
    // Construct rich reading instructions to Gemini flash tts model to alter speed and tone dynamics
    let speakingInstruction = "";
    if (tone && tone !== "neutral") {
      speakingInstruction += `Speak in a ${tone} tone. `;
    }
    if (speed && speed !== "normal") {
      speakingInstruction += `Speak at a ${speed} speed (very clearly). `;
    }
    
    const finalPrompt = speakingInstruction 
      ? `Read the following Burmese text with these speaking guidelines: [${speakingInstruction.trim()}]. Text to read: ${text}`
      : `Read the following Burmese text: ${text}`;

    // Supported voices: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
    const chosenVoice = voice || "Kore";

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: finalPrompt }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: chosenVoice },
          },
        },
      },
    });

    // Check if we received audio capability response
    const candidate = response.candidates?.[0];
    const audioPart = candidate?.content?.parts?.[0];
    const base64Pcm = audioPart?.inlineData?.data;

    if (!base64Pcm) {
      throw new Error("No speech audio stream was generated by the AI model. Ensure input is readable text.");
    }

    const pcmBuffer = Buffer.from(base64Pcm, "base64");
    const wavBuffer = pcmToWav(pcmBuffer, 24000); // Gemini TTS sample rate is 24000Hz
    const wavBase64 = wavBuffer.toString("base64");
    const audioUrl = `data:audio/wav;base64,${wavBase64}`;

    res.json({
      success: true,
      audioUrl: audioUrl,
      voice: chosenVoice,
      text: text,
    });
  } catch (error: any) {
    console.error("TTS generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate speech." });
  }
});

// Configure Vite middleware for development or fallback static serving in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server loaded and listening on port ${PORT}`);
  });
}

startServer();
