# gdsroutesheet.py - Router for GDS/ERF routesheet queries (steady vs rotating)
# Uses LLM classification only (no keyword matching)

import json
from datetime import datetime
from zoneinfo import ZoneInfo
from config.azure_client import get_azure_chat_openai
from agents.gdssteadyroutesheet import handle_gds_steady_routesheet
from agents.gdsrotatingroutesheetagent import handle_gds_rotating_routesheet


async def handle_gdsroutesheet(query: str, auth_token: str = None):
    """
    Router agent that determines whether query is about steady or rotating GDS/ERF schedules.
    Uses LLM classification to route to the appropriate specialized agent.
    
    Flow:
    1. Use LLM to classify query as "steady" or "rotating"
    2. Route to appropriate handler
    
    Args:
        query: User's question about GDS routesheets
        auth_token: Optional authentication token

    Returns:
        dict: Response from the appropriate handler
    """
    try:
        print(f"[gdsroutesheet-router] Processing query: {query}")
        
        # Use LLM to classify the query
        route_type = await classify_gds_query(query)
        
        print(f"[gdsroutesheet-router] LLM classified as: {route_type.upper()}")
        
        if route_type == "steady":
            return await handle_gds_steady_routesheet(query, auth_token)
        else:  # rotating
            return await handle_gds_rotating_routesheet(query, auth_token)
            
    except Exception as e:
        error_message = f"Error in GDS router: {str(e)}"
        print(f"[gdsroutesheet-router] {error_message}")
        import traceback
        traceback.print_exc()
        return {"answer": "I encountered an error processing your query. Please try rephrasing your question or contact support if the issue persists."}


async def classify_gds_query(query: str) -> str:
    """
    Classify the GDS query as either 'steady' or 'rotating' using LLM only.
    
    Args:
        query: User's question
        
    Returns:
        str: Either "steady" or "rotating"
    """
    try:
        print("[gdsroutesheet-router] Using LLM to classify query...")
        
        azure_client, azureopenai = get_azure_chat_openai()
        
        classification_prompt = f"""
You are a query classifier for GDS/ERF routesheet queries.

Your task is to classify the following user query into one of two categories: "steady" or "rotating".

**User Query:** {query}

## Classification Guidelines:

**STEADY schedules include:**
- Mechanical A (Mech A) steady employees
- Mechanical B (Mech B) steady employees
- ERF steady employees
- Questions about steady shifts, steady assignments
- Keywords/phrases: "Mech A", "Mech B", "Mechanical A", "Mechanical B", "steady", "MechASteady", "MechBSteady", "ERF steady"

**ROTATING schedules include:**
- GDS rotating employees
- GDS Mechanical B rotating employees
- ERF rotating employees
- Questions about rotating shifts, rotating assignments, rotation schedules
- Keywords/phrases: "GDS", "rotating", "rotation", "GDS Mech B rotating", "ERF rotating", "GDS rotating"

## Decision Rules:
1. If query explicitly mentions "Mech A", "Mech B", "Mechanical A/B", or "steady" → classify as STEADY
2. If query explicitly mentions "rotating", "rotation", or "GDS rotating" → classify as ROTATING
3. If query mentions just "GDS" without specifying steady/rotating → classify as ROTATING (default)
4. If query mentions "ERF" without specifying → analyze context:
   - If discussing steady operations → STEADY
   - If discussing rotating operations → ROTATING
   - If unclear → ROTATING (default)
5. If the query is ambiguous or generic → classify as ROTATING (default)

## Examples:
- "Show me Mech A schedules" → STEADY
- "What are the Mechanical B assignments?" → STEADY
- "List GDS employees for this week" → ROTATING
- "Show rotating schedules" → ROTATING
- "Tell me about ERF schedules" → ROTATING (default when unclear)
- "GDS steady schedules" would be ROTATING unless "steady" is explicit for Mech A/B

IMPORTANT: Respond with ONLY ONE WORD - either "steady" or "rotating". Nothing else.
"""
        
        response = azure_client.chat.completions.create(
            model=azureopenai,
            messages=[
                {"role": "system", "content": "You are a query classifier. Respond with exactly one word: 'steady' or 'rotating'. No explanations, no punctuation, just the classification."},
                {"role": "user", "content": classification_prompt}
            ],
            temperature=0,
            max_tokens=10  # Only need one word
        )
        
        classification = response.choices[0].message.content.strip().lower()
        
        # Validate and extract classification
        if "steady" in classification:
            print("[gdsroutesheet-router] ✓ LLM classified as: STEADY")
            return "steady"
        elif "rotating" in classification or "rotation" in classification:
            print("[gdsroutesheet-router] ✓ LLM classified as: ROTATING")
            return "rotating"
        else:
            # Fallback if LLM returns unexpected response
            print(f"[gdsroutesheet-router] ⚠ Unexpected LLM response: '{classification}'. Defaulting to ROTATING")
            return "rotating"
            
    except Exception as e:
        print(f"[gdsroutesheet-router] Classification error: {e}. Defaulting to ROTATING")
        import traceback
        traceback.print_exc()
        return "rotating"  # Safe default fallback