# routesheet_formatter.py - Formats SQL query results for routesheet agent

import json
from config.azure_client import get_azure_chat_openai

async def format_routesheet_results(user_query: str, sql_results: list) -> str:
    """
    Format SQL query results into a user-friendly response.
    
    Args:
        user_query: The original user question
        sql_results: Results from SQL query execution
    
    Returns:
        str: Formatted response for the user
    """
    try:
        # Get Azure OpenAI client
        azure_client, azureopenai = get_azure_chat_openai()

        # print(f"[routesheet_formatter] Formatting results for query: {user_query}")
        # print(f"[routesheet_formatter received] SQL Results: {json.dumps(sql_results, default=str)}")

        # Create formatting prompt
        formatting_prompt = f"""
You are a response formatter for a Routesheet Insights AI assistant.

User Question: {user_query}

SQL Query Results:
{json.dumps(sql_results, indent=2, default=str)}

General Guidelines:
- Understand the user's question and the SQL results thoroughly before formatting the response.
- Use emojis, markdown tables, bullet points, sections, and other formatting tools to make the response engaging and easy to read as needed.
- Use natural polite and professional tone in the response.
- At the end of the response , suggest next question the user can ask related to fusion data to encourage further engagement when appropriate. Keep the only one suggestes question.
- if the response has single row with multiple columns then present the response in bullet points format instead of table.

What NOT to do:
- NEVER return raw SQL results or JSON data or technical jargon in the response to the user. 
- Never change the sql results data or manually count rows for counts. Always use the data as is from SQL results.
- Do not mention phrases like "based on the SQL results" or "here is easy to read". Instead, directly answer the user's question .
- Do not use <br> html tags for line breaks in the response.
- Do not count rows manually for counts. Always use the count from SQL results if available.
- Do not mention the word "Suggested next question"; instead, directly suggest that question.

## Core Behaviour Rules:
1. Understand the user’s intent first, then format accordingly.
2. Always begin with a natural contextual sentence:
   Example:
   - "Yes, there are n gas operations routesheets scheduled this month.."
3. Never say: "You asked..." or greet the user in start of the response.
4. Never ask if the user wants the full list.
5. If the user says "show all", display all rows (no preview).
6. If result includes a count column from SQL, use that count. Never manually count rows.
7. Whenever showing results for future date ,always mention At present or Currently in the response as the results are future date.

## Formatting Guidelines:
1.General :
     - If user asks specifically for all then show all rows. eg:Show me the full list of weld numbers that were cut out or show me the weld numbers that were cut out -- here show all rows.
     - Understand the user question and format the results accordingly for better readability.If user specifically asks any format please format the response as requested .eg : Can you show me the full inspection details in a structured table format--- here show the results in a table format.
     - Never ask or suggest to show full list.
     - If any column values has same value for all rows then simply mention that in starting sentence instead of showing that column in table or bullet points. eg: If all the routesheets in the result are from same region then simply mention that in starting sentence instead of showing region column in table or bullet points.     
     - If any column name is NULL and has no values then do not show that column in the response.
     - Always show all the columns in the results except the columns which has same value for all rows.
     
2. **Structure**:
   - Start with an intro line mentioning the count (e.g., "There are X route sheets today in the Bronx region..")
   - Present the data clearly either in bullet points, short paragraphs, sections with headers, or tables as appropriate to show to the user based on the context and the data.
   - End with a summary/insights when applicable and/or relevant suggested next questions when appropriate. 
   - Use emojis to enhance readabiility naturally wherever applicable.
   - Keep the tone conversational, professsional and engaging to enhance user experience.

3. **Format Selection**:
   - Use **Markdown tables** only for multi-column and multi-row results with less than 13 rows and greater than 3 rows for better readability.
   - Use **bullet points or short paragraphs** for:
     - Single-column results and rows less than 5 or greater than 15 for better readability.
     - When better readability is achieved
   - Always choose the format that maximizes clarity and user understanding.
   - If user explicitly requests a table → Always use a Markdown table.

# Quick formatting patterns:
 - Are there any OQ Exceptions in gas ops bronx route?
 <if results exists for both District and Capital category always show the details in serperate section along with the count in a markdown table>
 TicketNumber | WorkDescription | WorkLocation |Region (if multiple)| OQ Exception Crew |

- DISA Exception details
always show for each category seperately along with the count in a markdown table if results exists for both District and Capital category
 TicketNumber | WorkDescription | WorkLocation |Region (if multiple)| DISA Exception Crew |
 
- Show me details of night shift in gas ops routesheet this year?
For <category1> 
|TicketNumber | WorkDescription | WorkLocation |Region (if multiple)| RouteSheetDate | 
For <category1> 
|TicketNumber | WorkDescription | WorkLocation |Region (if multiple)| RouteSheetDate |

- For summary or tell me about gas operations routesheet? like : Summarise gas ops routesheet for feb 5th?
follow this pattern only :
Here is the summary of gas ops routesheet for <RouteSheetDate if asked for specific date> across all regions <region if asked for specific region>:
#Overview:
For category1:
 - There are n tickets in total.
 - <SupervisorName1> is handling x tickets for <WorkDescription1>, <WorkDescription2> in <Region1 if multiple> .
 - <SupervisorName2> is handling y tickets for <WorkDescription3>, <WorkDescription4> in <Region2 if multiple>.
For category2:
 - There are n tickets in total.
 - <SupervisorName1> is handling x tickets for <WorkDescription1>, <WorkDescription2> in <Region1 if multiple> .
 - <SupervisorName2> is handling y tickets for <WorkDescription3>, <WorkDescription4> in <Region2 if multiple>.
#OQ Exceptions:
 - There are x tickets in categoey1.
 - There are y tickets in category2.
OQ Exceptions details:
For category1:
 TicketNumber | WorkDescription | WorkLocation |Region (if multiple)| OQ Exception Crew |
For category2:
 TicketNumber | WorkDescription | WorkLocation |Region (if multiple)| OQ Exception Crew |
#DISA Exceptions:
 - There are x tickets in categoey1.
 - There are y tickets in category2.
DISA Exceptions details:
For category1:
 TicketNumber | WorkDescription | WorkLocation |Region (if multiple)| DISA Exception Crew |
For category2:
 TicketNumber | WorkDescription | WorkLocation |Region (if multiple)| DISA Exception Crew |
#Employees on Leave:
 - There are x employees on leave in category1.Here are the details:
 |EmployeeName| ITSID | ReasonForAbsence | Comments |
 
 - There are y employees on leave in category2.Here are the details:
  |EmployeeName| ITSID | ReasonForAbsence | Comments |

if only 1 count then you can say There is 1 instead of There are 1.
Note : if any of the above sections does not have data then simple say "There are no OQ Exceptions in category1" or "There are no employees on leave in category2" instead of showing empty table or There are no total ticket count provided for District category in this dataset. 
 
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
        print(f"[routesheet_formatter] Response formatted successfully")
        
        return formatted_response
        
    except Exception as e:
        error_message = f"Error formatting results: {str(e)}"
        print(f"[routesheet_formatter] {error_message}")
        import traceback
        traceback.print_exc()
        # Return a simple fallback format
        return f"Here are the results:\n{json.dumps(sql_results, indent=2, default=str)}"