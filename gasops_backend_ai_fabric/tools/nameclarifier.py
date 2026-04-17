from config.azure_client import get_azure_chat_openai
from tools.sql_executor import execute_sql_query
import json
import re


async def detect_routesheet_type(query: str):
    """
    Detect the route sheet type from a user query using the LLM.
    """
    azure_client, azureopenai = get_azure_chat_openai()

    prompt = f"""
You are a route sheet classifier.

Identify whether the user's query refers to one of the supported route sheet types.

Supported route sheet types:
- Contractor Route Sheet
- Gas Operations Route Sheet
- Tunnel Route Sheet
- Corrosion Route Sheet
- Leak Survey Route Sheet
- SLI Route Sheet
- GDS/ERF Route Sheet

Return a JSON object with a single key `route_sheet_type`.
The value must be exactly one of the supported route sheet type strings above,
or null if the query does not clearly refer to any supported route sheet.

User Query: {query}

Return ONLY the JSON object and nothing else.
"""

    try:
        response = azure_client.chat.completions.create(
            model=azureopenai,
            messages=[
                {"role": "system", "content": "You classify route sheet types from user queries. Return only JSON output."},
                {"role": "user", "content": prompt}
            ],
            temperature=0,
            max_completion_tokens=150
        )

        raw = response.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(raw)
        route_sheet_type = parsed.get("route_sheet_type")
        if route_sheet_type is None or route_sheet_type == "" or route_sheet_type == "null":
            return None
        return route_sheet_type

    except Exception as e:
        print(f"[Name Clarifier] Route sheet detection failed: {str(e)}")
        return None


