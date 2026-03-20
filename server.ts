import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// In-memory store for user preferences (mocking Directus)
const userPreferencesStore: Record<string, string[]> = {};

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, userId, history } = req.body;
    
    // Get user preferences
    const preferences = userPreferencesStore[userId] || [];
    
    const systemInstruction = `You are Sofenzo Assistant, an AI beauty assistant integrated into a Telegram Mini App.
Your main task is to help users schedule beauty procedures (like Darsonval, masks, peeling, etc.) and answer their questions.
The user currently uses the following products/procedures: ${preferences.join(", ") || "None recorded yet"}.
Keep this in mind when recommending new products or procedures.

You have tools to:
1. Schedule a course of procedures.
2. Save new user preferences (products they use).

When a user wants to schedule a course (e.g., "I want to do Darsonval for a month, twice a week"), use the scheduleProcedures tool to calculate the dates and ask for confirmation.
If they ask about a new product, check if it's compatible with what they already use.`;

    const scheduleProceduresDeclaration = {
      name: "scheduleProcedures",
      description: "Calculates and schedules a course of beauty procedures.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          procedureName: { type: Type.STRING, description: "Name of the procedure" },
          durationDays: { type: Type.NUMBER, description: "Duration of the course in days" },
          frequencyPerWeek: { type: Type.NUMBER, description: "How many times per week" },
          startDate: { type: Type.STRING, description: "Start date in YYYY-MM-DD format" }
        },
        required: ["procedureName", "durationDays", "frequencyPerWeek", "startDate"]
      }
    };

    const savePreferencesDeclaration = {
      name: "saveUserPreferences",
      description: "Saves the products or procedures the user currently uses to their profile.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          products: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "List of products or procedures to save" 
          }
        },
        required: ["products"]
      }
    };

    const chat = ai.chats.create({
      model: "gemini-3.1-pro-preview",
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: [scheduleProceduresDeclaration, savePreferencesDeclaration] }],
      }
    });

    // Replay history
    if (history && history.length > 0) {
      // In a real app, we'd properly format the history for the SDK.
      // For simplicity, we'll just send the latest message with context.
    }

    const response = await chat.sendMessage({ message });
    
    // Check for function calls
    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      if (call.name === "scheduleProcedures") {
        const args = call.args as any;
        // Generate dates based on frequency and duration
        const dates = [];
        const start = new Date(args.startDate);
        let current = new Date(start);
        const end = new Date(start.getTime() + args.durationDays * 24 * 60 * 60 * 1000);
        
        // Simple logic: distribute evenly
        const intervalDays = Math.floor(7 / args.frequencyPerWeek);
        
        while (current <= end) {
          dates.push(current.toISOString().split('T')[0]);
          current = new Date(current.getTime() + intervalDays * 24 * 60 * 60 * 1000);
        }
        
        res.json({
          text: `I've calculated the schedule for ${args.procedureName}. It will be ${dates.length} sessions starting from ${args.startDate}. Are these days correct? Should I add them to your calendar?`,
          functionCall: {
            name: "scheduleProcedures",
            args: { ...args, calculatedDates: dates }
          }
        });
        return;
      } else if (call.name === "saveUserPreferences") {
        const args = call.args as any;
        userPreferencesStore[userId] = [...new Set([...(userPreferencesStore[userId] || []), ...args.products])];
        
        // Send a follow-up to the model to get a natural response
        const followUp = await chat.sendMessage({ message: `System: Successfully saved preferences: ${args.products.join(", ")}. Please acknowledge this to the user.` });
        res.json({ text: followUp.text });
        return;
      }
    }

    res.json({ text: response.text });
  } catch (error) {
    console.error("Chat API Error:", error);
    res.status(500).json({ error: "Failed to process chat message" });
  }
});

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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
