# gdssteadyroutesheet.py - Handles GDS/ERF STEADY routesheet queries

import json
from datetime import datetime
from zoneinfo import ZoneInfo
from config.azure_client import get_azure_chat_openai
from prompts.gdssteadyroutesheetprompt import get_gds_steady_sql_prompt
from tools.sql_executor import execute_sql_query_with_retry, get_sql_tool_definition
from tools.gdsroutesheet_formatter import format_gdsroutesheet_results
from aisearch.ai_search import gds_steady_routesheet_search


async def handle_gds_steady_routesheet(query: str, auth_token: str = None):
    """
    GDS STEADY routesheet agent that generates SQL queries and formats results.
    Handles Mech A, Mech B, and ERF steady schedules.
    
    Flow:
    1. Fetch relevant examples from AI Search
    2. Get system prompt for SQL generation (steady-specific)
    3. LLM generates SQL query using tool calling
    4. Execute SQL query
    5. Pass results to formatter
    
    Args:
        query: User's question about steady routesheets
        auth_token: Optional authentication token

    Returns:
        dict: Response containing the formatted answer
    """
    try:
        # Get Azure OpenAI client
        azure_client, azureopenai = get_azure_chat_openai()
        
        # Get current date/time context
        eastern = ZoneInfo("America/New_York")
        now = datetime.now(ZoneInfo("UTC")).astimezone(eastern)
        current_year = now.year
        current_date = now.strftime('%B %d, %Y')

        print(f"[gds-steady-agent] Processing query: {query}")
        print(f"[gds-steady-agent] Current year: {current_year}, Current date: {current_date}")

        # Fetch relevant examples from AI Search
        print("[gds-steady-agent] Fetching relevant examples from AI Search...")
        search_results = gds_steady_routesheet_search(query)

        # Extract example content from search results
        examples_context = ""
        if search_results:
            examples_context = "\n\n## Similar Examples from Previous Queries:\n"
            for idx, result in enumerate(search_results[:3], 1):
                examples_context += f"\nExample {idx}:\n{result.page_content}\n"
            print(f"[gds-steady-agent] Found {len(search_results)} relevant examples")
        else:
            print("[gds-steady-agent] No relevant examples found in AI Search")

        # Get SQL generation prompt (steady-specific)
        system_prompt = get_gds_steady_sql_prompt(query, current_year, examples_context)
            
        # Get SQL tool definition
        tools = [get_sql_tool_definition()]
        
        # LLM call to generate SQL
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query}
        ]
        
        print("[gds-steady-agent] Calling LLM to generate SQL...")
        response = azure_client.chat.completions.create(
            model=azureopenai,
            messages=messages,
            tools=tools,
            tool_choice="required"
        )
        
        response_message = response.choices[0].message
        tool_calls = response_message.tool_calls
        
        # If no tool call, return direct response
        if not tool_calls:
            direct_answer = response_message.content
            print(f"[gds-steady-agent] No tool call. Direct response from LLM.")
            return {"answer": direct_answer}
        
        # Execute SQL query
        for tool_call in tool_calls:
            function_name = tool_call.function.name
            function_args = json.loads(tool_call.function.arguments)
            
            if function_name == "execute_sql_query":
                sql_query = function_args.get("sql_query")
                
                try:
                    sql_results = execute_sql_query_with_retry(sql_query)
                    print(f"[gds-steady-agent] Query returned {len(sql_results) if sql_results else 0} rows")

                    # Format results using dedicated formatter
                    print("[gds-steady-agent] Calling formatter to create user response...")
                    formatted_answer = await format_gdsroutesheet_results(query, sql_results)

                    return {
                        "answer": formatted_answer,
                        "rows": sql_results if len(sql_results) > 0 else None,
                        "sql_query": sql_query
                    }
                    
                except Exception as e:
                    error_msg = f"SQL execution error: {str(e)}"
                    print(f"[gds-steady-agent] {error_msg}")
                    return {"answer": "I apologize, but I'm having trouble retrieving that information right now. Could you please rephrase your question or try again in a moment?"}
        
        return {"answer": "I couldn't process your request. Please try again."}
        
    except Exception as e:
        error_message = f"Error in gds-steady-agent: {str(e)}"
        print(f"[gds-steady-agent] {error_message}")
        import traceback
        traceback.print_exc()
        return {"answer": "I encountered an error processing your query. Please try rephrasing your question or contact support if the issue persists."}