async def name_clarifier_llm(query: str, auth_token=None):
    """
    Identifies categories of ALL ambiguous names in the user query using a 3-step process:
    1. LLM extracts ALL names from user query (without classifying as person/company)
    2. Static SQL query searches for matches in ALL categories (person AND company)
    3. Rewrites query with all clarified names OR generates clarification message
    
    Args:
        query: User's original query containing ambiguous names
        auth_token: Authentication token (optional)
    
    Returns:
        dict: Contains either rewritten query OR clarification request
    """
    
    azure_client, azureopenai = get_azure_chat_openai()
    
    route_sheet_type = await detect_routesheet_type(query)
    if route_sheet_type:
        print(f"[Name Clarifier] Detected route sheet type: {route_sheet_type}")
    else:
        print("[Name Clarifier] No explicit route sheet type detected")
    
    print(f"[Name Clarifier] Received query: {query}")
    
    # ============================================================
    # STEP 1: LLM extracts ALL names from user query (NO CLASSIFICATION)
    # ============================================================
    extraction_prompt = f"""
    Extract ALL names (people, companies, contractors, etc.) from this query.
    Return them in a JSON array called "names".
    DO NOT try to classify them as person vs company - just extract all potential names.
    
    IMPORTANT: Do NOT extract:
    - Technical terms or inspection types
    - Query metadata or conditions
    - Route sheet type keywords (leaksurvey, routesheet, contractor, company, gas operations, tunnel, corrosion, SLI, GDS, ERF)
    - Time references (this week, today, yesterday, etc.)
    
    Only extract actual person names and company/contractor names.
    
    User Query: {query}
    
    Examples:
    - "show me projects handled by Joseph at Shaw Pipeline" 
      → {{"names": ["Joseph", "Shaw Pipeline"]}}
    
    - "how many welds did james clark complete for Sky Testing"
      → {{"names": ["james clark", "Sky Testing"]}}
    
    - "Show me details of TechCorr where Aby has worked"
      → {{"names": ["TechCorr", "Aby"]}}
    
    - "give me work orders for supervisor manju"
      → {{"names": ["manju"]}}
    
    - "show me inspections by CWI Smith at Turner Corp"
      → {{"names": ["Smith", "Turner Corp"]}}
    
    - "Show me details for calahan where gregory regalia has worked and there is a difference between the CWI result and NDE result"
      → {{"names": ["calahan", "gregory regalia"]}}
      (Note: CWI and NDE are field references, not names)

    - "show me tickets by work type of bond in bronx in contractor routesheet"
      → {{"names": ["bond"]}}
    
    - "show me shift details for robin barnet in contractor leaksurvey routesheet"
      → {{"names": ["robin barnet"]}}
      (Note: "contractor", "leaksurvey", "routesheet" are route sheet type keywords, not names)

    Important: Do NOT extract location or region names such as Bronx, Manhattan, Queens, Brooklyn, New York, Jersey City.

    Return ONLY the JSON object, no explanation.
    """
    
    try:
        response = azure_client.chat.completions.create(
            model=azureopenai,
            messages=[
                {"role": "system", "content": "You extract person and company names from queries. Ignore field names, technical terms, and column references. Return only JSON format."},
                {"role": "user", "content": extraction_prompt}
            ],
            temperature=0,
            max_completion_tokens=150
        )
        
        extracted_json = response.choices[0].message.content.strip()
        extracted_data = json.loads(extracted_json)
        all_names = extracted_data.get("names", [])
        all_names = filter_out_location_names(all_names)
        
        print(f"[Name Clarifier] Extracted names after location filter: {all_names}")
        
        if not all_names:
            return {
                "success": False,
                "error": "Sorry, I couldn't identify any names in your question. 🤔\n\n"
                       "Could you please rephrase with clear names?"
            }
    
    except Exception as e:
        print(f"[Name Clarifier] Error extracting names: {str(e)}")
        return {
            "success": False,
            "error": "Oops! I had trouble understanding that question. 😅 Could you rephrase it?"
        }
    
    # ============================================================
    # STEP 2: Search for ALL extracted names in ALL categories
    # ============================================================
    all_clarifications = []
    
    # Search each name according to the detected route sheet type
    for name in all_names:
        result = await search_name_in_all_categories(name, route_sheet_type)
        
        if result and len(result) > 0:
            all_clarifications.append({
                "original_name": name,
                "matches": result
            })
        else:
            # Name not found
            all_clarifications.append({
                "original_name": name,
                "matches": [],
                "not_found": True
            })
    
    # Check if any names were not found
    not_found_names = [item["original_name"] for item in all_clarifications if item.get("not_found")]
    if not_found_names:
        names_str = ", ".join(f"'{name}'" for name in not_found_names)
        return {
            "success": False,
            "error": f"Sorry, I couldn't find {names_str} in our system. 😔\n\n"
                   f"Please check:\n"
                   f"  ✓ Spelling of the name(s)\n"
                   f"  ✓ Try using full names\n"
                   f"  ✓ Verify they exist in our system"
        }
    
    # ============================================================
    # STEP 3: Handle results
    # ============================================================
    # Check if ANY name has multiple matches OR multiple categories
    needs_user_clarification = any(
        len(item["matches"]) > 1 or 
        (len(item["matches"]) == 1 and len(item["matches"][0].get("all_categories", [])) > 1)
        for item in all_clarifications
    )
    
    if needs_user_clarification:
        return await handle_multiple_names_clarification(query, all_clarifications)
    else:
        # All names have single matches in single categories - rewrite query
        return await handle_all_single_matches(query, all_clarifications)


async def search_name_in_all_categories(name: str, route_sheet_type: str = None):
    """
    Search for a name in categories based on the detected route sheet type.
    """
    if route_sheet_type == 'Contractor Route Sheet':
        return await search_name_in_contractor_routesheet(name)
    elif route_sheet_type == 'Leak Survey Route Sheet':
        return await search_name_in_leaksurvey_routesheet(name)

    print(f"[Name Clarifier] Unsupported route sheet type for name search: {route_sheet_type}")
    return None


async def search_name_in_contractor_routesheet(name: str):
    """
    Search for a name only within Contractor Route Sheet columns.
    """
    sql_query = generate_contractor_routesheet_name_search_query(name)
    results = execute_sql_query(sql_query)
    processed = process_search_results(results, {"ContractorName", "ContractorDisplayName"})
    return collapse_contractor_display_matches(processed)


