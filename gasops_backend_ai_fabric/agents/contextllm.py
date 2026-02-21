import os
from typing import List, Optional
from dotenv import load_dotenv
from config.azure_client import get_azure_chat_openai

# Load environment variables from .env file if present
load_dotenv()


def rewrite_question(prev_msgs: Optional[List[dict]], current_question: str, auth_token: Optional[str] = None) -> str:
    """
    Given previous messages and the current user question, rewrite the question to be clear and self-contained.
    Handles both follow-up/clarification and fresh questions. Includes current date and time in the context.
    """
    context = ""
    if prev_msgs:
        for i, msg in enumerate(prev_msgs[-5:]):
            # Support both dict and object (e.g., Pydantic/BaseModel) types
            role = msg['role'] if isinstance(msg, dict) else getattr(msg, 'role', '')
            content = msg['content'] if isinstance(msg, dict) else getattr(msg, 'content', '')
            context += f"Previous message {i+1} ({role}): {content}\n"
    context += f"Current user question: {current_question}\n"
    token = auth_token if auth_token else "No auth token provided."
    print(f"[contextllm] Using auth token: {token}")
    # Print the context being sent to the LLM
    print("=== Context sent to contextllm ===")
    print(context)
    print("==================================")

    system_prompt = (
        """
You are an AI assistant that rewrites user questions to be clear and self-contained using prior conversation context.

User Question: {current_question}
Conversation History: {conversation_history}

═══════════════════════════════════
DECISION — SHOULD YOU REWRITE?
═══════════════════════════════════
Only rewrite if ONE of these is true:
  A) User is selecting from a numbered list the assistant showed.
  B) User is confirming a specific suggestion the assistant made.
  C) User wrote a short fragment (1–3 words) that references something the assistant just asked about.
  D) User clearly refers back to prior context using phrases like "those", "that", "same", "for that work order", "from above".

If NONE of A–D apply → return the question EXACTLY as written. No changes at all.

═══════════════════════════════════
HARD RULES — NEVER VIOLATE
═══════════════════════════════════
1. NEVER interpret, expand, or label bare numbers or IDs.
   "show me details on 251900" → Return: "show me details on 251900"
   NEVER assume 251900 is a work order, weld, asset, or anything else.

2. NEVER add filters or context from previous conversation to a new standalone question.
   If the previous chat was about Project G-23-901 and user asks "Give me WRs assigned to DeVoti"
   → Return: "Give me WRs assigned to DeVoti"  (NOT "...for Project G-23-901")

3. NEVER correct or change names, terms, or entities the user wrote.
   "show me welds for kely hsu" → Return exactly that, even if prior message said "kely shu".

4. NEVER combine a new complete question with previous context.
   A question is complete if it has a clear subject and intent on its own.

═══════════════════════════════════
EXAMPLES
═══════════════════════════════════
# Return EXACTLY — standalone questions:
  Current: "show me details on 251900"
  Return:  "show me details on 251900"   ← NEVER add "work order" or any label

  Current: "Give me all the WR assigned to DeVoti"
  Return:  "Give me all the WR assigned to DeVoti"   ← ignore previous project context

  Current: "show me the weld numbers that were cut out"
  Return:  "show me the weld numbers that were cut out"

  Current: "Give me the projects ending with 16"
  Return:  "Give me the projects ending with 16"   ← do NOT add Queens or In Progress from prior chat

# Rewrite — user selects from a list (Rule A):
  Assistant showed: "1. James Hall  2. James Clark  3. James Burke"
  Current: "James Clark"
  Return:  "Show me the work orders assigned to Project Supervisor James Clark"

# Rewrite — implicit continuation with no new subject (Rule D):
  Previous: User asked about work order 100500514, assistant responded about it.
  Current:  "show me the list of assigned engineers and supervisors"
  Return:   "show me the list of assigned engineers and supervisors for work order 100500514"
  WHY: No subject given — user clearly means the same work order.

# Rewrite — user confirms multiple disambiguations (Rule B):
  Assistant asked user to clarify Wayne Griffiths and Sky Testing.
  Current: "Wayne Griffiths, Contractor CWI"
  Return:  "Show me details of Contractor CWI Sky Testing where CWI Wayne Griffiths has worked and there is a difference between the CWI result and NDE result"

═══════════════════════════════════
OUTPUT
═══════════════════════════════════
Return ONLY the question. No explanation. No extra text.
"""
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": context}
    ]

    # Use Azure OpenAI client
    azure_client, azureopenai = get_azure_chat_openai()
    response = azure_client.chat.completions.create(
        model=azureopenai,
        messages=messages,
        max_tokens=256,
        temperature=0.1
    )
    
    rewritten = response.choices[0].message.content.strip()
    print(f"[contextllm] Rewritten question: {rewritten}")
    return rewritten