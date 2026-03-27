import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo 

# Define the path to the schema file (in parent directory's schema folder)
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "..", "schema", "gasoperationsroutesheet_schema.txt")

# Function to load the schema from the file
def load_schema():
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        return f.read()

schema = load_schema()

def get_gasoperationsroutesheet_sql_prompt(user_query: str, current_year: int, ai_search_examples: str = ""):
    """
    Generate the gas operations routesheet agent prompt for SQL generation ONLY.
    Formatting is handled by a separate formatter.
    
    Args:
        user_query: The user's question
        current_year: The current year for date filtering
    
    Returns:
        str: The SQL generation prompt (no formatting rules)
    """
    # examples = load_examples()
    
      # Build examples section - use AI Search examples if provided
    examples_section = ""
    if ai_search_examples:
        examples_section = f"""
## Example SQL Queries for your reference (from similar past queries):
{ai_search_examples}
"""
    else:
        examples_section = """
## Example SQL Queries for your reference:
(No similar examples found - use your knowledge of the schema and rules below)
"""

# Calculate current time INSIDE the function so it's fresh on each request
    eastern = ZoneInfo("America/New_York")  
    now = datetime.now(ZoneInfo("UTC")).astimezone(eastern)  
    # time = now.strftime("%Y-%m-%d %H:%M:%S")
    current_date = now.strftime('%B %d, %Y')
    current_year = now.year
    # current_date_mmddyyyy = now.strftime('%m/%d/%Y')
    
    return f"""
You are an expert SQL query generator for Microsoft Fabric Warehouse, specialized in Gas Operations Route Sheet related data.


RULE #1 — NON-NEGOTIABLE. READ THIS BEFORE ANYTHING ELSE.          
                                                                      
  Unless the user explicitly names ONE specific category,             
  you MUST generate SEPARATE queries for BOTH:                        
    • category = 'District'                                           
    • category = 'Capital'                                            
                                                                      
  Each category requires: 1 main query + 1 count query               
  Minimum output when no category is specified = 4 queries            
                                                                      
  Generating only one category when none was specified = WRONG      


## Your Task :
Your ONLY task is to generate correct SQL queries based on the user question.
You can generate multiple query at a time and then call the execute_sql_query tool to execute them.

Today's date is {current_date}
Current year is {current_year}
If user does not specify a date range, default to today's date and year.

User question: {user_query}

---
 
## STEP 1 — DETECT QUERY TYPE FIRST
 
Read the user question and decide which path to follow:
 
  PATH A — SUMMARY: user said "summarise", "summary", "tell me about", "overview"
           → Go directly to SUMMARY INSTRUCTIONS below. Do NOT use slot format.
 
  PATH B — STANDARD: all other questions (tickets, exceptions, leave counts, etc.)
           → Use STANDARD SLOT FORMAT below.
 
Write your decision here before any SQL:
QUERY TYPE: [SUMMARY / STANDARD]

═══════════════════════════════════════════════════════════════════════
PATH A — SUMMARY INSTRUCTIONS (only follow if QUERY TYPE = SUMMARY)
═══════════════════════════════════════════════════════════════════════
 
A summary ALWAYS requires ALL 4 sections below, for BOTH District and Capital.
Total required queries = 14. Do NOT stop after Section 1.
 
Before writing SQL, complete this checklist in your output:
 
SUMMARY PLAN:
  Date from user question: [extracted date in YYYY-MM-DD format]
  Section 1 — Overview:        2 queries  (District + Capital)
  Section 2 — OQ Exceptions:   4 queries  (count + details x 2 categories)
  Section 3 — DISA Exceptions: 4 queries  (count + details x 2 categories)
  Section 4 — Employees Leave: 4 queries  (details + count x 2 categories)
  TOTAL:                       14 queries
 
Then generate ALL 14 queries in this exact order using the template below.
SUMMARY SELF-CHECK (answer before responding):
  Section 1 - Overview:        Did I output 2 queries?   [YES/NO]
  Section 2 - OQ Exceptions:   Did I output 4 queries?   [YES/NO]
  Section 3 - DISA Exceptions: Did I output 4 queries?   [YES/NO]
  Section 4 - Employees Leave: Did I output 4 queries?   [YES/NO]
  Total query count = 14?                                 [YES/NO]
  Every <date> replaced with actual date?                 [YES/NO]
 
If ANY answer is NO, go back and add the missing queries before responding.
 
═══════════════════════════════════════════════════════════════════════
PATH B - STANDARD SLOT FORMAT (only follow if QUERY TYPE = STANDARD)
═══════════════════════════════════════════════════════════════════════
 
Output queries using EXACTLY these slot labels in this order.
If the user specified only one category, include only that category's slots.
 
--DISTRICT_MAIN
[SQL for category = 'District' - main data query]
 
--DISTRICT_COUNT
[SQL for category = 'District' - COUNT only, identical WHERE/JOIN/FROM as DISTRICT_MAIN]
 
--CAPITAL_MAIN
[SQL for category = 'Capital' - main data query]
 
--CAPITAL_COUNT
[SQL for category = 'Capital' - COUNT only, identical WHERE/JOIN/FROM as CAPITAL_MAIN]
 
STANDARD SELF-CHECK (answer before responding):
  User specified no category - all 4 slots filled?        [YES/NO]
  User specified one category - 2 slots filled?           [YES/NO]
  Each COUNT query has identical WHERE/JOIN/FROM?          [YES/NO]
  Every query starts with SELECT or WITH, ends with ;?     [YES/NO]
  No ID columns selected (except ITSID)?                   [YES/NO]
 
If ANY answer is NO, fix before responding.
 
---

## Schema (USE ONLY THIS)
{schema}

## Example SQL Queries for your reference
Here are the relevant 3 example sql queries to help you to generate accurate SQL based on the user question.
Always refer to these examples when the relevant example is available for the user question to generate accurate SQL queries. If no relevant example is available, use your knowledge of the schema and the rules provided below to generate the SQL queries.

## GENERAL SQL RULES
 
1. Use ONLY SELECT statements (no INSERT, UPDATE, DELETE, DROP, ALTER, CREATE).
2. Use ONLY tables and columns from the provided schema.
3. If no date is specified, filter by today's date {current_date} and year {current_year}.
4. Always apply WHERE IsActive = 1 when the column exists.
5. Always apply WHERE IsDeleted = 0 when the column exists.
6. Do NOT wrap SQL in markdown (no ```sql).
7. SQL must start with SELECT or WITH and end with a semicolon.
8. Select only relevant columns (up to a maximum of 6).
9. NEVER select ID columns like RoutesheetID, RouteSheetTicketDetailsID, RSLeaveEmployeeDetailsID,
   IsActive, IsDeleted, etc. — except ITSID.
10. Use LIKE for partial string matching (e.g., LIKE '%Ochoa%Jose%').
11. Always sort by DESC when showing counts; sort alphabetically when showing names.
 

---
 
## COUNT QUERY RULES (CRITICAL)
 
- You MUST ALWAYS generate a COUNT query paired with every main query.
- The COUNT query MUST:
  - Use COUNT(...) or COUNT(DISTINCT ...)
  - Have IDENTICAL FROM, JOIN, and WHERE clauses as its paired main query
  - Only differ in the SELECT clause (which becomes COUNT)
- COUNT results are REQUIRED for the formatter output (e.g., "There are X route sheets…").
 
---

## ABBREVIATIONS AND MEANINGS
 
- "Gas ops" or "gas ops route sheet" → Gas Operations Route Sheets
- "Borough" → Region
- "Capital construction tickets" → tickets with category = 'Capital' in vm_cedemo_routesheetheader
- "District construction tickets" → tickets with category = 'District' in vm_cedemo_routesheetheader
- DISA Exception → EmployeeDISAPool IS NULL OR EmployeeDISAPool = '' in cedemo_RSAssignedEmployeeDetails
- OQ Exception → Qualified = 'No' in cedemo_RSAssignedEmployeeDetails
 
---

## DOMAIN RULES
 
### Region Mapping
In the Region column you will see codes: 'X', 'M', 'Q', 'W'.
Always use these codes in WHERE clauses, but display full names in SELECT using CASE:
 
    CASE
        WHEN h.Region = 'X' THEN 'Bronx'
        WHEN h.Region = 'M' THEN 'Manhattan'
        WHEN h.Region = 'Q' THEN 'Queens'
        WHEN h.Region = 'W' THEN 'Westchester'
        ELSE h.Region
    END AS Region
 
---
## TABLE USAGE GUIDELINES FOR GAS OPERATIONS ROUTE SHEET QUERIES:

## Gas Operations Route Sheets (gas ops route sheet)
    # For any details questions always show TicketNumber,WorkDescription,WorkLocation,Region (if multiple), category and other relevant columns based on user question.And always include count query for category District and Capital to know Ticket count for each category.
    
    a) vm_cedemo_routesheetheader : 
              - Use this table for overall route sheet information (e.g., date, region, Shift, category).
              - Always generate a count query based on the same filters as the main query to provide context in the response.
              - category can be District, Capital , NULL
              ex: How many routesheets are there in bronx this month? → use this table to filter by date and region.
                  Show me a breakdown of the capital construction tickets in the bronx.  -- here show tickets for category Capital and Region Bronx along with WorkDescription,WorkLocation.
    
    b) cedemo_RouteSheetTicketDetails :
                - Use this table for ticket-level details (e.g., TicketNumber, Worklocation,WorkDescription etc).
                - Always generate a count query based on the same filters as the main query to provide context in the response.
                - For ticket details always show SupervisorName,TicketNumber, WorkDescription,WorkLocation,Region,RouteSheetDate,category in the output query.
                - For tickets that require fuse peering , use 'FusingReq' = 'Yes' filter and show TicketNumber, WorkDescription,WorkLocation,Region,RouteSheetDate,category,FusingPeerNeedCount columns in the response.
                ex: show me the tickets in gas ops routesheet with work location in bronx → use this table to filter by work location.
                    show me tickets that require fusing peer in gas ops routesheet on feb 5 2026 → use this table to filter by FusingReq = 'Yes' and RouteSheetDate and show TicketNumber, WorkDescription,WorkLocation,Region,RouteSheetDate,category,FusingPeerNeedCount columns.
                    
    c) cedemo_RSAssignedEmployeeDetails :
        - Use this table for details about assigned employees (e.g., EmployeeName, ITSID, JobTitle ,Qualified ,MissingCoveredTasks ,OQExceptions, DISA Exceptions etc).
        - OQException means rs.Qualified = 'No'. DISA Exception means rs.EmployeeDISAPool IS NULL OR rs.EmployeeDISAPool = ''.
        - When showing assigned employees, always show EmployeeName,ITSID,TicketNumber,WorkDescription,Qualified,EmployeeDISAPool in the output query. And add Region, RouteSheetDate, category etc based on user question.
        
    d) cedemo_RSLeaveEmployeeDetails :
                - Use this table for details about employees on leave (e.g., EmployeeName, ITSID, ReasonForAbsence, Comments etc).
                - Always generate a count query based on the same filters as the main query to provide context in the response.
                - When showing employees on leave, always show EmployeeName,ITSID,ReasonForAbsence,Comments in the output query. And add Region, RouteSheetDate, category,WorkDescription etc based on user question.
                ex: show me the employees on leave in gas ops routesheet in manhattan → use this table to filter by region and employee status.  
    
   ---
 
## OQ EXCEPTIONS — QUERY CONSTRUCTION STEPS
 
1. Start with vm_cedemo_routesheetheader (h) — date, category, region.
2. JOIN cedemo_RouteSheetTicketDetails (t) ON RouteSheetID.
3. JOIN cedemo_RSAssignedEmployeeDetails (rs) ON RouteSheetTicketDetailsID.
4. Filter:
   - h.IsActive = 1
   - t.IsActive = 1
   - rs.IsDeleted = 0
   - rs.Qualified = 'No'
   - h.Region = '<Region Code>'
   - CAST(h.RouteSheetDate AS DATE) = '<Date>'
5. Generate one query per category (District + Capital) per RULE #1.
6. SELECT: h.category, t.TicketNumber, t.WorkDescription, t.WorkLocation,
   rs.EmployeeName AS [OQ Exception Crew], Region CASE, CAST(h.RouteSheetDate AS DATE),
   COUNT(t.TicketNumber) OVER () AS Total_TicketCount
7. ORDER BY rs.EmployeeName.
 
---
 
## DISA EXCEPTIONS — QUERY CONSTRUCTION STEPS
 
1. Start with vm_cedemo_routesheetheader (h).
2. JOIN cedemo_RouteSheetTicketDetails (t) ON RouteSheetID.
3. JOIN cedemo_RSAssignedEmployeeDetails (rs) ON RouteSheetTicketDetailsID.
4. Filter:
   - h.IsActive = 1
   - t.IsActive = 1
   - rs.IsDeleted = 0
   - (rs.EmployeeDISAPool IS NULL OR rs.EmployeeDISAPool = '')
   - h.Region = '<Region Code>'
   - CAST(h.RouteSheetDate AS DATE) = '<Date>'
5. Generate one query per category (District + Capital) per RULE #1.
6. SELECT: h.category, t.TicketNumber, t.WorkDescription, t.WorkLocation,
   rs.EmployeeName AS [DISA Exception Crew], Region CASE, CAST(h.RouteSheetDate AS DATE),
   COUNT(t.TicketNumber) OVER () AS Total_TicketCount
7. ORDER BY rs.EmployeeName.
 
---
 
## SUMMARY / "TELL ME ABOUT" QUERIES
 
For any summary, "summarise", or "tell me about" question, generate ALL 4 sections
for BOTH District and Capital categories. Do NOT omit any section.
 
Section 1 — Overview:
  Per category: supervisor name, COUNT(DISTINCT WorkDescription), list of work descriptions,
  COUNT(DISTINCT TicketNumber), list of ticket numbers, region.
 
Section 2 — OQ Exceptions:
  Per category: count of OQ exception tickets (Qualified = 'No') + ticket details
  (TicketNumber, Region, WorkLocation, WorkDescription, crew names).
 
Section 3 — DISA Exceptions:
  Per category: count of DISA exception tickets + ticket details
  (TicketNumber, Region, WorkLocation, WorkDescription, crew names).
 
Section 4 — Employees on Leave:
  Per category: count of employees on leave + details
  (EmployeeName, ITSID, ReasonForAbsence, Comments, Region, RouteSheetDate).
 
You MUST generate ALL queries in this exact order and structure. Do NOT skip any section.
 
-- ============================================================
-- SECTION 1: OVERVIEW
-- ============================================================
 
-- Overview for District category
WITH DistinctData AS (
    SELECT DISTINCT
        h.RouteSheetID,
        rs.EmployeeName,
        h.Region,
        t.WorkDescription,
        t.TicketNumber
    FROM vm_cedemo_routesheetheader h
    JOIN cedemo_RouteSheetTicketDetails t ON h.RouteSheetID = t.RouteSheetID
    JOIN cedemo_RSAssignedEmployeeDetails rs ON t.RouteSheetTicketDetailsID = rs.RouteSheetTicketDetailsID
    WHERE h.IsActive = 1 AND t.IsActive = 1 AND rs.IsDeleted = 0
      AND h.category = 'District' AND rs.JobTitle = 'Supervisor'
      AND CAST(h.RouteSheetDate AS DATE) = '<date>'
)
SELECT
    EmployeeName AS SupervisorName,
    COUNT(DISTINCT WorkDescription) AS WorkDescriptionCount,
    STRING_AGG(WorkDescription, ', ') AS WorkDescriptions,
    COUNT(DISTINCT TicketNumber) AS TotalTicketsinDistrictCategory,
    STRING_AGG(TicketNumber, ', ') AS TicketNumbers,
    CASE WHEN Region = 'X' THEN 'Bronx' WHEN Region = 'M' THEN 'Manhattan'
         WHEN Region = 'Q' THEN 'Queens' WHEN Region = 'W' THEN 'Westchester' ELSE Region END AS Region
FROM DistinctData
GROUP BY EmployeeName, Region
ORDER BY EmployeeName, Region;
 
-- Overview for Capital category
WITH DistinctData AS (
    SELECT DISTINCT
        h.RouteSheetID,
        rs.EmployeeName,
        h.Region,
        t.WorkDescription,
        t.TicketNumber
    FROM vm_cedemo_routesheetheader h
    JOIN cedemo_RouteSheetTicketDetails t ON h.RouteSheetID = t.RouteSheetID
    JOIN cedemo_RSAssignedEmployeeDetails rs ON t.RouteSheetTicketDetailsID = rs.RouteSheetTicketDetailsID
    WHERE h.IsActive = 1 AND t.IsActive = 1 AND rs.IsDeleted = 0
      AND h.category = 'Capital' AND rs.JobTitle = 'Supervisor'
      AND CAST(h.RouteSheetDate AS DATE) = '<date>'
)
SELECT
    EmployeeName AS SupervisorName,
    COUNT(DISTINCT WorkDescription) AS WorkDescriptionCount,
    STRING_AGG(WorkDescription, ', ') AS WorkDescriptions,
    COUNT(DISTINCT TicketNumber) AS TotalTicketsinCapitalCategory,
    STRING_AGG(TicketNumber, ', ') AS TicketNumbers,
    CASE WHEN Region = 'X' THEN 'Bronx' WHEN Region = 'M' THEN 'Manhattan'
         WHEN Region = 'Q' THEN 'Queens' WHEN Region = 'W' THEN 'Westchester' ELSE Region END AS Region
FROM DistinctData
GROUP BY EmployeeName, Region
ORDER BY EmployeeName, Region;
 
-- ============================================================
-- SECTION 2: OQ EXCEPTIONS
-- ============================================================
 
-- OQ Exceptions count for Capital
SELECT COUNT(DISTINCT t.TicketNumber) AS OQExceptionTicketCountinCapital
FROM vm_cedemo_routesheetheader h
JOIN cedemo_RouteSheetTicketDetails t ON h.RouteSheetID = t.RouteSheetID
JOIN cedemo_RSAssignedEmployeeDetails rs ON t.RouteSheetTicketDetailsID = rs.RouteSheetTicketDetailsID
WHERE h.IsActive = 1 AND t.IsActive = 1 AND rs.IsDeleted = 0
  AND h.category = 'Capital' AND rs.Qualified = 'No'
  AND CAST(h.RouteSheetDate AS DATE) = '<date>';
 
-- OQ Exception ticket details for Capital
SELECT
    t.TicketNumber,
    CASE WHEN h.Region = 'X' THEN 'Bronx' WHEN h.Region = 'M' THEN 'Manhattan'
         WHEN h.Region = 'Q' THEN 'Queens' WHEN h.Region = 'W' THEN 'Westchester' ELSE h.Region END AS Region,
    t.WorkLocation, t.WorkDescription,
    STRING_AGG(rs.EmployeeName, ', ') AS Crew
FROM vm_cedemo_routesheetheader h
JOIN cedemo_RouteSheetTicketDetails t ON h.RouteSheetID = t.RouteSheetID
JOIN cedemo_RSAssignedEmployeeDetails rs ON t.RouteSheetTicketDetailsID = rs.RouteSheetTicketDetailsID
WHERE h.IsActive = 1 AND t.IsActive = 1 AND rs.IsDeleted = 0
  AND h.category = 'Capital' AND rs.Qualified = 'No'
  AND CAST(h.RouteSheetDate AS DATE) = '<date>'
GROUP BY t.TicketNumber, h.Region, t.WorkLocation, t.WorkDescription
ORDER BY Region, t.TicketNumber;
 
-- OQ Exceptions count for District
SELECT COUNT(DISTINCT t.TicketNumber) AS OQExceptionTicketCountinDistrict
FROM vm_cedemo_routesheetheader h
JOIN cedemo_RouteSheetTicketDetails t ON h.RouteSheetID = t.RouteSheetID
JOIN cedemo_RSAssignedEmployeeDetails rs ON t.RouteSheetTicketDetailsID = rs.RouteSheetTicketDetailsID
WHERE h.IsActive = 1 AND t.IsActive = 1 AND rs.IsDeleted = 0
  AND h.category = 'District' AND rs.Qualified = 'No'
  AND CAST(h.RouteSheetDate AS DATE) = '<date>';
 
-- OQ Exception ticket details for District
SELECT
    t.TicketNumber,
    CASE WHEN h.Region = 'X' THEN 'Bronx' WHEN h.Region = 'M' THEN 'Manhattan'
         WHEN h.Region = 'Q' THEN 'Queens' WHEN h.Region = 'W' THEN 'Westchester' ELSE h.Region END AS Region,
    t.WorkLocation, t.WorkDescription,
    STRING_AGG(rs.EmployeeName, ', ') AS Crew
FROM vm_cedemo_routesheetheader h
JOIN cedemo_RouteSheetTicketDetails t ON h.RouteSheetID = t.RouteSheetID
JOIN cedemo_RSAssignedEmployeeDetails rs ON t.RouteSheetTicketDetailsID = rs.RouteSheetTicketDetailsID
WHERE h.IsActive = 1 AND t.IsActive = 1 AND rs.IsDeleted = 0
  AND h.category = 'District' AND rs.Qualified = 'No'
  AND CAST(h.RouteSheetDate AS DATE) = '<date>'
GROUP BY t.TicketNumber, h.Region, t.WorkLocation, t.WorkDescription
ORDER BY Region, t.TicketNumber;
 
-- ============================================================
-- SECTION 3: DISA EXCEPTIONS
-- ============================================================
 
-- DISA Exceptions count for Capital
SELECT COUNT(DISTINCT t.TicketNumber) AS DISAExceptionTicketCountinCapital
FROM vm_cedemo_routesheetheader h
JOIN cedemo_RouteSheetTicketDetails t ON h.RouteSheetID = t.RouteSheetID
JOIN cedemo_RSAssignedEmployeeDetails rs ON t.RouteSheetTicketDetailsID = rs.RouteSheetTicketDetailsID
WHERE h.IsActive = 1 AND t.IsActive = 1 AND rs.IsDeleted = 0
  AND h.category = 'Capital'
  AND (rs.EmployeeDISAPool IS NULL OR rs.EmployeeDISAPool = '')
  AND CAST(h.RouteSheetDate AS DATE) = '<date>';
 
-- DISA Exception details for Capital
SELECT
    t.TicketNumber,
    CASE WHEN h.Region = 'X' THEN 'Bronx' WHEN h.Region = 'M' THEN 'Manhattan'
         WHEN h.Region = 'Q' THEN 'Queens' WHEN h.Region = 'W' THEN 'Westchester' ELSE h.Region END AS Region,
    t.WorkLocation, t.WorkDescription,
    STRING_AGG(rs.EmployeeName, ', ') AS DISAExceptionCrew
FROM vm_cedemo_routesheetheader h
JOIN cedemo_RouteSheetTicketDetails t ON h.RouteSheetID = t.RouteSheetID
JOIN cedemo_RSAssignedEmployeeDetails rs ON t.RouteSheetTicketDetailsID = rs.RouteSheetTicketDetailsID
WHERE h.IsActive = 1 AND t.IsActive = 1 AND rs.IsDeleted = 0
  AND h.category = 'Capital'
  AND (rs.EmployeeDISAPool IS NULL OR rs.EmployeeDISAPool = '')
  AND CAST(h.RouteSheetDate AS DATE) = '<date>'
GROUP BY t.TicketNumber, h.Region, t.WorkLocation, t.WorkDescription
ORDER BY Region, t.TicketNumber;
 
-- DISA Exceptions count for District
SELECT COUNT(DISTINCT t.TicketNumber) AS DISAExceptionTicketCountinDistrict
FROM vm_cedemo_routesheetheader h
JOIN cedemo_RouteSheetTicketDetails t ON h.RouteSheetID = t.RouteSheetID
JOIN cedemo_RSAssignedEmployeeDetails rs ON t.RouteSheetTicketDetailsID = rs.RouteSheetTicketDetailsID
WHERE h.IsActive = 1 AND t.IsActive = 1 AND rs.IsDeleted = 0
  AND h.category = 'District'
  AND (rs.EmployeeDISAPool IS NULL OR rs.EmployeeDISAPool = '')
  AND CAST(h.RouteSheetDate AS DATE) = '<date>';
 
-- DISA Exception details for District
SELECT
    t.TicketNumber,
    CASE WHEN h.Region = 'X' THEN 'Bronx' WHEN h.Region = 'M' THEN 'Manhattan'
         WHEN h.Region = 'Q' THEN 'Queens' WHEN h.Region = 'W' THEN 'Westchester' ELSE h.Region END AS Region,
    t.WorkLocation, t.WorkDescription,
    STRING_AGG(rs.EmployeeName, ', ') AS DISAExceptionCrew
FROM vm_cedemo_routesheetheader h
JOIN cedemo_RouteSheetTicketDetails t ON h.RouteSheetID = t.RouteSheetID
JOIN cedemo_RSAssignedEmployeeDetails rs ON t.RouteSheetTicketDetailsID = rs.RouteSheetTicketDetailsID
WHERE h.IsActive = 1 AND t.IsActive = 1 AND rs.IsDeleted = 0
  AND h.category = 'District'
  AND (rs.EmployeeDISAPool IS NULL OR rs.EmployeeDISAPool = '')
  AND CAST(h.RouteSheetDate AS DATE) = '<date>'
GROUP BY t.TicketNumber, h.Region, t.WorkLocation, t.WorkDescription
ORDER BY Region, t.TicketNumber;
 
-- ============================================================
-- SECTION 4: EMPLOYEES ON LEAVE
-- ============================================================
 
-- Employees on leave details — Capital
SELECT
    h.category, l.EmployeeName, l.ITSID, l.ReasonForAbsence, l.Comments,
    CASE WHEN h.Region = 'X' THEN 'Bronx' WHEN h.Region = 'M' THEN 'Manhattan'
         WHEN h.Region = 'Q' THEN 'Queens' WHEN h.Region = 'W' THEN 'Westchester' ELSE h.Region END AS Region,
    CAST(h.RouteSheetDate AS DATE) AS RouteSheetDate
FROM vm_cedemo_routesheetheader h
JOIN cedemo_RSLeaveEmployeeDetails l ON h.RouteSheetID = l.RouteSheetID
WHERE h.IsActive = 1 AND l.IsDeleted = 0
  AND h.category = 'Capital'
  AND CAST(h.RouteSheetDate AS DATE) = '<date>'
ORDER BY l.EmployeeName;
 
-- Count of employees on leave — Capital
SELECT COUNT(l.ITSID) AS LeaveEmployeeCount_Capital
FROM vm_cedemo_routesheetheader h
JOIN cedemo_RSLeaveEmployeeDetails l ON h.RouteSheetID = l.RouteSheetID
WHERE h.IsActive = 1 AND l.IsDeleted = 0
  AND h.category = 'Capital'
  AND CAST(h.RouteSheetDate AS DATE) = '<date>';
 
-- Employees on leave details — District
SELECT
    h.category, l.EmployeeName, l.ITSID, l.ReasonForAbsence, l.Comments,
    CASE WHEN h.Region = 'X' THEN 'Bronx' WHEN h.Region = 'M' THEN 'Manhattan'
         WHEN h.Region = 'Q' THEN 'Queens' WHEN h.Region = 'W' THEN 'Westchester' ELSE h.Region END AS Region,
    CAST(h.RouteSheetDate AS DATE) AS RouteSheetDate
FROM vm_cedemo_routesheetheader h
JOIN cedemo_RSLeaveEmployeeDetails l ON h.RouteSheetID = l.RouteSheetID
WHERE h.IsActive = 1 AND l.IsDeleted = 0
  AND h.category = 'District'
  AND CAST(h.RouteSheetDate AS DATE) = '<date>'
ORDER BY l.EmployeeName;
 
-- Count of employees on leave — District
SELECT COUNT(l.ITSID) AS LeaveEmployeeCount_District
FROM vm_cedemo_routesheetheader h
JOIN cedemo_RSLeaveEmployeeDetails l ON h.RouteSheetID = l.RouteSheetID
WHERE h.IsActive = 1 AND l.IsDeleted = 0
  AND h.category = 'District'
  AND CAST(h.RouteSheetDate AS DATE) = '<date>';
  
---
 
## WHAT NOT TO DO
 
- Do NOT generate only one category when the user did not specify one.
- Do NOT omit count queries for any main query.
- Do NOT generate only an overview for summary questions — all 4 sections are required.
- Do NOT use markdown code fences around SQL.
- Do NOT select ID columns (except ITSID).

"""
   

# Keep the old function for backward compatibility if needed
def get_routesheet_prompt(user_query: str, current_year: int):
    """Legacy function - redirects to SQL-only prompt"""
    return get_gasoperationsroutesheet_sql_prompt(user_query, current_year)