async def search_name_in_leaksurvey_routesheet(name: str):
    """
    Search for a name in Leak Survey Route Sheet employee tables.
    Searches both company and contractor employee views.
    """
    sql_query = generate_leaksurvey_routesheet_name_search_query(name)
    results = execute_sql_query(sql_query)
    processed = process_leaksurvey_search_results(results)
    return processed


def normalize_company_match(name: str) -> str:
    name = name or ""
    normalized = re.sub(r'[^a-z0-9]+', '', name.lower())
    return normalized


def filter_out_location_names(names):
    if not names:
        return names

    ignore_locations = {
        "bronx", "manhattan", "queens", "brooklyn", "staten island",
        "new york", "new york city", "nyc", "new jersey", "jersey city",
        "long island", "harlem", "the bronx"
    }

    filtered = []
    for name in names:
        normalized = name.strip().lower()
        if normalized in ignore_locations:
            continue
        filtered.append(name)

    return filtered


def reverse_employee_name(name: str) -> str:
    """
    Reverse employee name by moving the last part to the front.
    
    Examples:
        'Robin Barnett' -> 'Barnett Robin'
        'Carac Mas Cristobal' -> 'Cristobal Carac Mas'
        'John Michael Smith' -> 'Smith John Michael'
        'Mary' -> 'Mary' (single name unchanged)
    
    Args:
        name: Employee name as stored in database
    
    Returns:
        str: Name with last part moved to front
    """
    if not name or not name.strip():
        return name
    
    name_parts = name.strip().split()
    
    # If single name, return as-is
    if len(name_parts) <= 1:
        return name
    
    # Move last part to the front: "First Middle Last" -> "Last First Middle"
    return f"{name_parts[-1]} {' '.join(name_parts[:-1])}"


def is_same_contractor_entity(name_a: str, name_b: str) -> bool:
    if not name_a or not name_b:
        return False

    lower_a = name_a.strip().lower()
    lower_b = name_b.strip().lower()
    if lower_a == lower_b:
        return True

    if lower_a in lower_b or lower_b in lower_a:
        return True

    normalized_a = normalize_company_match(name_a)
    normalized_b = normalize_company_match(name_b)
    return normalized_a == normalized_b


def collapse_contractor_display_matches(matches):
    if not matches or len(matches) <= 1:
        return matches

    contractor_name_matches = [m for m in matches if m['category'] == 'ContractorName']
    contractor_display_matches = [m for m in matches if m['category'] == 'ContractorDisplayName']
    work_description_matches = [m for m in matches if m['category'] == 'WorkDescription']

    if not contractor_name_matches:
        return matches

    collapsed = []
    removed_display_names = set()
    removed_work_descriptions = set()

    for display_match in contractor_display_matches:
        for name_match in contractor_name_matches:
            if is_same_contractor_entity(display_match['name'], name_match['name']):
                removed_display_names.add(display_match['name'])
                if 'ContractorDisplayName' in name_match['all_categories']:
                    name_match['all_categories'] = [c for c in name_match['all_categories'] if c != 'ContractorDisplayName']
                name_match['unique_roles'] = [u for u in name_match['unique_roles'] if u != 'Contractor Display']
                name_match['similarity'] = max(name_match['similarity'], display_match['similarity'])
                break

    for work_match in work_description_matches:
        for name_match in contractor_name_matches:
            if is_same_contractor_entity(work_match['name'], name_match['name']):
                removed_work_descriptions.add(work_match['name'])
                name_match['similarity'] = max(name_match['similarity'], work_match['similarity'])
                break

    for item in matches:
        if item['category'] == 'ContractorDisplayName' and item['name'] in removed_display_names:
            continue
        if item['category'] == 'WorkDescription' and item['name'] in removed_work_descriptions:
            continue
        collapsed.append(item)

    return collapsed


