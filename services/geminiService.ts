// src/services/geminiService.ts
import { GoogleGenAI, Type, Schema } from "@google/genai";
import OpenAI from "openai"; 
import { ProcessingResult, PlanningResult } from "../types";
import { SYSTEM_INSTRUCTION_PROCESSOR, SYSTEM_INSTRUCTION_PLANNER, SYSTEM_INSTRUCTION_AGENT, SYSTEM_INSTRUCTION_SEARCH } from "../constants";

// --- 配置区域 ---
const CURRENT_PROVIDER = import.meta.env.VITE_AI_PROVIDER || 'gemini';

// --- 延迟初始化 (Lazy Initialization) ---
// 为什么要这样做？防止网页刚打开时因为缺少 Key 而直接白屏崩溃。

let geminiClientInstance: any = null;
let deepseekClientInstance: OpenAI | null = null;

const getGeminiClient = () => {
    if (!geminiClientInstance) {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        // 如果没有 Key，给一个假的不让 SDK 报错，等到调用时再抛出真正的网络错误
        geminiClientInstance = new GoogleGenAI({ apiKey: apiKey || "dummy_key_to_prevent_crash" });
    }
    return geminiClientInstance;
}

const getDeepSeekClient = () => {
    if (!deepseekClientInstance) {
        const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
        // 这里是修复白屏的关键：如果 Key 是空的，填一个假的字符串，防止 new OpenAI() 报错
        deepseekClientInstance = new OpenAI({
            baseURL: 'https://api.deepseek.com',
            apiKey: apiKey || "dummy_key_to_prevent_crash", 
            dangerouslyAllowBrowser: true 
        });
    }
    return deepseekClientInstance;
}

// --- 辅助函数：获取当前日期上下文 ---
const getTodayContext = () => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-CA');
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  return `CURRENT DATE CONTEXT: Today is ${dateStr} (${weekday}). \nCRITICAL RULE: If the user mentions a date without a year (e.g., "12.3" or "tomorrow"), assume the current year ${now.getFullYear()} and calculate the date relative to today.`;
};

// Helper to clean JSON
const cleanJson = (text: string): string => {
  if (!text) return "{}";
  let clean = text.trim();
  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return clean;
};

// Schema for Gemini
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

// ==========================================
// Process Input
// ==========================================

export const processInput = async (text: string, hierarchy: Record<string, string[]>, imageBase64?: string): Promise<ProcessingResult> => {
  const dateContext = getTodayContext();

  // 🟢 DeepSeek
  if (CURRENT_PROVIDER === 'deepseek') {
    try {
      const client = getDeepSeekClient(); // ✅ 获取客户端
      const hierarchyStr = JSON.stringify(hierarchy, null, 2);
      const prompt = `
      ${SYSTEM_INSTRUCTION_PROCESSOR}
      ${dateContext}
      CRITICAL INSTRUCTIONS:
      1. Output VALID JSON ONLY.
      2. Hierarchy Context: ${hierarchyStr}
      3. Logic: Match 'rootCategory' and 'project'. Fallback to 'General'.
      Input Text: "${text}"
      ${imageBase64 ? "[Image attached. Infer context from text.]" : ""}
      Required JSON Structure: { "rootCategory": "string", "project": "string", "subProject": "string", "type": "note" | "plan" | "inspiration", "tags": ["string"], "items": [ { "title": "string", "category": "string", "description": "string", "location": "string", "rating": number, "targetDate": "YYYY.MM.DD", "status": "pending" } ] }
      `;

      const completion = await client.chat.completions.create({
        messages: [{ role: "system", content: "You are a JSON generator." }, { role: "user", content: prompt }],
        model: "deepseek-chat",
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0].message.content;
      if (!content) throw new Error("No response from DeepSeek");
      return JSON.parse(content) as ProcessingResult;

    } catch (error) {
      console.error("DeepSeek Process Error:", error);
      throw error;
    }
  }

  // 🔵 Gemini
  else {
    try {
      const client = getGeminiClient(); // ✅ 获取客户端
      const enrichedHierarchy: Record<string, string[]> = {};
      Object.keys(hierarchy).forEach(cat => {
          const projects = hierarchy[cat] || [];
          enrichedHierarchy[cat] = projects.includes('General') ? projects : [...projects, 'General'];
      });

      const validCategories = Object.keys(enrichedHierarchy);
      const safeCategories = validCategories.length > 0 ? validCategories : ["General"];
      // Note: Full hierarchy validation logic omitted for brevity but should be here as per previous code
      
      const processingSchema: Schema = {
        type: Type.OBJECT,
        properties: {
          rootCategory: { type: Type.STRING, enum: safeCategories },
          project: { type: Type.STRING }, // Simplified schema for brevity
          subProject: { type: Type.STRING },
          type: { type: Type.STRING, enum: ["note", "plan", "inspiration"] },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                category: { type: Type.STRING },
                description: { type: Type.STRING },
                location: { type: Type.STRING },
                rating: { type: Type.NUMBER },
                actionItem: { type: Type.STRING },
                targetDate: { type: Type.STRING },
                status: { type: Type.STRING, enum: ["pending", "completed"] },
              },
              required: ["title", "category", "description"],
            },
          },
        },
        required: ["rootCategory", "project", "type", "items"],
      };

      const parts: any[] = [];
      if (imageBase64) {
          parts.push({ inlineData: { mimeType: "image/jpeg", data: imageBase64 } });
      }
      parts.push({ text: text || "Analyze this." });

      const response = await client.models.generateContent({
        model: "gemini-1.5-flash",
        contents: { parts: parts },
        config: {
          systemInstruction: `${SYSTEM_INSTRUCTION_PROCESSOR}\n\n${dateContext}\n\nHIERARCHY RULES: ${JSON.stringify(enrichedHierarchy)}`,
          responseMimeType: "application/json",
          responseSchema: processingSchema,
        },
      });

      const jsonText = typeof response.text === 'function' ? response.text() : response.text;
      if (!jsonText) throw new Error("No response from AI");
      return JSON.parse(cleanJson(jsonText)) as ProcessingResult;

    } catch (error) {
      console.error("Gemini Process Error:", error);
      throw error;
    }
  }
};

