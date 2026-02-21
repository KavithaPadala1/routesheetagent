
# supervisor agent to route to subagents based on user query intent

from config.azure_client import get_azure_chat_openai 
from datetime import datetime  
import json
from datetime import datetime, timezone
from zoneinfo import ZoneInfo 
import os

# Import agent handlers
from agents.routesheetagent import handle_routesheet
from tools.numberclarifier import number_clarifier_llm
from tools.nameclarifier import name_clarifier_llm


async def supervisor(query, database_name=None, auth_token=None, clarification_done=False):
    """
    Supervisor agent that routes queries to specialized agents.
    
    Args:
        query: User's question
        database_name: Database name (optional)
        auth_token: Authentication token
        clarification_done: Flag to prevent infinite recursion after clarification
    """

    # Get Azure OpenAI client
    azure_client, azureopenai = get_azure_chat_openai()
    print("Supervisor received query:", query)
    
    # Calculate current time INSIDE the function so it's fresh on each request
    eastern = ZoneInfo("America/New_York")  
    now = datetime.now(ZoneInfo("UTC")).astimezone(eastern)  
    time = now.strftime("%Y-%m-%d %H:%M:%S")
    current_date = now.strftime('%B %d, %Y')
    current_year = now.year
    current_date_mmddyyyy = now.strftime('%m/%d/%Y')
    
    print(f"Current date: {current_date}, Current date mm/dd/yyyy: {current_date_mmddyyyy}, Current year: {current_year}, Current time: {time}")
    
    # Build clarification context
    clarification_note = ""
    if clarification_done:
        clarification_note = """
        IMPORTANT: The query has already been clarified with specific number/name categories (e.g., ProjectNumber, WorkOrderNumber, etc.). 
        DO NOT route to numberclarifier or nameclarifier again. 
        Route directly to the appropriate agent based on the clarified query.
        """
    
    # Use LLM prompt for all intent detection and response
    prompt = (
        f"""
        You are a supervisor managing a team of specialized agents. Your job is to understand the user's intent from their question and respond appropriately.

        User question: {query}
        
        {clarification_note}
        
        Context:
        - Today's date is {current_date}, current year is {current_year}, and the time is {time}.
        - Always greet the user if they greet you and say I can help you with information about the oq fundamentals, routesheets, and fusion. Do not give previous context in responses to greetings.
        - If the user asks a general question (e.g., about today's date, weather, general engineering, design calculations, standards, formulas, or topics about pipe properties, MAOP, wall thickness, steel grade, ASME codes, etc.), answer it directly and concisely and do not invoke any agent.
        - For weather questions, if you do not have real-time data, provide an approximate.
        - If the user's question is a follow-up (short or ambiguous) to a previous domain-specific question, route it to the same agent as before unless the intent clearly changes.
        - When answering direct questions, you can use emojis to make the response more engaging.
        
        Tools:
        You have these two tools when user questions has number or name ambiguity:
        1. numberclarifier : Use 'numberclarifier' tool ONLY if the query contains an ambiguous number WITHOUT a category prefix (e.g., "G23309" is ambiguous, but "ProjectNumber G23309" is NOT ambiguous).
            Example ambiguous: "How many engineers are handling G23309?" -- number G23309 needs clarification
                               "repaired welds in 101086750 ACCUWELD?" -- number 101086750 ACCUWELD needs clarification as it can be alphanumeric also
            Example clear: "who is the engineer for ProjectNumber G23309?" -- already clarified, route to agent
                            " give me details of work order ending/starting with 514" -- already clarified as work order number, route to agent
            Note: Even if user is asking a verification question (e.g., "Is X a work order number?"), still use numberclarifier to identify what X actually is.
        
        2. nameclarifier : Use 'nameclarifier' tool ONLY if the query contains an ambiguous name WITHOUT a role prefix.
            Example ambiguous: "give me the work orders assigned to manju" -- name manju needs clarification
            Example clear: "give me the work orders assigned to WelderName manju" -- already clarified, route to agent
            Example clear: "give me the list of work orders supervised by Waqar" -- already clarified as supervised means SupervisorName, route to agent.
            Example ambiguous : Give me the projects assigned to Shaw Pipeline Services
        - These tools will return either the actual category of the number/name OR a direct answer for verification questions.
        
        Available agents and their domains:
        1. routesheetagent : Handles any queries related to routesheets like company routesheet, contractor routesheets like gasoperations routesheet, CWINDE routesheet, CM routesheet, facility routesheet, speciality routesheet.

        Rules :
        - You do NOT answer domain-specific queries yourself. Instead, you interpret, decide, and route.
        - Maintain strict boundaries: only return general answers if the query is outside agent scope.
        - If the query is ambiguous, ask for clarification before routing.
        - Never route to numberclarifier when category is already specified in user query. eg : "projects ending with 16" -- here user has specified "projects" so no need to route to numberclarifier.
        - Never route to nameclarifier when role is already specified in user query. eg : "work orders supervised by Waqar" -- here user has specified "supervised" so no need to route to nameclarifier.

        Respond in the following format:
        - If general question: {{"answer": "<direct answer>"}}
        - If agent required: {{"agent": "<agent name>"}}
        - If user question is ambiguous: {{"answer": "<ask for clarification clearly>"}}
        - If number ambiguity (ONLY if no category prefix exists): {{"tool": "numberclarifier"}}
        - If name ambiguity (ONLY if no role prefix exists): {{"tool": "nameclarifier"}}
        
        Examples:
        
        User : show me the welds in QG21011633 
        Response: {{"tool": "numberclarifier"}}  -- QG21011633 is ambiguous without category prefix
        User: "Show me the work orders associated with G-23-901 "
        Response: {{"tool": "numberclarifier"}}  -- G-23-901 is ambiguous without category prefix
        User : "Are there any repaired welds in 101086750 ACCUWELD?"  -- here 101086750 ACCUWELD is number ambiguous without category prefix as number can be alphanumeric also.
        Response: {{"tool": "numberclarifier"}}  -- 101086750 ACCUWELD is ambiguous without category prefix
        
       
        """
    )

    # Send query to Azure OpenAI 
    response = azure_client.chat.completions.create(
        model=azureopenai,
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": query}
        ]
    )
    result = response.choices[0].message.content.strip()
    print("Supervisor LLM response:", result)
    
    # Try to parse the LLM response
    try:
        parsed = json.loads(result)
        print("Parsed response:", parsed)
    except Exception:
        parsed = {"answer": result}
        print("Failed to parse response as JSON. Treating as direct answer.", parsed)
    
    # Handle numberclarifier tool
    if parsed.get("tool") == "numberclarifier" and not clarification_done:
        print("Routing to numberclarifier tool")
        clarifier_result = await number_clarifier_llm(query, auth_token)
        
        # Check if clarifier returned a direct answer (for verification questions)
        if clarifier_result.get("answer"):
            print(f"Number clarifier provided direct answer: {clarifier_result.get('answer')}")
            return {
                "answer": clarifier_result.get("answer")
            }
        
        if clarifier_result.get("success"):
            # For non-verification questions, rewrite and route to agent
            rewritten_query = clarifier_result.get("rewritten_query")
            print(f"Number clarified. Reprocessing with: {rewritten_query}")
            return await supervisor(rewritten_query, database_name, auth_token, clarification_done=True)
        else:
            # Return error message to user when number not found
            error_message = clarifier_result.get("error", "Unable to clarify the number in your query.")
            print(f"Number clarification failed: {error_message}")
            return {
                "answer": error_message
            }
            
            
    # Handle nameclarifier tool
    if parsed.get("tool") == "nameclarifier" and not clarification_done:
        print("Routing to nameclarifier tool")
        clarifier_result = await name_clarifier_llm(query, auth_token)
        
        # Check if name clarifier needs user input for multiple matches
        if clarifier_result.get("needs_clarification"):
            print(f"Name clarifier needs user clarification")
            return {
                "answer": clarifier_result.get("clarification_message"),
                "needs_clarification": True,
                "matches": clarifier_result.get("matches"),
                "original_query": clarifier_result.get("original_query")
            }
        
        if clarifier_result.get("success"):
            # Single match found - rewrite and route to agent
            rewritten_query = clarifier_result.get("rewritten_query")
            print(f"Name clarified. Reprocessing with: {rewritten_query}")
            return await supervisor(rewritten_query, database_name, auth_token, clarification_done=True)
        else:
            # Return error message when name not found
            error_message = clarifier_result.get("error", "Unable to clarify the name in your query.")
            print(f"Name clarification failed: {error_message}")
            return {
                "answer": error_message
            }
    
    # Handle nameclarifier tool
    if parsed.get("tool") == "nameclarifier" and not clarification_done:
        print("Routing to nameclarifier tool")
        return {"answer": "Name clarifier is not yet implemented. Please specify the name type in your query."}
    
    # Route to appropriate agent based on parsed response
    if parsed.get("agent") == "routesheetagent":
        print("Routing to routesheetagent")
        return await handle_routesheet(query, auth_token)
    # elif parsed.get("agent") == "mtragent":
    #     print("Routing to mtragent")
    #     return handle_mtr_agent(query, auth_token)
    # elif parsed.get("agent") == "specsagent":
    #     print("Routing to specsagent")
    #     return handle_specs_agent(query, auth_token)
    
    return parsed