def process_search_results(results, company_categories):
    if not results or len(results) == 0:
        return None

    name_groups = {}

    for row in results:
        count = row.get("count", 0)
        category = row.get("category")
        matched_value = row.get("matched_value")
        similarity = float(row.get("similarity", 0))

        if count > 0 and similarity > 0 and matched_value:
            entity_type = "company" if category in company_categories else "other"

            if matched_value not in name_groups:
                name_groups[matched_value] = {
                    "name": matched_value,
                    "type": entity_type,
                    "categories": [],
                    "max_similarity": similarity
                }

            name_groups[matched_value]["categories"].append({
                "category": category,
                "similarity": similarity
            })

            if similarity > name_groups[matched_value]["max_similarity"]:
                name_groups[matched_value]["max_similarity"] = similarity

    if not name_groups:
        return None

    all_matches = []
    for name_value, group_data in name_groups.items():
        best_category = max(group_data["categories"], key=lambda x: x["similarity"])
        unique_roles = list({format_category_name(c["category"]) for c in group_data["categories"]})

        all_matches.append({
            "name": name_value,
            "category": best_category["category"],
            "type": group_data["type"],
            "similarity": group_data["max_similarity"],
            "all_categories": [c["category"] for c in group_data["categories"]],
            "unique_roles": unique_roles
        })

    all_matches.sort(key=lambda x: x["similarity"], reverse=True)
    return all_matches




def generate_leaksurvey_routesheet_name_search_query(name: str) -> str:
    """
    Generate SQL query for Leak Survey Route Sheet employee name search.
    Searches in both company and contractor employee views.
    """
    sanitized_name = name.replace("'", "''").strip()
    union_parts = []

    def build_employee_part(view_name, category_label):
        return f"""
        SELECT
            COUNT(*) as count,
            '{category_label}' as category,
            EmployeeName as matched_value,
            ITSID as itsid,
            CASE
                WHEN LOWER(EmployeeName) LIKE LOWER('{sanitized_name}%') THEN 1.0
                WHEN LOWER(EmployeeName) LIKE LOWER('%{sanitized_name}%') THEN 0.9
                WHEN SOUNDEX(EmployeeName) = SOUNDEX('{sanitized_name}') THEN 0.8
                WHEN EXISTS (
                    SELECT 1 FROM STRING_SPLIT(REPLACE(EmployeeName, '  ', ' '), ' ') AS word
                    WHERE SOUNDEX(word.value) = SOUNDEX('{sanitized_name}')
                ) THEN 0.7
                ELSE 0.0
            END as similarity
        FROM {view_name}
        WHERE EmployeeName IS NOT NULL
          AND LTRIM(RTRIM(EmployeeName)) != ''
          AND (
              LOWER(EmployeeName) LIKE LOWER('%{sanitized_name}%')
              OR SOUNDEX(EmployeeName) = SOUNDEX('{sanitized_name}')
              OR EXISTS (
                  SELECT 1 FROM STRING_SPLIT(REPLACE(EmployeeName, '  ', ' '), ' ') AS word
                  WHERE LOWER(word.value) = LOWER('{sanitized_name}')
                     OR SOUNDEX(word.value) = SOUNDEX('{sanitized_name}')
              )
          )
        GROUP BY EmployeeName, ITSID
        HAVING COUNT(*) > 0
        """.strip()

    # Search in company employees
    union_parts.append(build_employee_part(
        'vm_cedemo_companyemployees_active',
        'EmployeeName'
    ))

    # Search in contractor employees
    union_parts.append(build_employee_part(
        'vm_cedemo_contractoremployees_active',
        'EmployeeName'
    ))

    full_query = "\nUNION ALL\n".join(union_parts)
    full_query += "\nORDER BY similarity DESC, count DESC"
    return full_query


