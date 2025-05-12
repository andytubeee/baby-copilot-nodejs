import express, { Request, Response } from "express";

import { OpenAI } from "openai";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const MAX_TOKEN = 1200;
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
          content: `You are a mischievous senior developer with a knack for writing code that works perfectly, but is intentionally hard to read as humans. Your job is to obfuscate a given piece of code while preserving its exact functionality.
 - Rename all variables, functions, and classes to string that looks like random hashes (3f8ei9d99d8d).
 - Do not change the structure or logic of the code — it must still compile and work the same.
 - Replace comments with nonsensical or cryptic remarks.
 - Make the result look like a developer had way too much coffee and chaos in their heart.
 - Keep the behavior the same

 For example: print("hello world") can be \`def shdfs(sfs) print(sfs) dsfs="hello world" shdfs(dsfs) \`

⚠️ DO NOT:
	•	Remove any logic
	•	Add or change any functionality
	•	Change syntax into a different language or style

Respond only with the obfuscated code block, without any markdown styling, it will be applied to text editor suggestion`,
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

app.post("/suggest", async (req: Request, res: Response) => {
  const { code_context } = req.body;

  if (typeof code_context !== "string" || code_context.trim().length === 0) {
    res.status(400).json({ error: "Missing or empty `code_context` field." });
    return;
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an AI programming assistant. You will be given an incomplete piece of source code. Your task is to generate only the next few lines that would naturally follow. Sometimes, you are also given additional code context from after the current caret position, where you are asked to write/suggest code in the middle of some code. where @caret is the symbol I will use for current position. Please use the context code from above and below the "@caret" symbol to fill in the best line, or block of code at the position of @caret. Continue from exactly where the code stops, without repeating or modifying the existing lines. Return only the raw code as plain text, with no markdown or explanations. Stay in the same programming language. End your response naturaYou are an AI-powered code completion engine. You will be given a partial source code snippet that includes both the surrounding context and a special marker "@caret" indicating the current cursor position. Your task is to generate the most likely next few lines of code that a developer would naturally write at that exact position. The code may be incomplete and placed anywhere — at the beginning, middle, or end of a function, class, or file. You must use both the code before and after the "@caret" to understand what logically belongs there. You may be asked to complete a single line, an indented block, or a partial expression — continue from exactly where the code stops. ⚠️ Do not repeat, modify, or paraphrase any lines already present in the input. Do not alter variable names, formatting, or structure. Do not include comments or explanations. Produce only the raw code continuation, in the same programming language as the input. Match the original code’s indentation, style, and tone. Your output must be a syntactically valid continuation — stop naturally and avoid cutting off mid-token or mid-line. If nothing should be inserted (e.g., the code is already complete), return an empty response.lly — avoid cutting off mid-token.`,
        },
        {
          role: "user",
          content: code_context,
        },
      ],
      max_tokens: 100,
      stop: STOP_INDICATORS,
    });

    const suggestion = response.choices?.[0]?.message?.content ?? "";

    // console.log("Typing suggestion generated:", { code_context, suggestion });

    res.json({ suggestion });
  } catch (err: any) {
    console.error(
      "OpenAI API error in /suggest:",
      err.response?.data || err.message
    );
    res.status(500).json({ error: "Failed to get suggestion." });
  }
});

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`🚀 Server listening on http://localhost:${port}`);
});
