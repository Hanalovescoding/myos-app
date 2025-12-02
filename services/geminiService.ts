import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ProcessingResult, PlanningResult } from "../types";
import { SYSTEM_INSTRUCTION_PROCESSOR, SYSTEM_INSTRUCTION_PLANNER, SYSTEM_INSTRUCTION_AGENT, SYSTEM_INSTRUCTION_SEARCH } from "../constants";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// Helper to clean Markdown code blocks from JSON response
const cleanJson = (text: string): string => {
  if (!text) return "{}";
  let clean = text.trim();
  // Remove markdown wrapping
  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return clean;
};

// Schema for Generating a Plan
const planningSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    planName: { type: Type.STRING },
    tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.INTEGER },
          title: { type: Type.STRING },
        },
        required: ["day", "title"],
      },
    },
  },
  required: ["planName", "tasks"],
};

export const processInput = async (text: string, hierarchy: Record<string, string[]>, imageBase64?: string): Promise<ProcessingResult> => {
  try {
    // 1. Ensure "General" is available for EVERY category in the hierarchy
    const enrichedHierarchy: Record<string, string[]> = {};
    Object.keys(hierarchy).forEach(cat => {
        const projects = hierarchy[cat] || [];
        // Create new array to avoid mutation issues
        enrichedHierarchy[cat] = projects.includes('General') ? projects : [...projects, 'General'];
    });

    // Extract valid Categories (Keys) and all valid Projects (Values flattened)
    const validCategories = Object.keys(enrichedHierarchy);
    const allValidProjects = Array.from(new Set(Object.values(enrichedHierarchy).flat()));

    // Safety fallback
    const safeCategories = validCategories.length > 0 ? validCategories : ["General"];
    const safeProjects = allValidProjects.length > 0 ? allValidProjects : ["General"];

    // Dynamic Schema based on user hierarchy
    const processingSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        rootCategory: { type: Type.STRING, enum: safeCategories },
        project: { 
            type: Type.STRING, 
            enum: safeProjects,
            description: "Must be one of the existing projects. Use 'General' if it doesn't fit any specific project." 
        },
        subProject: { type: Type.STRING, description: "A sub-category or specific topic (e.g. Seoul, Busan)" },
        type: { type: Type.STRING, enum: ["note", "plan", "inspiration"] },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              category: { type: Type.STRING, description: "Specific category like Food, Shopping, Concept" },
              description: { type: Type.STRING },
              location: { type: Type.STRING, description: "Physical address or place name if applicable" },
              rating: { type: Type.NUMBER, description: "1-5 rating if applicable" },
              actionItem: { type: Type.STRING, description: "A specific todo or tip" },
              targetDate: { type: Type.STRING, description: "Specific date for this item in YYYY.MM.DD format" },
              status: { type: Type.STRING, enum: ["pending", "completed"] },
            },
            required: ["title", "category", "description"],
          },
        },
      },
      required: ["rootCategory", "project", "type", "items"],
    };

    const parts: any[] = [];
    
    // Add Image Part if exists
    if (imageBase64) {
        parts.push({
            inlineData: {
                mimeType: "image/jpeg", 
                data: imageBase64
            }
        });
    }

    // Add Text Part
    parts.push({
        text: text || "Analyze this image and extract structured information."
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: parts },
      config: {
        systemInstruction: `${SYSTEM_INSTRUCTION_PROCESSOR}\n\nCRITICAL HIERARCHY RULES:
        1. **STRICT COMPLIANCE**: You MUST NOT create new Categories or Projects. Use ONLY what is provided.
        2. **VALID HIERARCHY MAP**:
           ${JSON.stringify(enrichedHierarchy, null, 2)}
        3. **SELECTION LOGIC**:
           - Step 1: Identify the most relevant 'rootCategory' from the MAP KEYS.
           - Step 2: Select a 'project' ONLY from the list associated with that key.
           - **FALLBACK**: If the input does not belong to a specific project, YOU MUST SELECT 'General'.
        `,
        responseMimeType: "application/json",
        responseSchema: processingSchema,
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");
    
    // Clean JSON before parsing to handle potential markdown wrappers
    const cleanedJson = cleanJson(jsonText);
    
    try {
        return JSON.parse(cleanedJson) as ProcessingResult;
    } catch (parseError) {
        console.error("JSON Parse Error. Raw Text:", jsonText);
        throw new Error("Failed to parse AI response.");
    }

  } catch (error) {
    console.error("Error processing input:", error);
    throw error;
  }
};

export const generatePlan = async (goal: string, duration: string): Promise<PlanningResult> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Goal: ${goal}. Duration: ${duration}. Create a plan.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_PLANNER,
        responseMimeType: "application/json",
        responseSchema: planningSchema,
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");

    const cleanedJson = cleanJson(jsonText);
    return JSON.parse(cleanedJson) as PlanningResult;
  } catch (error) {
    console.error("Error generating plan:", error);
    throw error;
  }
};

export const getAgentResponse = async (userMessage: string, memoriesContext: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
        Context (User's Memories):
        ${memoriesContext}
        
        User Message: "${userMessage}"
      `,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_AGENT,
      },
    });
    return response.text || "I'm listening!";
  } catch (error) {
    console.error("Error getting agent response:", error);
    return "MyOS is temporarily unavailable. Please try again.";
  }
};

export const searchMemories = async (query: string, memories: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `User Query: "${query}". 
            
            Here is the user's database of memories (JSON format):
            ${memories}
            
            Answer the query based ONLY on the memories provided. If not found, say "I couldn't find that in your memories."`,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION_SEARCH
            }
        });
        return response.text || "No results found.";
    } catch (error) {
        return "Search error.";
    }
}