def process_leaksurvey_search_results(results):
    """
    Process Leak Survey Route Sheet employee search results.
    Groups by employee name and ITSID, handling duplicates across company/contractor tables.
    """
    if not results or len(results) == 0:
        return None

    name_groups = {}

    for row in results:
        count = row.get("count", 0)
        category = row.get("category")
        matched_value = row.get("matched_value")
        itsid = row.get("itsid")
        similarity = float(row.get("similarity", 0))

        if count > 0 and similarity > 0 and matched_value:
            # Use combination of name and ITSID as unique key
            unique_key = f"{matched_value}|{itsid}"

            if unique_key not in name_groups:
                name_groups[unique_key] = {
                    "name": matched_value,
                    "itsid": itsid,
                    "type": "employee",
                    "categories": [],
                    "max_similarity": similarity
                }

            name_groups[unique_key]["categories"].append({
                "category": category,
                "similarity": similarity
            })

            if similarity > name_groups[unique_key]["max_similarity"]:
                name_groups[unique_key]["max_similarity"] = similarity

    if not name_groups:
        return None

    all_matches = []
    for unique_key, group_data in name_groups.items():
        best_category = max(group_data["categories"], key=lambda x: x["similarity"])
        unique_roles = list({"Employee" for c in group_data["categories"]})

        all_matches.append({
            "name": reverse_employee_name(group_data["name"]),  # Reverse name to LastName FirstName format
            "itsid": group_data["itsid"],
            "category": best_category["category"],
            "type": group_data["type"],
            "similarity": group_data["max_similarity"],
            "all_categories": [c["category"] for c in group_data["categories"]],
            "unique_roles": unique_roles
        })

    all_matches.sort(key=lambda x: x["similarity"], reverse=True)
    return all_matches


def generate_contractor_routesheet_name_search_query(name: str) -> str:
    """
    Generate SQL query for Contractor Route Sheet name search.
    """
    sanitized_name = name.replace("'", "''").strip()
    union_parts = []

    def build_part(table_name, column_name, category_label, extra_where=""):
        return f"""
        SELECT
            COUNT(*) as count,
            '{category_label}' as category,
            {column_name} as matched_value,
            CASE
                WHEN LOWER({column_name}) LIKE LOWER('{sanitized_name}%') THEN 1.0
                WHEN LOWER({column_name}) LIKE LOWER('%{sanitized_name}%') THEN 0.9
                WHEN SOUNDEX({column_name}) = SOUNDEX('{sanitized_name}') THEN 0.8
                WHEN EXISTS (
                    SELECT 1 FROM STRING_SPLIT(REPLACE({column_name}, '  ', ' '), ' ') AS word
                    WHERE SOUNDEX(word.value) = SOUNDEX('{sanitized_name}')
                ) THEN 0.7
                ELSE 0.0
            END as similarity
        FROM {table_name}
        WHERE {column_name} IS NOT NULL
          AND LTRIM(RTRIM({column_name})) != ''
          {extra_where}
          AND (
              LOWER({column_name}) LIKE LOWER('%{sanitized_name}%')
              OR SOUNDEX({column_name}) = SOUNDEX('{sanitized_name}')
              OR EXISTS (
                  SELECT 1 FROM STRING_SPLIT(REPLACE({column_name}, '  ', ' '), ' ') AS word
                  WHERE LOWER(word.value) = LOWER('{sanitized_name}')
                     OR SOUNDEX(word.value) = SOUNDEX('{sanitized_name}')
              )
          )
        GROUP BY {column_name}
        HAVING COUNT(*) > 0
        """.strip()

    union_parts.append(build_part(
        'cedemo_ContractorRouteSheetTicketDetails',
        'WorkType',
        'WorkType',
        "AND IsActive = 1"
    ))

    union_parts.append(build_part(
        'CEDEMO_ContractorMaster',
        'ContractorName',
        'ContractorName'
    ))

    union_parts.append(build_part(
        'CEDEMO_ContractorMaster',
        'ContractorDisplayName',
        'ContractorDisplayName'
    ))

    alias_where = "AND RouteSheetType = 'Contractor Route Sheet' AND IsActive = 1"
    union_parts.append(build_part(
        'CEDEMO_FieldActivityAliasesMaster',
        'FieldActivityDescription',
        'WorkDescription',
        alias_where
    ))
    union_parts.append(build_part(
        'CEDEMO_FieldActivityAliasesMaster',
        'AliasName',
        'WorkDescription',
        alias_where
    ))

    full_query = "\nUNION ALL\n".join(union_parts)
    full_query += "\nORDER BY similarity DESC, count DESC"
    return full_query