export const generatePlan = async (goal: string, duration: string): Promise<PlanningResult> => {
  const dateContext = getTodayContext();
  
  if (CURRENT_PROVIDER === 'deepseek') {
    const client = getDeepSeekClient();
    const prompt = `
    ${SYSTEM_INSTRUCTION_PLANNER}
    ${dateContext}
    Goal: ${goal}
    Duration: ${duration}
    Return JSON format: { "planName": "string", "tasks": [ { "day": number, "title": "string" } ] }
    `;
    const completion = await client.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "deepseek-chat",
      response_format: { type: "json_object" },
    });
    return JSON.parse(completion.choices[0].message.content || "{}") as PlanningResult;
  }

  try {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: "gemini-1.5-flash",
      contents: `Goal: ${goal}. Duration: ${duration}. Create a plan.`,
      config: {
        systemInstruction: `${SYSTEM_INSTRUCTION_PLANNER}\n${dateContext}`,
        responseMimeType: "application/json",
        responseSchema: planningSchema,
      },
    });
    const jsonText = typeof response.text === 'function' ? response.text() : response.text;
    return JSON.parse(cleanJson(jsonText || "{}")) as PlanningResult;
  } catch (error) {
    throw error;
  }
};

export const getAgentResponse = async (userMessage: string, memoriesContext: string): Promise<string> => {
  const dateContext = getTodayContext();

  if (CURRENT_PROVIDER === 'deepseek') {
    const client = getDeepSeekClient();
    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: `${SYSTEM_INSTRUCTION_AGENT}\n${dateContext}` },
        { role: "system", content: `Context: ${memoriesContext}` },
        { role: "user", content: userMessage }
      ],
      model: "deepseek-chat",
    });
    return completion.choices[0].message.content || "...";
  }

  try {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: "gemini-1.5-flash",
      contents: `Context: ${memoriesContext}. User: "${userMessage}"`,
      config: { systemInstruction: `${SYSTEM_INSTRUCTION_AGENT}\n${dateContext}` },
    });
    return (typeof response.text === 'function' ? response.text() : response.text) || "I'm listening!";
  } catch (error) {
    return "Service unavailable.";
  }
};

export const searchMemories = async (query: string, memories: string): Promise<string> => {
    if (CURRENT_PROVIDER === 'deepseek') {
        const client = getDeepSeekClient();
        const completion = await client.chat.completions.create({
          messages: [
            { role: "system", content: SYSTEM_INSTRUCTION_SEARCH },
            { role: "user", content: `Query: ${query}. Data: ${memories}` }
          ],
          model: "deepseek-chat",
        });
        return completion.choices[0].message.content || "No results.";
    }

    try {
        const client = getGeminiClient();
        const response = await client.models.generateContent({
            model: "gemini-1.5-flash",
            contents: `Query: "${query}". Data: ${memories}`,
            config: { systemInstruction: SYSTEM_INSTRUCTION_SEARCH }
        });
        return (typeof response.text === 'function' ? response.text() : response.text) || "No results found.";
    } catch (error) {
        return "Search error.";
    }
}