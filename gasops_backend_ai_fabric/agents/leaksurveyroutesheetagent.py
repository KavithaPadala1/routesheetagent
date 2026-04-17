
# leaksurveyroutesheet.py - Handles leak survey routesheet-related queries by generating and executing SQL

import json
from datetime import datetime
from zoneinfo import ZoneInfo
from config.azure_client import get_azure_chat_openai
from prompts.leaksurveyroutesheetprompt import get_leaksurveyroutesheet_sql_prompt

from tools.sql_executor import execute_sql_query_with_retry, get_sql_tool_definition

from tools.leaksurveyroutesheet_formatter import format_leaksurveyroutesheet_results
from aisearch.ai_search import leaksurvey_routesheet_search  # Import AI Search


async def handle_leaksurveyroutesheet(query: str, auth_token: str = None):
    """
    Routesheet agent that generates SQL queries and formats results.
    
    Flow:
    fetched relevant examples from AI Search to include in prompt
    1. Get system prompt for SQL generation only (simplified prompt)
    2. LLM generates SQL query using tool calling
    3. Execute SQL query
    4. Pass results to formatter for user-friendly response
    
    Args:
        query: User's question about routesheets.

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

        print(f"[leaksurveyroutesheetagent] Processing query: {query}")
        print(f"[leaksurveyroutesheetagent] Current year: {current_year}, Current date: {current_date}")

        # Fetch relevant examples from AI Search
        print("[leaksurveyroutesheetagent] Fetching relevant examples from AI Search...")
        search_results = leaksurvey_routesheet_search(query)

        # Extract example content from search results
        examples_context = ""
        if search_results:
            examples_context = "\n\n## Similar Examples from Previous Queries:\n"
            for idx, result in enumerate(search_results[:3], 1):  # Top 3 results
                examples_context += f"\nExample {idx}:\n{result.page_content}\n"
            print(f"[leaksurveyroutesheetagent] Found {len(search_results)} relevant examples")
            print(f"[leaksurveyroutesheetagent] Examples context:\n{examples_context}")
        else:
            print("[leaksurveyroutesheetagent] No relevant examples found in AI Search")


        # Get SQL generation prompt (simplified - no formatting rules)
        system_prompt = get_leaksurveyroutesheet_sql_prompt(query, current_year)  
        
        # # Append AI Search examples to the prompt
        # if examples_context:
        #     system_prompt += examples_context
            
        # Get SQL tool definition
        tools = [get_sql_tool_definition()]
        
        # LLM call to generate SQL
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query}
        ]
        
        print("[leaksurveyroutesheetagent] Calling LLM to generate SQL...")
        response = azure_client.chat.completions.create(
            model=azureopenai,
            messages=messages,
            tools=tools,
            tool_choice="required"
        )
        
        response_message = response.choices[0].message
        tool_calls = response_message.tool_calls
        
        # If no tool call, return direct response (e.g., greetings)
        if not tool_calls:
            direct_answer = response_message.content
            print(f"[leaksurveyroutesheetagent] No tool call. Direct response from LLM.")
            return {"answer": direct_answer}
        
        # Execute SQL query
        for tool_call in tool_calls:
            function_name = tool_call.function.name
            function_args = json.loads(tool_call.function.arguments)
            
            if function_name == "execute_sql_query":
                sql_query = function_args.get("sql_query")
                
                # Execute the SQL query
                try:
                    # sql_results = execute_sql_query(sql_query)
                    sql_results =  execute_sql_query_with_retry(sql_query)
                    print(f"[leaksurveyroutesheetagent] Query returned {len(sql_results) if sql_results else 0} rows")

                    # Format results using dedicated formatter
                    print("[leaksurveyroutesheetagent] Calling formatter to create user response...")
                    formatted_answer = await format_leaksurveyroutesheet_results(query, sql_results)

                    # return {"answer": formatted_answer}
                    return {"answer": formatted_answer,
                            "rows": sql_results if len(sql_results) > 0 else None,  # return sql result along with response for download
                            "sql_query": sql_query }      
                    
                except Exception as e:
                    error_msg = f"SQL execution error: {str(e)}"
                    print(f"[leaksurveyroutesheetagent] {error_msg}")

                    # Return friendly error message
                    return {"answer": "I apologize, but I'm having trouble retrieving that information right now. Could you please rephrase your question or try again in a moment?"}
        
        return {"answer": "I couldn't process your request. Please try again."}
        
    except Exception as e:
        error_message = f"Error in leaksurveyroutesheetagent: {str(e)}"
        print(f"[leaksurveyroutesheetagent] {error_message}")
        import traceback
        traceback.print_exc()
        return {"answer": "I encountered an error processing your query. Please try rephrasing your question or contact support if the issue persists."}