async def handle_all_single_matches(original_query: str, clarifications: list):
    """
    All names have single matches - rewrite query with all clarified names.
    
    Args:
        original_query: User's original question
        clarifications: List of clarification results (each with single match)
    
    Returns:
        dict: Success response with rewritten query
    """
    
    azure_client, azureopenai = get_azure_chat_openai()
    
    # Build replacement instructions
    replacements = []
    for item in clarifications:
        match = item["matches"][0]
        # Include ITSID if present (for Leak Survey)
        if "itsid" in match and match["itsid"]:
            clarified_text = f"{match['category']} {match['name']} ITSID {match['itsid']}"
        else:
            clarified_text = f"{match['category']} {match['name']}"
        
        replacements.append({
            "original": item["original_name"],
            "clarified": clarified_text,
            "type": match["type"],
            "category": match["category"],
            "full_name": match["name"],
            "itsid": match.get("itsid")
        })

    replacements_text = "\n".join([
        f"- Replace '{r['original']}' with '{r['clarified']}' ({r['type']})"
        for r in replacements
    ])

    rewrite_prompt = f"""
    Rewrite the user's query by replacing only the ambiguous names with their clarified category and name.
    Keep every other word exactly as it appears in the original query, including region names such as Bronx.

    Original Query: {original_query}

    Replacements to make:
    {replacements_text}

    Examples:
    - Original: "show me tickets by work type of bond in bronx in contractor routesheet"
      Replacements: bond → ContractorName Bond Civil & Utility Construction Inc. (company)
      Rewritten: "show me tickets by work type of ContractorName Bond Civil & Utility Construction Inc. in bronx in contractor routesheet"
    
    - Original: "show me this week shift details for Barnett Robin in company leak survey"
      Replacements: Barnett Robin → EmployeeName Barnett Robin ITSID 334020 (employee)
      Rewritten: "show me this week shift details for EmployeeName Barnett Robin ITSID 334020 in company leak survey"

    Return ONLY the rewritten query, with no explanation or additional text.
    """

    try:
        response = azure_client.chat.completions.create(
            model=azureopenai,
            messages=[
                {"role": "system", "content": "You rewrite user queries by replacing ambiguous names with clarified category labels, preserving all other words exactly."},
                {"role": "user", "content": rewrite_prompt}
            ],
            temperature=0,
            max_completion_tokens=200
        )

        rewritten_query = response.choices[0].message.content.strip()
        rewritten_query = rewritten_query.replace("```", "").strip()
        if not rewritten_query:
            raise ValueError("Empty rewritten query from LLM")

        print(f"[Name Clarifier] Rewritten query: {rewritten_query}")

    except Exception as e:
        print(f"[Name Clarifier] Error rewriting query via LLM: {str(e)}")
        rewritten_query = original_query
        print(f"[Name Clarifier] Rewriting failed; preserving original query: {rewritten_query}")

    return {
        "success": True,
        "original_query": original_query,
        "rewritten_query": rewritten_query,
        "clarifications": replacements
    }


