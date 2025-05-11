import express, { Request, Response } from "express";

import { OpenAI } from "openai";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const MAX_TOKEN = 400;
const MAX_COMPLETION_TOKENS = MAX_TOKEN - 50;
const STOP_INDICATORS = ["<end>"];

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.error("Missing OPENAI_API_KEY in .env");
  process.exit(1);
}

const client = new OpenAI({
  apiKey: OPENAI_KEY,
});

app.post("/completions", async (req: Request, res: Response) => {
  const { instruction } = req.body;
  if (typeof instruction !== "string" || instruction.trim().length === 0) {
    res.status(400).json({ error: "Missing or empty `instruction` field." });
    return;
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Write clear, efficient code to accomplish the following task as a senior software developer. Use modern best practices and concise syntax appropriate for the language. Avoid unnecessary complexity, and ensure readability. Only return valid code without extra explanation. If no specific language is specified, use Python as its language, when in doubt, do not hallucinate and assume a requirement, don't implement if it is not in the instruction. Return only the code as text, no additional markdown styling.`,
        },
        {
          role: "user",
          content: instruction,
        },
      ],
      max_completion_tokens: MAX_TOKEN,
    });

    const code = response.choices?.[0]?.message?.content ?? "";
    console.log("Received prompt+response:", {
      prompt: instruction,
      response: code,
    });

    res.json({ completion: code });
  } catch (err: any) {
    console.error("OpenAI API error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch completion." });
  }
});

app.post("/explain", async (req: Request, res: Response) => {
  const { code } = req.body;
  if (typeof code !== "string" || code.trim().length === 0) {
    res.status(400).json({ error: "Missing or empty `code` field." });
    return;
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert programmer. Explain the following code in plain English, as if to a beginner. Keep the explanation short and ensure it ends naturally. If content is not related to code/coding, you just say "I don't understand this" You must not exceed ${MAX_COMPLETION_TOKENS} words. If needed, summarize key points near the end to avoid being cut off.`,
        },
        {
          role: "user",
          content: code,
        },
      ],
      max_tokens: MAX_TOKEN,
      stop: STOP_INDICATORS,
    });

    const explanation = response.choices?.[0]?.message?.content ?? "";
    console.log("Received code explanation:", {
      code,
      explanation,
    });

    res.json({ explanation });
  } catch (err: any) {
    console.error("OpenAI API error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to explain code." });
  }
});
app.post("/comment", async (req: Request, res: Response) => {
  const { code } = req.body;
  if (typeof code !== "string" || code.trim().length === 0) {
    res.status(400).json({ error: "Missing or empty `code` field." });
    return;
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert software engineer. Read the following code and return the same code unchanged, but with helpful and concise comments added. Focus only on lines or blocks that are essential for understanding the logic. Do not explain trivial things (like variable declarations) unless they are part of the logic. Add comments above or beside the relevant lines in the format of the language (e.g. // for Java/Kotlin/JS, # for Python). Do not rewrite or reformat the code. Only add comments. If user did not provide any code, or not code related, you say (and should only return, in all caps) "NOT CODE"`,
        },
        {
          role: "user",
          content: code,
        },
      ],
      max_completion_tokens: MAX_TOKEN,
    });

    const commented_code = response.choices?.[0]?.message?.content ?? "";
    console.log("Received code comment:", {
      code,
      commented_code,
    });

    res.json({ commented_code });
  } catch (err: any) {
    console.error("OpenAI API error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to comment code." });
  }
});
app.post("/obfus", async (req: Request, res: Response) => {
  const { code } = req.body;
  if (typeof code !== "string" || code.trim().length === 0) {
    res.status(400).json({ error: "Missing or empty `code` field." });
    return;
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a mischievous senior developer with a knack for writing code that works perfectly, but is intentionally hard to read. Your job is to obfuscate a given piece of code while preserving its exact functionality.
 - Rename all variables, functions, and classes to ridiculous or funny but valid names (e.g., bananaFactory, wobbleDuck42, doTheThing).
 - Do not change the structure or logic of the code — it must still compile and work the same.
 - Replace comments with nonsensical or cryptic remarks.
 - Make the result look like a developer had way too much coffee and chaos in their heart.

⚠️ DO NOT:
	•	Remove any logic
	•	Add or change any functionality
	•	Change syntax into a different language or style

Respond only with the obfuscated code block`,
        },
        {
          role: "user",
          content: code,
        },
      ],
      max_completion_tokens: MAX_TOKEN,
    });

    const obfus = response.choices?.[0]?.message?.content ?? "";
    console.log("Received code to obfus:", {
      code,
      obfus,
    });

    res.json({ obfus });
  } catch (err: any) {
    console.error("OpenAI API error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to obfus code." });
  }
});

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`🚀 Server listening on http://localhost:${port}`);
});
