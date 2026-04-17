# sliroutesheet_formatter.py - Formats SQL query results for SLI routesheet agent

import json
from config.azure_client import get_azure_chat_openai
from datetime import datetime, timezone
from zoneinfo import ZoneInfo 

async def format_sliroutesheet_results(user_query: str, sql_results: list) -> str:
    """
    Format SQL query results into a user-friendly response.
    
    Args:
        user_query: The original user question
        sql_results: Results from SQL query execution
    
    Returns:
        str: Formatted response for the user
    """
    # Calculate current time
    eastern = ZoneInfo("America/New_York")  
    now = datetime.now(ZoneInfo("UTC")).astimezone(eastern)  
    current_date = now.strftime('%B %d, %Y')
    current_year = now.year
    
    try:
        # Get Azure OpenAI client
        azure_client, azureopenai = get_azure_chat_openai()

        # Create formatting prompt
        formatting_prompt = f"""
You are a response formatter for a SLI Routesheet Insights AI assistant.

User Question: {user_query}

SQL Query Results:
{json.dumps(sql_results, indent=2, default=str)}

## For your Context :
Today's date is {current_date}
Current year is {current_year}

General Guidelines:
- Understand the user's question and the SQL results thoroughly before formatting the response.
- Use emojis, markdown tables, bullet points, sections, and other formatting tools to make the response engaging and easy to read as needed.
- Use natural polite and professional tone in the response.
- At the end of the response, suggest next question the user can ask related to SLI routesheet data to encourage further engagement when appropriate.
- If the response has single row with multiple columns then present the response in bullet points format instead of table.

What NOT to do:
- NEVER return raw SQL results or JSON data or technical jargon in the response to the user.
- Never change the sql results data or manually count rows for counts. Always use the data as is from SQL results.
- Do not mention phrases like "based on the SQL results" or "here is easy to read". Instead, directly answer the user's question.
- Do not use <br> html tags for line breaks in the response.
- Do not count rows manually for counts. Always use the count from SQL results if available.
- Do not mention the word "Suggested next question"; instead, directly suggest that question.

## Core Behaviour Rules:
1. Understand the user's intent first, then format accordingly.
2. Always begin with a natural contextual sentence.
3. Never say: "You asked..." or greet the user in start of the response.
4. Never ask if the user wants the full list.
5. If the user says "show all", display all rows (no preview).
6. If result includes a count column from SQL, use that count. Never manually count rows.

## Formatting Guidelines:
1. General:
   - If user asks specifically for all then show all rows.
   - Understand the user question and format the results accordingly for better readability.
   - Never ask or suggest to show full list.
   - If any column values has same value for all rows then simply mention that in starting sentence instead of showing that column in table or bullet points.
   - If any column name is NULL and has no values then do not show that column in the response.
   - Always show all the columns in the results except the columns which has same value for all rows.

2. **Structure**:
   - Start with an intro line mentioning the count.
   - Present the data clearly either in bullet points, short paragraphs, sections with headers, or tables as appropriate.
   - End with a summary/insights when applicable and/or relevant suggested next questions when appropriate.
   - Use emojis to enhance readability naturally wherever applicable.
   - Keep the tone conversational, professional and engaging to enhance user experience.

3. **Format Selection**:
   - Use **Markdown tables** only for multi-column and multi-row results with less than 13 rows and greater than 3 rows.
   - Use **bullet points or short paragraphs** for single-column results and rows less than 5 or greater than 15.
   - Always choose the format that maximizes clarity and user understanding.
   - If user explicitly requests a table → Always use a Markdown table.
"""
        
        # Call LLM to format the results
        response = azure_client.chat.completions.create(
            model=azureopenai,
            messages=[
                {"role": "system", "content": "You are a helpful assistant that formats data into clear, user-friendly responses."},
                {"role": "user", "content": formatting_prompt}
            ],
            temperature=0.1  # Lower temperature for consistent formatting
        )
        
        formatted_response = response.choices[0].message.content
        print(f"[sliroutesheet_formatter] Response formatted successfully")
        
        return formatted_response
        
    except Exception as e:
        error_message = f"Error formatting results: {str(e)}"
        print(f"[sliroutesheet_formatter] {error_message}")
        import traceback
        traceback.print_exc()
        # Return a simple fallback format
        return f"Here are the results:\n{json.dumps(sql_results, indent=2, default=str)}"