async def handle_multiple_names_clarification(original_query: str, clarifications: list):
    """
    At least one name has multiple matches - ask user for clarification.
    Only shows names with multiple matches (skips confirmed single matches).
    Uses LLM to filter out irrelevant matches before showing to user.
    
    Args:
        original_query: User's original question
        clarifications: List of clarification results (some with multiple matches)
    
    Returns:
        dict: Clarification request with only relevant matches listed
    """
    
    azure_client, azureopenai = get_azure_chat_openai()
    
    # First, ask LLM to filter irrelevant matches
    filtering_prompt = f"""
    User query: {original_query}
    
    We found multiple matches for names in the query. Filter out ONLY the truly irrelevant matches.
    
    Guidelines:
    - Remove matches where the name is phonetically similar but actually different (e.g., "Bryan" is NOT "Brian")
    - If user searched for "Sky Testing", keep only "Sky Testing" matches
    - Remove matches that are phonetically similar but semantically different (e.g., "Shaw Pipeline Services" is NOT relevant for "Sky Testing")
    - Keep variations of the same name (e.g., "Wayne Griffiths" and "Wayne Griffiths Jr" are both relevant)
    - For company names: be strict - only keep exact or very close matches
    - For person names: keep only if the names are actually the same person (e.g., "Brian" vs "Bryan" are different people)
    - Be strict with phonetic matches - SOUNDEX can match different names, so verify they're actually the same
    
    Here are the matches found:
    {json.dumps(clarifications, indent=2)}
    
    Return a JSON object with the same structure, but with irrelevant matches removed from the "matches" arrays.
    Only modify the "matches" arrays - keep everything else the same.
    
    Return ONLY the filtered JSON array (not wrapped in any object), no explanation.
    The response must be a JSON array of objects like: [{{"original_name": "...", "matches": [...]}}, ...]
    """
    
    try:
        filter_response = azure_client.chat.completions.create(
            model=azureopenai,
            messages=[
                {"role": "system", "content": "You filter irrelevant name matches. Be strict about phonetic matches - only keep if names are actually the same. Return only the filtered JSON array with the same structure as the input."},
                {"role": "user", "content": filtering_prompt}
            ],
            temperature=0,
            max_completion_tokens=1000
        )
        
        filtered_json = filter_response.choices[0].message.content.strip()
        # Remove markdown code blocks if present
        filtered_json = filtered_json.replace("```json", "").replace("```", "").strip()
        
        # Parse and validate the JSON
        filtered_clarifications = json.loads(filtered_json)
        
        # Ensure it's a list
        if not isinstance(filtered_clarifications, list):
            print(f"[Name Clarifier] Filtering returned non-list: {type(filtered_clarifications)}, using original matches")
            filtered_clarifications = clarifications
        else:
            # Validate structure
            valid_structure = True
            for item in filtered_clarifications:
                if not isinstance(item, dict) or "matches" not in item or "original_name" not in item:
                    print(f"[Name Clarifier] Invalid filtered structure in item: {item}, using original matches")
                    filtered_clarifications = clarifications
                    valid_structure = False
                    break
            
            if valid_structure:
                print(f"[Name Clarifier] Successfully filtered irrelevant matches using LLM")
        
    except Exception as e:
        print(f"[Name Clarifier] Error filtering matches: {str(e)}, using original matches")
        filtered_clarifications = clarifications
    
    # If after filtering, no ambiguity remains, try to rewrite
    # Check both: multiple different names OR single name with multiple roles
    if all(
        isinstance(item, dict) and
        len(item.get("matches", [])) == 1 and 
        len(item.get("matches", [{}])[0].get("unique_roles", [])) <= 1
        for item in filtered_clarifications
    ):
        print("[Name Clarifier] After filtering, all names have single matches in single roles - rewriting query")
        return await handle_all_single_matches(original_query, filtered_clarifications)
    
    # Format names: single matches as confirmation, multiple matches for selection
    single_match_confirmations = []
    multiple_match_items = []
    
    for item in filtered_clarifications:
        # Safety check
        if not isinstance(item, dict):
            print(f"[Name Clarifier] Skipping non-dict item: {item}")
            continue
        
        name = item.get("original_name", "")
        matches = item.get("matches", [])
        
        if len(matches) == 1:
            # Single match - show as confirmation question
            match = matches[0]
            # Use unique_roles to avoid duplication
            unique_roles = match.get("unique_roles", [])
            if len(unique_roles) > 1:
                roles = "  or  ".join(unique_roles)
                single_match_confirmations.append(
                    f"For **{name}**, you mean **{match['name']}** — {roles}, right?"
                )
            elif len(unique_roles) == 1:
                single_match_confirmations.append(
                    f"For **{name}**, you mean **{match['name']}** — {unique_roles[0]}, right?"
                )
            else:
                # Fallback if no unique_roles
                single_match_confirmations.append(
                    f"For **{name}**, you mean **{format_category_name(match['category'])} {match['name']}**, right?"
                )
        
        elif len(matches) > 1:
            # Multiple matches - show to user for selection
            match_list = []
            for i, m in enumerate(matches[:5]):  # Top 5 matches
                # Use unique_roles to avoid duplication
                unique_roles = m.get("unique_roles", [])
                if len(unique_roles) > 1:
                    roles = "  or  ".join(unique_roles)
                    match_list.append(f"  {i+1}. **{m['name']}** — {roles}")
                elif len(unique_roles) == 1:
                    match_list.append(f"  {i+1}. **{m['name']}** — {unique_roles[0]}")
                else:
                    # Fallback if no unique_roles
                    match_list.append(f"  {i+1}. **{m['name']}** — {format_category_name(m['category'])}")
            
            multiple_match_items.append(
                f"**{name}**:\n" + "\n".join(match_list)
            )
    
    # Build clarification text
    clarification_parts = []
    
    if single_match_confirmations:
        clarification_parts.append("\n".join(single_match_confirmations))
    
    if multiple_match_items:
        if single_match_confirmations:
            clarification_parts.append("\nFor the following, please select:")
        clarification_parts.append("\n\n".join(multiple_match_items))
    
    clarification_text = "\n\n".join(clarification_parts)
    
    clarification_prompt = f"""
    The user's query contains names that need confirmation or selection.
    
    Message to show:
    {clarification_text}
    
    Generate a friendly, concise message:
    - If there are single match confirmations, acknowledge them warmly
    - If there are multiple matches, ask the user to select
    - Be warm and helpful with 1-2 emojis
    - Keep it brief and conversational
    - Include the formatted content above in your response
    
    Return ONLY the clarification message text.
    """
    
    try:
        response = azure_client.chat.completions.create(
            model=azureopenai,
            messages=[
                {"role": "system", "content": "You create friendly clarification messages that confirm single matches and ask for selection on multiple matches."},
                {"role": "user", "content": clarification_prompt}
            ],
            temperature=0.7,
            max_completion_tokens=300
        )
        
        clarification_message = response.choices[0].message.content.strip()
        print(f"[Name Clarifier] Generated clarification message: {clarification_message}")
        
        return {
            "success": False,
            "needs_clarification": True,
            "clarification_message": clarification_message,
            "matches": filtered_clarifications,
            "original_query": original_query
        }
        
    except Exception as e:
        print(f"[Name Clarifier] Error generating clarification: {str(e)}")
        # Fallback
        return {
            "success": False,
            "needs_clarification": True,
            "clarification_message": f"I found multiple matches! 😊 Please select:\n\n{clarification_text}",
            "matches": filtered_clarifications,
            "original_query": original_query
        }


def format_category_name(category: str) -> str:
    """
    Format category name for display.
    Handles numbered categories (Welder1Name, ProjectSupervisor2Name, etc.)
    Keeps acronyms together (CWI, NDE, CRI, TR).
    
    Examples:
        ProjectManagerName -> Project Manager
        Welder1Name -> Welder
        ProjectSupervisor2Name -> Project Supervisor
        NDEInspectorName -> NDE Inspector
        CWIName -> CWI
        CRIInspectorName -> CRI Inspector
    """
    # Remove "Name" suffix
    display = category.replace("Name", "")
    
    # Remove numbers (1, 2, 3, 4)
    display = re.sub(r'[1-4]$', '', display)
    
    # Add spaces before capital letters, but keep consecutive capitals together (acronyms)
    # This regex adds space before a capital letter that's followed by a lowercase letter
    display = re.sub(r'([A-Z])(?=[a-z])', r' \1', display).strip()
    
    return display