import os
import re
from pathlib import Path
from typing import Optional, List
from urllib.parse import quote_plus
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from auth import verify_microsoft_token
from chat_logger import log_chat
from login_logger import log_login
from sqlalchemy import create_engine, text
from langchain_openai import ChatOpenAI
from langchain_community.utilities import SQLDatabase
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate

# -----------------------------------------------
# Load ENV
# -----------------------------------------------
env_path = Path("/data/project_documents/stockbot/.env")

load_dotenv(dotenv_path=env_path)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
API_SECRET_KEY = os.getenv("API_SECRET_KEY")

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = quote_plus(os.getenv("DB_PASSWORD"))
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

TABLE_NAME = "sap_unplanned_stock"

DB_URI = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# -----------------------------------------------
# App Setup
# -----------------------------------------------
app = FastAPI(title="Stock Chatbot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change to your frontend URL in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------
# DB + LLM
# -----------------------------------------------
db = SQLDatabase.from_uri(DB_URI, include_tables=[TABLE_NAME])
engine = create_engine(DB_URI)

llm = ChatOpenAI(
    model="gpt-4o-mini",
    api_key=OPENAI_API_KEY,
    temperature=0
)

# -----------------------------------------------
# Models
# -----------------------------------------------
class ChatRequest(BaseModel):
    question: str
    history: List[dict] = []

class ChatResponse(BaseModel):
    answer: str
    sql: Optional[str] = None
    data: Optional[List[dict]] = None
    follow_ups: List[str] = []
    month: Optional[str] = None

# -----------------------------------------------
# Security — Microsoft SSO
# All protected routes depend on verify_microsoft_token (see backend/auth.py).
# -----------------------------------------------

# -----------------------------------------------
# Helpers
# -----------------------------------------------
RENAME_MAP = {
    "plnt": "Plant",
    "plant_name": "Plant Name",
    "description": "Description",
    "total_unplanned_stock": "Unplanned Qty",
    "total_unplanned_qty": "Unplanned Qty",
    "avg_unplanned_qty": "Avg Unplanned Qty",
    "total_unplanned_value_lakhs": "Unplanned Value (Lakhs)",
    "avg_unplanned_value_lakhs": "Avg Unplanned Value (Lakhs)",
    "month_year": "Month",
    "total_stock": "Total Stock",
    "stock_value_lakhs": "Stock Value (Lakhs)",
    "mat_cat": "Material Category",
    "material": "Material",
    "region": "Region",
    "business": "Business",
}


def clean_sql(raw: str) -> str:
    raw = re.sub(r"```(?:sql)?", "", raw, flags=re.IGNORECASE)
    raw = raw.replace("`", "").strip()
    if ";" in raw:
        raw = raw[: raw.index(";")]
    return raw.strip().rstrip(";").strip()


def build_history(messages: list, max_turns: int = 6) -> str:
    if not messages:
        return "No previous conversation."
    recent = messages[-max_turns:]
    lines = []
    for m in recent:
        role = "User" if m.get("role") == "user" else "Assistant"
        content = m.get("content") or m.get("text") or ""
        sql = m.get("sql")
        if not content and m.get("table"):
            top = m["table"][:3]
            content = f"(result rows: {top})"
        if content:
            lines.append(f"{role}: {content}")
        if role == "Assistant" and sql:
            lines.append(f"  [SQL used: {sql}]")
    return "\n".join(lines) if lines else "No previous conversation."


def get_filter_values() -> str:
    with engine.connect() as conn:
        plants = pd.read_sql(text("SELECT DISTINCT plnt, MIN(plant_name) AS plant_name FROM sap_unplanned_stock GROUP BY plnt ORDER BY plnt"), conn)
        business = pd.read_sql(text("SELECT DISTINCT business, bus_type FROM sap_unplanned_stock ORDER BY business"), conn)
        mat_cats = pd.read_sql(text("SELECT DISTINCT mat_cat FROM sap_unplanned_stock ORDER BY mat_cat"), conn)

    plant_lines = [f"  {r.plnt} = {r.plant_name}" for r in plants.itertuples()]
    biz_lines = [f"  {r.business} ({r.bus_type})" for r in business.itertuples()]
    cat_lines = [f"  {r.mat_cat}" for r in mat_cats.itertuples()]

    return (
        "Plants (plnt = plant_description):\n" + "\n".join(plant_lines)
        + "\n\nBusiness units (business / bus_type):\n" + "\n".join(biz_lines)
        + "\n\nMaterial categories (mat_cat):\n" + "\n".join(cat_lines)
    )


def _sort_months(month_list):
    """Sort 'MM.YYYY' month strings chronologically."""
    return sorted(month_list, key=lambda v: pd.to_datetime(str(v), format="%m.%Y", errors="coerce") or pd.Timestamp.min)


def get_available_months() -> dict:
    with engine.connect() as conn:
        months = pd.read_sql(
            text("SELECT DISTINCT month_year FROM sap_unplanned_stock"),
            conn,
        )
    month_list = _sort_months(months["month_year"].tolist())
    latest = month_list[-1] if month_list else "unknown"
    return {"latest": latest, "all": ", ".join(str(m) for m in month_list)}


filter_list = get_filter_values()
month_info = get_available_months()

def get_current_month_str() -> str:
    """Return today's calendar month as 'MM.YYYY' (e.g. '05.2026')."""
    now = datetime.now()
    return f"{now.month:02d}.{now.year}"


# -----------------------------------------------
# Prompts
# -----------------------------------------------
sql_prompt = PromptTemplate.from_template("""
You are a MySQL expert. Given the table schema below, write ONLY a valid
MySQL SELECT query to answer the question. Output raw SQL only — no markdown,
no code fences, no explanation.

CONVERSATIONAL / GREETING HANDLING (highest priority — check this FIRST):
If the user's message is a greeting, pleasantry, or non-data small talk
(e.g. "hi", "hello", "hey", "good morning", "how are you", "what's up",
 "have you eaten", "thanks", "thank you", "who are you", "what can you do"),
do NOT query the table. Instead emit a single-row SELECT with a friendly
response that mentions inventory — never SQL. Use this exact pattern:
    SELECT '<friendly reply>' AS response
The reply MUST refer to assisting with inventory details (NOT "SQL queries").

Examples:
- "hi" / "hello" / "hey" → SELECT 'Hello! I will assist you with inventory details.' AS response
- "how are you" → SELECT 'I am doing great, thank you! I will assist you with inventory details.' AS response
- "have you eaten" / "did you eat" → SELECT 'I do not eat, but I will assist you with inventory details.' AS response
- "good morning" / "good afternoon" / "good evening" → SELECT 'Good day! I will assist you with inventory details.' AS response
- "thanks" / "thank you" → SELECT 'You are welcome! Happy to assist you with inventory details.' AS response
- "who are you" / "what can you do" → SELECT 'I am the Stock Chatbot. I will assist you with inventory details — unplanned stock, plants, businesses, regions, materials and trends.' AS response

TABLE: sap_unplanned_stock (this is the ONLY table — always use it)

AVAILABLE MONTHS in database (month_year column, format 'MM.YYYY' e.g. '04.2026'):
All months: {all_months}
Latest month in DB: {latest_month}
Current calendar month: {current_month}

MONTH MAPPING for user queries (DB uses MM.YYYY format — always zero-pad the month number):
- If user says "jan", "january" → '01.' + year (latest year if not specified)
- If user says "feb", "february" → '02.' + year
- If user says "mar", "march" → '03.' + year
- If user says "apr", "april" → '04.' + year
- If user says "may" → '05.' + year
- If user says "jun", "june" → '06.' + year
- If user says "jul", "july" → '07.' + year
- If user says "aug", "august" → '08.' + year
- If user says "sep", "september" → '09.' + year
- If user says "oct", "october" → '10.' + year
- If user says "nov", "november" → '11.' + year
- If user says "dec", "december" → '12.' + year
- DB format is always 'MM.YYYY' (zero-padded): 01.2026, 02.2026, ..., 12.2026
- "current month" or "this month" = use '{current_month}' (today's calendar month)
- "last month" or "previous month" = the month just before '{current_month}'
- "latest" or "latest data" = use '{latest_month}' (most recent month with data in DB)
- GLOBAL DEFAULT (applies to EVERY query type — top-N, sum, total, average, count, percentage, share, ranking, group-by, etc.):
    If the user does NOT mention any month, date, year, or time period, ALWAYS add WHERE month_year = '{current_month}' (today's calendar month).
    If '{current_month}' has no data, the query will correctly return 0 rows and the app shows "No data available for the selected filters."
    NEVER aggregate across all months unless the user explicitly asks for "all months", "overall", "historical", "lifetime", "month-wise", or "trend".
- COMPARE / DIFFERENCE queries: the user must name the two periods to compare. If only one period (or none) is named, compare the two most recent months in `{all_months}`. Use conditional aggregation and ALWAYS divide monetary values by 100000 and alias as *_lakhs, e.g.
    ROUND(SUM(CASE WHEN month_year = '03.2026' THEN unplanned_value ELSE 0 END)/100000, 2) AS mar_value_lakhs,
    ROUND(SUM(CASE WHEN month_year = '04.2026' THEN unplanned_value ELSE 0 END)/100000, 2) AS apr_value_lakhs,
    ROUND((SUM(CASE WHEN month_year = '04.2026' THEN unplanned_value ELSE 0 END)
         - SUM(CASE WHEN month_year = '03.2026' THEN unplanned_value ELSE 0 END))/100000, 2) AS difference_lakhs,
    ROUND((SUM(CASE WHEN month_year = '04.2026' THEN unplanned_value ELSE 0 END)
         - SUM(CASE WHEN month_year = '03.2026' THEN unplanned_value ELSE 0 END))
         * 100.0 / NULLIF(SUM(CASE WHEN month_year = '03.2026' THEN unplanned_value ELSE 0 END), 0), 2) AS change_pct
- PERCENTAGE / SHARE queries: always ROUND(..., 2) the percentage expression and alias it clearly (e.g. share_pct, change_pct). Without a month, compute share over ALL months:
    ROUND(SUM(unplanned_value) * 100.0 / NULLIF((SELECT SUM(unplanned_value) FROM sap_unplanned_stock), 0), 2) AS share_pct
  When filters are applied, the denominator must use the SAME filters as the outer query.

IMPORTANT: Convert user month names to 'MM.YYYY' format BEFORE creating WHERE clause.
Examples (NO month mentioned → filter to CURRENT MONTH '{current_month}'):
  - "top 5 plants in unplanned value" → SELECT plnt, MIN(plant_name) AS plant_name, ROUND(SUM(unplanned_value)/100000, 2) AS total_unplanned_value_lakhs, ROUND(SUM(unplanned_stock), 2) AS total_unplanned_qty WHERE month_year='{current_month}' GROUP BY plnt ORDER BY total_unplanned_value_lakhs DESC LIMIT 5
  - "total unplanned value" → SELECT ROUND(SUM(unplanned_value)/100000, 2) AS total_unplanned_value_lakhs, ROUND(SUM(unplanned_stock), 2) AS total_unplanned_qty WHERE month_year='{current_month}'
  - "average unplanned value per plant" → SELECT plnt, MIN(plant_name) AS plant_name, ROUND(AVG(unplanned_value)/100000, 2) AS avg_unplanned_value_lakhs, ROUND(AVG(unplanned_stock), 2) AS avg_unplanned_qty WHERE month_year='{current_month}' GROUP BY plnt
  - "unplanned value by region" → SELECT region, ROUND(SUM(unplanned_value)/100000, 2) AS total_unplanned_value_lakhs, ROUND(SUM(unplanned_stock), 2) AS total_unplanned_qty WHERE month_year='{current_month}' GROUP BY region ORDER BY total_unplanned_value_lakhs DESC
  - "where are we losing the most money" → WHERE month_year='{current_month}' GROUP BY plnt, include both value_lakhs and qty, ORDER BY total_unplanned_value_lakhs DESC

Examples (user explicitly asks for overall/all → NO month filter):
  - "top 5 plants in unplanned value overall" → no month filter, SUM across all months
  - "historical total unplanned value" → no month filter
  - "unplanned value trend" / "month-wise unplanned value" → GROUP BY month_year, ORDER BY STR_TO_DATE(month_year, '%m.%Y')

Examples (month mentioned → filter to that month):
  - "top plants in jan" → WHERE month_year = '01.2026'
  - "top plants in dec" → WHERE month_year = '12.2025'
  - "top plants in jan 2026" → WHERE month_year = '01.2026'
  - "top plants last month" → WHERE month_year = '{latest_month}'
  - "total unplanned value in nov" → WHERE month_year = '11.2025'

Examples (compare / difference):
  - "compare unplanned value between jan and feb" → conditional SUM for '01.2026' and '02.2026', plus difference
  - "difference in unplanned value between mar and apr 2026" → conditional SUM for '03.2026' and '04.2026', plus difference
  - "compare unplanned value month over month" (no months named) → use the two most recent months from {all_months}

FILTER + DIMENSION COMBINATIONS:
Questions can combine ANY dimension (plant, region, business, bus_type, mat_cat, material) with ANY metric (sum, avg, count, top-N, percentage, compare, difference) with or without a month filter. Apply filters via WHERE and the month rules independently:
  - Entity filters (region/business/bus_type/mat_cat/plant) ALWAYS go into WHERE when named, regardless of whether a month is named.
  - Month filter follows the GLOBAL DEFAULT above (only when a month is mentioned).
  - Match filter values case-insensitively against `{filter_list}` — e.g. "south" → region='SOUTH', "auto" → bus_type='AUTO'.
  - When the question asks "by X" or "per X", GROUP BY X (do not also filter by a single X).

Examples (filter + no month → filter applied, SUM across all months):
  - "top 5 plants in south region" → WHERE region='SOUTH' GROUP BY plnt, SUM over all months
  - "total unplanned value for auto" → WHERE bus_type='AUTO', no month filter
  - "average unplanned value per plant in ww business" → WHERE business='WW' GROUP BY plnt, AVG
  - "unplanned value by region for emce" → WHERE bus_type='EMCE' GROUP BY region
  - "share of each region in rm category" → WHERE mat_cat='RM' GROUP BY region with share_pct over the filtered total
  - "top materials in plant W001" → WHERE plnt='W001' GROUP BY material (use unique_id rule)

Examples (filter + month → both filters in WHERE):
  - "top 5 plants in south in jan" → WHERE region='SOUTH' AND month_year='01.2026'
  - "total unplanned value for auto in mar" → WHERE bus_type='AUTO' AND month_year='03.2026'
  - "unplanned value by business in jan 2026" → WHERE month_year='01.2026' GROUP BY business

Examples (filter + compare/difference):
  - "compare unplanned value for auto between jan and feb" → WHERE bus_type='AUTO', conditional SUM per month
  - "difference in unplanned value in south between mar and apr" → WHERE region='SOUTH', conditional SUM per month
  - "compare regions in apr" → WHERE month_year='04.2026' GROUP BY region (shows each region's value for apr)

Examples (filter + percentage):
  - "what percentage of auto unplanned value is from south" → numerator WHERE region='SOUTH' AND bus_type='AUTO', denominator WHERE bus_type='AUTO', no month filter
  - "share of each plant in ww business in apr" → WHERE business='WW' AND month_year='04.2026' GROUP BY plnt with share over that filtered total

BUSINESS CODE RECOGNITION (CRITICAL):
Short codes like CV, LP, TR, CAW, EM, WW, WH, AFM, JSR, FAB, SPDR, LAS, etc. are `business` column values.
Whenever the user mentions one of these codes — with or without the word "business" — ALWAYS map it to WHERE business='<CODE>' (uppercase).
Do NOT fall back to bus_type or other columns for these codes. They are exact business column values in {filter_list}.
IMPORTANT: LP, WW, EM, TR are BUSINESS codes. They are NOT bus_type (which is only AUTO or EMCE).
Examples:
  - "cv plant wise in jan" → WHERE business='CV' AND month_year='01.2026' GROUP BY plnt
  - "lp plant wise" → WHERE business='LP' AND month_year='{current_month}' GROUP BY plnt
  - "caw plant wise in jan" → WHERE business='CAW' AND month_year='01.2026' GROUP BY plnt
  - "tr plant wise in jan" → WHERE business='TR' AND month_year='01.2026' GROUP BY plnt
  - "em top 5 materials" → WHERE business='EM' AND month_year='{current_month}' GROUP BY material
  - "ww unplanned value by region" → WHERE business='WW' GROUP BY region
  - "top 25 items in lp" → WHERE business='LP' (NOT bus_type='LP')
  - "top 25 items in lp of fg in feb" → WHERE business='LP' AND mat_cat='FG' AND month_year='02.2026'

KEYWORD RESOLUTION ORDER — when the user mentions any keyword <X>:
  1. FIRST: Check if <X> (uppercase) matches a `business` value in {filter_list} → WHERE business='<X>'
     (Common business codes: CV, LP, TR, CAW, EM, WW, WH, AFM, JSR, FAB, SPDR, LAS, etc.)
  2. If not: check if <X> matches a `bus_type` (AUTO/EMCE) → WHERE bus_type='<X>'
  3. If not: check if <X> matches a `region` → WHERE region='<X>'
  4. If not: check if <X> matches a `mat_cat` → WHERE mat_cat='<X>'
  5. LAST RESORT: if <X> is not found in any column above, treat it as a plant_name substring → WHERE plant_name LIKE '%<X>%'
DO NOT use bus_type for business codes like LP, WW, EM, TR, CV, CAW, etc.

MATERIAL IDENTIFIER MATCHING (CRITICAL):
A user-supplied "material" reference can be EITHER a material code (matches the `material` column exactly) OR a free-text description (matches the `description` column as a substring). You CANNOT tell which one it is up front — so ALWAYS match against BOTH columns with OR.
Pattern (use this verbatim, escape single quotes by doubling them):
    WHERE (material = '<X>' OR description LIKE '%<X>%')
This applies whenever the user names a specific material/part. Always wrap the OR clause in parentheses so other AND filters compose correctly.
Examples:
  - "TLP2180-CB000L01 material month wise" →
      SELECT month_year AS month, material, MIN(description) AS description,
             ROUND(SUM(unplanned_value)/100000, 2) AS total_unplanned_value_lakhs,
             ROUND(SUM(unplanned_stock), 2) AS total_unplanned_qty
      FROM sap_unplanned_stock
      WHERE (material = 'TLP2180-CB000L01' OR description LIKE '%TLP2180-CB000L01%')
      GROUP BY month_year, material
      ORDER BY STR_TO_DATE(month_year, '%m.%Y')
  - "2.6 X 1330 HRPO WIR005 material month wise" →
      WHERE (material = '2.6 X 1330 HRPO WIR005' OR description LIKE '%2.6 X 1330 HRPO WIR005%')
      GROUP BY month_year, material
  - "HINDALCO FOR A356.2 INGOT ALUMINIUM month wise" →
      WHERE (material = 'HINDALCO FOR A356.2 INGOT ALUMINIUM' OR description LIKE '%HINDALCO FOR A356.2 INGOT ALUMINIUM%')
      GROUP BY month_year, material
  - "value of TLP2180-CB000L01 in jan" →
      WHERE (material = 'TLP2180-CB000L01' OR description LIKE '%TLP2180-CB000L01%') AND month_year='01.2026'
NOTE: For "month wise" / "month-wise" queries on a specific material, do NOT apply the current-month default — group by month_year and order chronologically across ALL months.

UNIT / DIVISION KEYWORDS (EEPD, FAB, SPDR, LAS, HYD, PADI, RAMPUR, PUNE, etc.):
These appear as SUBSTRINGS inside `plant_name` and are NOT business codes.
Only use plant_name LIKE when the keyword does NOT match any business/bus_type/region/mat_cat value.
Examples:
  - "top 10 materials in sfg of eepd unit" → WHERE mat_cat='SFG' AND plant_name LIKE '%EEPD%' GROUP BY material
  - "unplanned value in fab division" → WHERE plant_name LIKE '%FAB%'
  - "top plants in hyd unit" → WHERE plant_name LIKE '%HYD%' GROUP BY plnt
  - "rm materials in padi" → WHERE mat_cat='RM' AND plant_name LIKE '%Padi%'

VALID FILTER VALUES:
{filter_list}

COLUMNS:
- material        : unique part/material number (VARCHAR)
- description     : part description — use MIN(description) when grouping
- plnt            : plant code (e.g. W001)
- plant_name      : full plant name / plant description (already in DB, no mapping needed)
- base_uom        : base unit of measure (e.g. MT, EA, KG)
- total_stock     : total stock quantity (DECIMAL)
- stock_value     : total stock value in INR (DECIMAL)
- requirement_qty : requirement quantity (DECIMAL)
- requirement_value : requirement value in INR (DECIMAL)
- unplanned_stock : unplanned stock quantity (DECIMAL)
- unplanned_value : unplanned stock value in INR (DECIMAL)
- mat_cat         : material category (RM, FG, SFG, etc.)
- mtyp            : material type code (e.g. ROH, ZHAL)
- matl_group      : material group
- profit_ctr      : profit center
- area            : area
- business        : business unit (e.g. WW, EM)
- bus_type        : AUTO or EMCE
- region          : region (e.g. SOUTH, NORTH)
- month_year      : reporting period (e.g. 'JAN 2026', 'APR 2026') — format is MMM YYYY
- unique_id       : grouping key for parts

AGGREGATION RULES:
1. Part grouping: CASE WHEN unique_id = 0 THEN material ELSE CAST(unique_id AS CHAR) END
2. ALL monetary values must be divided by 100000 and aliased as *_lakhs.
   Example: ROUND(SUM(unplanned_value) / 100000, 2) AS total_unplanned_value_lakhs
3. Always include plnt and MIN(plant_name) in part-level output.
4. ALWAYS INCLUDE BOTH VALUE AND QUANTITY: Whenever a query involves unplanned data, ALWAYS select BOTH:
   - ROUND(SUM(unplanned_value) / 100000, 2) AS total_unplanned_value_lakhs
   - ROUND(SUM(unplanned_stock), 2) AS total_unplanned_qty
   This applies to ALL unplanned queries: top-N, total, average, by-region, by-business, by-plant, etc.
   The only exceptions are percentage/share queries (where only the ratio matters) and compare/difference queries (include both value and qty columns for each period).
5. TOP N PLANTS pattern:
   SELECT plnt, MIN(plant_name) AS plant_name,
          ROUND(SUM(unplanned_value) / 100000, 2) AS total_unplanned_value_lakhs,
          ROUND(SUM(unplanned_stock), 2) AS total_unplanned_qty
   FROM sap_unplanned_stock
   WHERE month_year='{current_month}'
   GROUP BY plnt ORDER BY total_unplanned_value_lakhs DESC LIMIT N;
6. Use HAVING (not WHERE) to filter on aggregated values.

SORTING (MANDATORY):
- Every SELECT that returns multiple rows MUST have ORDER BY the primary metric DESC.
- For "best performing" / "lowest" / "least" / "bottom" queries, ORDER BY the metric ASC.
- Never return unsorted results.

BUSINESS LANGUAGE UNDERSTANDING — map natural phrases to metrics:
- "losing the most money" / "biggest loss" / "where is money stuck" / "highest unplanned" → ORDER BY SUM(unplanned_value) DESC
- "performing badly" / "worst plant" / "problem plants" / "underperforming" → ORDER BY SUM(unplanned_value) DESC
- "best performing" / "healthiest" / "efficient" → ORDER BY SUM(unplanned_value) ASC
- "money stuck" / "blocked stock" / "slow moving" / "dead stock" → unplanned_value
- "inventory" / "stock held" → unplanned_stock (quantity) or total_stock

DRILL-DOWN HIERARCHY: Plant → Unit → Business → Category → Material
- Unit = plant_name substring (EEPD, FAB, SPDR, etc.)
- If the user says "break it down by X" / "show by X" / "split by X", GROUP BY X while preserving any filters from the previous question.
- "details for that plant" / "that plant" / "same plant" → reuse the top plnt from the previous result.
- "which material is causing this" → GROUP BY material with the previous filters, ORDER BY metric DESC.

ADD / INCLUDE COLUMN FOLLOW-UPS (CRITICAL):
When the user says "add X", "include X", "also show X", "with X", "X also", "add X to the table", "X in the above", "X in above table", etc., this means:
  1. KEEP ALL FILTERS from the previous turn (business, bus_type, region, mat_cat, plant, month, LIMIT, ORDER BY).
  2. KEEP the original grouping dimension from the previous turn.
  3. ADD the requested dimension as an ADDITIONAL column in SELECT and GROUP BY.
  4. The result should be the SAME query as before, just with more columns / finer grouping.
Examples:
- Previous: "tr material top 25 in fg" → WHERE business='TR' AND mat_cat='FG' AND month_year='{current_month}' GROUP BY material ORDER BY total_unplanned_value_lakhs DESC LIMIT 25
  Follow-up: "add plants in the above table" → SELECT plnt, MIN(plant_name) AS plant_name, material, MIN(description) AS description, ROUND(SUM(unplanned_value)/100000, 2) AS total_unplanned_value_lakhs, ROUND(SUM(unplanned_stock), 2) AS total_unplanned_qty FROM sap_unplanned_stock WHERE business='TR' AND mat_cat='FG' AND month_year='{current_month}' GROUP BY plnt, material ORDER BY total_unplanned_value_lakhs DESC LIMIT 25
- Previous: "top 10 plants in auto" → GROUP BY plnt, WHERE bus_type='AUTO' ... LIMIT 10
  Follow-up: "add region" → SELECT plnt, MIN(plant_name), region, ROUND(SUM(unplanned_value)/100000, 2) AS total_unplanned_value_lakhs, ROUND(SUM(unplanned_stock), 2) AS total_unplanned_qty WHERE bus_type='AUTO' AND month_year='{current_month}' GROUP BY plnt, region ORDER BY total_unplanned_value_lakhs DESC LIMIT 10
- Previous: "top 5 regions in jan" → GROUP BY region, WHERE month_year='01.2026' ... LIMIT 5
  Follow-up: "include business" → SELECT region, business, ROUND(SUM(unplanned_value)/100000, 2) AS total_unplanned_value_lakhs, ROUND(SUM(unplanned_stock), 2) AS total_unplanned_qty WHERE month_year='01.2026' GROUP BY region, business ORDER BY total_unplanned_value_lakhs DESC LIMIT 5
NEVER drop the previous filters when the user says "add" / "include" / "also". Always preserve business, bus_type, region, mat_cat, plant, month, and LIMIT.
CRITICAL: When preserving filters from a previous query, COPY THE EXACT WHERE CLAUSE verbatim — same column names, same values. Do NOT reinterpret the filter.
  - If the previous SQL had `WHERE business='TR'`, the follow-up must also use `business='TR'` (NOT `bus_type='TR'`).
  - If the previous SQL had `WHERE bus_type='AUTO'`, the follow-up must also use `bus_type='AUTO'` (NOT `business='AUTO'`).
  - Look at the previous SQL in {history} and copy its WHERE clause columns exactly.

CONTEXT AWARENESS — use {history} to resolve pronouns and follow-ups:
- "that", "this", "those", "same", "it" → refer to the primary entity from the previous Assistant result (e.g. the top plant, month, business just shown).
- "the above table" / "that table" / "previous result" / "above result" → refer to the filters and grouping of the previous SQL query — preserve them all.
- "break it by unit" after a plants query → GROUP BY plant_name LIKE patterns OR keep the top plants filter and group by unit keywords.
- Keep filters consistent with the previous turn unless the user changes them.
- If the previous turn filtered a month, keep that month unless the user names a different one.
- If the previous turn used a LIMIT, keep that same LIMIT on the follow-up unless the user changes it.

Previous Conversation: {history}

Current Question: {question}

SQL Query:
""")

answer_prompt = PromptTemplate.from_template("""
You are a helpful assistant for unplanned stock data.

User Question : {question}
SQL Query Used: {query}
SQL Result    : {result}

Give a short, clear, friendly answer based on the result.
Present top-N results as a numbered list showing plant, description, stock quantity, and value in Lakhs.
Always label monetary values with "X.XX Lakhs".
If the result is empty, say "No data found."
""")

sql_chain = sql_prompt | llm | StrOutputParser()

followup_prompt = PromptTemplate.from_template("""
You suggest exactly TWO short follow-up questions a business user might ask next,
based on the question just answered and the top result rows.

CRITICAL RULES:
- This is a DATA-ONLY system. It can ONLY run SQL queries and return numbers/tables.
- It CANNOT explain reasons, give analysis, describe causes, or provide text-based insights.
- Every follow-up question MUST be answerable by a SQL query returning numbers or a table.
- NEVER suggest questions like "Why...", "What is the reason...", "Explain...", "State the cause...", "What factors..."
- ALWAYS suggest questions that ask for data: top-N, totals, breakdowns, comparisons, trends, percentages.

Good examples: "Top 5 materials in that plant?", "Compare with last month?", "Break it down by category?"
Bad examples: "Why is unplanned value high?", "What is causing the increase?", "Explain the trend"

Format:
- Output ONLY two lines, one question per line. No numbering, no bullets, no preamble.
- Each question must be <= 12 words, natural business language.
- Suggest logical drill-downs (unit / business / category / material breakdown) or comparisons
  (vs previous month, month-wise trend, share of total).
- Never repeat the user's question.

Previous Conversation:
{history}

User Question: {question}
Top Rows (first 5): {top_rows}

Two follow-up questions:
""")
followup_chain = followup_prompt | llm | StrOutputParser()


def generate_follow_ups(question: str, history: str, top_rows: list) -> list:
    try:
        raw = followup_chain.invoke({
            "question": question,
            "history": history,
            "top_rows": str(top_rows[:5]),
        })
        lines = [ln.strip(" -\u2022*0123456789.").strip() for ln in raw.splitlines() if ln.strip()]
        return [ln for ln in lines if ln][:2]
    except Exception:
        return []


# -----------------------------------------------
# API Route
# -----------------------------------------------
@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, claims: dict = Depends(verify_microsoft_token)):

    history = build_history(req.history)

    try:
        # Generate SQL
        raw_sql = sql_chain.invoke({
            "question": req.question,
            "history": history,
            "filter_list": filter_list,
            "latest_month": month_info["latest"],
            "all_months": month_info["all"],
            "current_month": get_current_month_str(),
        })

        sql_query = clean_sql(raw_sql)

        # Safety check
        forbidden = ["drop", "delete", "truncate", "update", "insert", "alter"]
        if any(word in sql_query.lower().split() for word in forbidden):
            log_chat(claims, req.question, "blocked")
            return ChatResponse(answer="Sorry, I can only run SELECT queries for safety.")

        if not sql_query.lower().startswith("select"):
            log_chat(claims, req.question, "invalid_sql")
            return ChatResponse(answer="Sorry, I could not generate a valid query for that question.")

        # Strip any trailing semicolon/whitespace before appending LIMIT
        sql_query = sql_query.rstrip().rstrip(";").rstrip()

        # Add LIMIT safety (default to 50 if not specified as a top-level LIMIT)
        if not re.search(r"\blimit\s+\d+\s*$", sql_query, re.IGNORECASE):
            sql_query += " LIMIT 50"

        # Extract month(s) used in the query for display
        month_matches = re.findall(r"month_year\s*=\s*'([^']+)'", sql_query, re.IGNORECASE)
        if month_matches:
            used_month = ", ".join(dict.fromkeys(month_matches))  # dedupe, preserve order
        else:
            used_month = "All Months"

        # Execute
        with engine.connect() as conn:
            df = pd.read_sql(text(sql_query), conn)

        # Rename columns for readability
        df.rename(columns={c: RENAME_MAP[c] for c in df.columns if c in RENAME_MAP}, inplace=True)

        # Format numeric columns for display (monetary, percentage, difference, etc.)
        numeric_keywords = ("value", "lakhs", "pct", "percent", "share", "difference", "change", "ratio", "avg", "average", "total", "qty", "quantity", "stock")
        for col in df.columns:
            if any(kw in col.lower() for kw in numeric_keywords):
                df[col] = df[col].apply(lambda x: round(float(x), 2) if pd.notnull(x) else x)

        data = df.to_dict(orient="records")
        row_count = len(data)
        if row_count == 0:
            log_chat(claims, req.question, "no_data")
            return ChatResponse(
                answer="No data available for the selected filters.",
                sql=sql_query,
                data=[],
                follow_ups=[],
                month=used_month,
            )
        log_chat(claims, req.question, "success")
        return ChatResponse(
            answer=f"{row_count} result{'s' if row_count != 1 else ''} found.",
            sql=sql_query,
            data=data,
            follow_ups=[],
            month=used_month,
        )
    except Exception as e:
        log_chat(claims, req.question, "error")
        return ChatResponse(
            answer=f"Sorry, I encountered an error processing your question. Please try rephrasing it.\n\nError: {str(e)[:200]}"
        )

# -----------------------------------------------
# Dashboard API Endpoints
# -----------------------------------------------
@app.get("/api/current-month")
def get_current_month(claims: dict = Depends(verify_microsoft_token)):
    """Return the current calendar month in 'MMM YYYY' format."""
    return {"month": get_current_month_str()}


@app.get("/api/months")
def get_months(claims: dict = Depends(verify_microsoft_token)):
    """Return available months for the dropdown, sorted chronologically (oldest → newest)."""
    with engine.connect() as conn:
        df = pd.read_sql(text(
            "SELECT DISTINCT month_year FROM sap_unplanned_stock"
        ), conn)
    return _sort_months(df["month_year"].tolist())


@app.get("/api/summary")
def get_summary(month: str, claims: dict = Depends(verify_microsoft_token)):
    """4-segment breakdown: MRP (planned) / NON-MRP (unplanned) × AUTO/EMCE. MRP = stock_value - unplanned_value."""
    with engine.connect() as conn:
        df = pd.read_sql(text(
            "SELECT "
            "  ROUND(SUM(CASE WHEN bus_type='AUTO' THEN GREATEST(stock_value - unplanned_value, 0) ELSE 0 END)/100000, 2) AS mrp_auto, "
            "  ROUND(SUM(CASE WHEN bus_type='EMCE' THEN GREATEST(stock_value - unplanned_value, 0) ELSE 0 END)/100000, 2) AS mrp_nonAuto, "
            "  ROUND(SUM(CASE WHEN bus_type='AUTO' THEN unplanned_value ELSE 0 END)/100000, 2) AS non_mrp_auto, "
            "  ROUND(SUM(CASE WHEN bus_type='EMCE' THEN unplanned_value ELSE 0 END)/100000, 2) AS non_mrp_nonAuto, "
            "  ROUND(SUM(stock_value)/100000, 2) AS total_stock "
            "FROM sap_unplanned_stock WHERE month_year = :m AND bus_type IN ('AUTO','EMCE')"
        ), conn, params={"m": month})
    row = df.iloc[0]
    return {
        "mrp_auto":       float(row["mrp_auto"]),
        "mrp_nonAuto":    float(row["mrp_nonAuto"]),
        "non_mrp_auto":   float(row["non_mrp_auto"]),
        "non_mrp_nonAuto":float(row["non_mrp_nonAuto"]),
        "total_stock":    float(row["total_stock"]),
    }


@app.get("/api/businesses")
def get_businesses(month: str, bus_type: str = "ALL", claims: dict = Depends(verify_microsoft_token)):
    """Business-wise NON-MRP (unplanned) and MRP (total stock) values. bus_type = ALL | AUTO | EMCE."""
    where = "WHERE month_year = :m"
    if bus_type != "ALL":
        where += " AND bus_type = :bt"

    q = (
        f"SELECT business AS name, "
        f"  ROUND(SUM(CASE WHEN bus_type='AUTO' THEN unplanned_value ELSE 0 END)/100000, 2) AS auto, "
        f"  ROUND(SUM(CASE WHEN bus_type='EMCE' THEN unplanned_value ELSE 0 END)/100000, 2) AS nonAuto, "
        f"  ROUND(SUM(unplanned_value)/100000, 2) AS value, "
        f"  ROUND(SUM(CASE WHEN bus_type='AUTO' THEN GREATEST(stock_value - unplanned_value, 0) ELSE 0 END)/100000, 2) AS mrp_auto, "
        f"  ROUND(SUM(CASE WHEN bus_type='EMCE' THEN GREATEST(stock_value - unplanned_value, 0) ELSE 0 END)/100000, 2) AS mrp_nonAuto, "
        f"  ROUND(SUM(GREATEST(stock_value - unplanned_value, 0))/100000, 2) AS mrp_value "
        f"FROM sap_unplanned_stock {where} AND business != '' "
        f"GROUP BY business ORDER BY value DESC"
    )

    with engine.connect() as conn:
        df = pd.read_sql(text(q), conn, params={"m": month, "bt": bus_type})

    rows = []
    for _, r in df.iterrows():
        row = {
            "name": r["name"],
            "auto": float(r["auto"]),
            "nonAuto": float(r["nonAuto"]),
            "value": float(r["value"]),
            "mrp_value": float(r["mrp_value"]),
        }
        if bus_type == "AUTO":
            row["value"] = row["auto"]
            row["mrp_value"] = float(r["mrp_auto"])
        elif bus_type == "EMCE":
            row["value"] = row["nonAuto"]
            row["mrp_value"] = float(r["mrp_nonAuto"])
        if row["value"] > 0 or row["mrp_value"] > 0:
            rows.append(row)
    return rows


@app.get("/api/regions")
def get_regions(month: str, claims: dict = Depends(verify_microsoft_token)):
    """Region-wise AUTO/EMCE split for the region bar chart."""
    with engine.connect() as conn:
        df = pd.read_sql(text(
            "SELECT region AS name, "
            "  ROUND(SUM(CASE WHEN bus_type='AUTO' THEN unplanned_value ELSE 0 END)/100000, 2) AS auto, "
            "  ROUND(SUM(CASE WHEN bus_type='EMCE' THEN unplanned_value ELSE 0 END)/100000, 2) AS nonAuto, "
            "  ROUND(SUM(unplanned_value)/100000, 2) AS value, "
            "  ROUND(SUM(CASE WHEN bus_type='AUTO' THEN GREATEST(stock_value - unplanned_value, 0) ELSE 0 END)/100000, 2) AS mrp_auto, "
            "  ROUND(SUM(CASE WHEN bus_type='EMCE' THEN GREATEST(stock_value - unplanned_value, 0) ELSE 0 END)/100000, 2) AS mrp_nonAuto, "
            "  ROUND(SUM(GREATEST(stock_value - unplanned_value, 0))/100000, 2) AS mrp_value "
            "FROM sap_unplanned_stock WHERE month_year = :m AND region != '' "
            "GROUP BY region ORDER BY value DESC"
        ), conn, params={"m": month})
    return df.to_dict(orient="records")


@app.get("/api/material-categories")
def get_material_categories(month: str, claims: dict = Depends(verify_microsoft_token)):
    """Overall mat_cat breakdown with NON-MRP (unplanned) and MRP (total stock) values."""
    with engine.connect() as conn:
        df = pd.read_sql(text(
            "SELECT mat_cat AS name, "
            "  ROUND(SUM(unplanned_value)/100000, 2) AS value, "
            "  ROUND(SUM(GREATEST(stock_value - unplanned_value, 0))/100000, 2) AS mrp_value "
            "FROM sap_unplanned_stock "
            "WHERE month_year = :m AND mat_cat != '' "
            "GROUP BY mat_cat "
            "ORDER BY FIELD(mat_cat, 'RM', 'PS', 'SFG', 'FG') = 0, "
            "         FIELD(mat_cat, 'RM', 'PS', 'SFG', 'FG'), mat_cat"
        ), conn, params={"m": month})
    return df.to_dict(orient="records")


@app.get("/api/business-categories")
def get_business_categories(month: str, business: str, claims: dict = Depends(verify_microsoft_token)):
    """mat_cat breakdown for a business with NON-MRP and MRP values."""
    with engine.connect() as conn:
        df = pd.read_sql(text(
            "SELECT mat_cat AS name, "
            "  ROUND(SUM(unplanned_value)/100000, 2) AS value, "
            "  ROUND(SUM(GREATEST(stock_value - unplanned_value, 0))/100000, 2) AS mrp_value "
            "FROM sap_unplanned_stock "
            "WHERE month_year = :m AND business = :b AND mat_cat != '' "
            "GROUP BY mat_cat "
            "ORDER BY FIELD(mat_cat, 'RM', 'PS', 'SFG', 'FG') = 0, "
            "         FIELD(mat_cat, 'RM', 'PS', 'SFG', 'FG'), mat_cat"
        ), conn, params={"m": month, "b": business})
    return df.to_dict(orient="records")


@app.get("/api/bus-type-categories")
def get_bus_type_categories(month: str, bus_type: str, claims: dict = Depends(verify_microsoft_token)):
    """mat_cat breakdown for AUTO or EMCE with NON-MRP and MRP values."""
    with engine.connect() as conn:
        df = pd.read_sql(text(
            "SELECT mat_cat AS name, "
            "  ROUND(SUM(unplanned_value)/100000, 2) AS value, "
            "  ROUND(SUM(GREATEST(stock_value - unplanned_value, 0))/100000, 2) AS mrp_value "
            "FROM sap_unplanned_stock "
            "WHERE month_year = :m AND bus_type = :bt AND mat_cat != '' "
            "GROUP BY mat_cat "
            "ORDER BY FIELD(mat_cat, 'RM', 'PS', 'SFG', 'FG') = 0, "
            "         FIELD(mat_cat, 'RM', 'PS', 'SFG', 'FG'), mat_cat"
        ), conn, params={"m": month, "bt": bus_type})
    return df.to_dict(orient="records")


@app.get("/api/bus-type-material-drilldown")
def get_bus_type_material_drilldown(month: str, bus_type: str, mat_cat: str, claims: dict = Depends(verify_microsoft_token)):
    """Top 25 materials for bus_type + mat_cat — includes business and plant_name."""
    with engine.connect() as conn:
        df = pd.read_sql(text(
            "SELECT material, MIN(description) AS description, "
            "  MIN(business) AS business, MIN(plant_name) AS plant_name, "
            "  ROUND(SUM(unplanned_value)/100000, 2) AS unplanned_value_lakhs, "
            "  ROUND(SUM(GREATEST(stock_value - unplanned_value, 0))/100000, 2) AS stock_value_lakhs, "
            "  ROUND(SUM(unplanned_stock), 2) AS unplanned_qty "
            "FROM sap_unplanned_stock "
            "WHERE month_year = :m AND bus_type = :bt AND mat_cat = :c "
            "GROUP BY material "
            "HAVING unplanned_value_lakhs > 0 "
            "ORDER BY unplanned_value_lakhs DESC LIMIT 25"
        ), conn, params={"m": month, "bt": bus_type, "c": mat_cat})
    return df.to_dict(orient="records")


@app.get("/api/category-material-drilldown")
def get_category_material_drilldown(month: str, mat_cat: str, claims: dict = Depends(verify_microsoft_token)):
    """Top 25 materials for an overall mat_cat — includes plant_name."""
    with engine.connect() as conn:
        df = pd.read_sql(text(
            "SELECT material, MIN(description) AS description, MIN(plant_name) AS plant_name, "
            "  ROUND(SUM(unplanned_value)/100000, 2) AS unplanned_value_lakhs, "
            "  ROUND(SUM(GREATEST(stock_value - unplanned_value, 0))/100000, 2) AS stock_value_lakhs, "
            "  ROUND(SUM(unplanned_stock), 2) AS unplanned_qty "
            "FROM sap_unplanned_stock "
            "WHERE month_year = :m AND mat_cat = :c "
            "GROUP BY material "
            "HAVING unplanned_value_lakhs > 0 "
            "ORDER BY unplanned_value_lakhs DESC LIMIT 25"
        ), conn, params={"m": month, "c": mat_cat})
    return df.to_dict(orient="records")


@app.get("/api/business-material-drilldown")
def get_business_material_drilldown(month: str, business: str, mat_cat: str, claims: dict = Depends(verify_microsoft_token)):
    """Top 25 materials for a business + category across all plants — includes plant_name."""
    with engine.connect() as conn:
        df = pd.read_sql(text(
            "SELECT material, MIN(description) AS description, MIN(plant_name) AS plant_name, "
            "  ROUND(SUM(unplanned_value)/100000, 2) AS unplanned_value_lakhs, "
            "  ROUND(SUM(GREATEST(stock_value - unplanned_value, 0))/100000, 2) AS stock_value_lakhs, "
            "  ROUND(SUM(unplanned_stock), 2) AS unplanned_qty "
            "FROM sap_unplanned_stock "
            "WHERE month_year = :m AND business = :b AND mat_cat = :c "
            "GROUP BY material "
            "HAVING unplanned_value_lakhs > 0 "
            "ORDER BY unplanned_value_lakhs DESC LIMIT 25"
        ), conn, params={"m": month, "b": business, "c": mat_cat})
    return df.to_dict(orient="records")


@app.get("/api/trend")
def get_trend(bus_type: str = "ALL", claims: dict = Depends(verify_microsoft_token)):
    """Per-business monthly trend — both MRP and NON-MRP values per business."""
    bt_filter = ""
    if bus_type == "AUTO":
        bt_filter = "AND bus_type = 'AUTO'"
    elif bus_type == "EMCE":
        bt_filter = "AND bus_type = 'EMCE'"

    q = (
        f"SELECT month_year, business, "
        f"  ROUND(SUM(unplanned_value)/100000, 2) AS non_mrp, "
        f"  ROUND(SUM(GREATEST(stock_value - unplanned_value, 0))/100000, 2) AS mrp "
        f"FROM sap_unplanned_stock "
        f"WHERE business != '' {bt_filter} "
        f"GROUP BY month_year, business "
        f"ORDER BY STR_TO_DATE(month_year, '%m.%Y')"
    )

    with engine.connect() as conn:
        df = pd.read_sql(text(q), conn)

    months_raw = df["month_year"].unique().tolist()
    months = _sort_months(months_raw)
    result = []
    for m in months:
        row = {"month": str(m)}
        subset = df[df["month_year"] == m]
        for _, r in subset.iterrows():
            biz = r["business"]
            row[f"{biz}_MRP"] = float(r["mrp"])
            row[f"{biz}_NonMRP"] = float(r["non_mrp"])
        result.append(row)
    return result


@app.get("/api/plant-trend")
def get_plant_trend(top: int = 10, claims: dict = Depends(verify_microsoft_token)):
    """Per-plant monthly trend — top N plants by total NON-MRP value, both MRP and NON-MRP."""
    with engine.connect() as conn:
        top_df = pd.read_sql(text(
            "SELECT plnt, MIN(plant_name) AS plant_name "
            "FROM sap_unplanned_stock "
            "GROUP BY plnt "
            "ORDER BY SUM(unplanned_value) DESC "
            "LIMIT :top"
        ), conn, params={"top": top})

        if top_df.empty:
            return {"trend": [], "names": {}}

        top_codes = top_df["plnt"].tolist()
        name_map = dict(zip(top_df["plnt"], top_df["plant_name"]))
        placeholders = ",".join([f":p{i}" for i in range(len(top_codes))])
        params = {f"p{i}": code for i, code in enumerate(top_codes)}

        df = pd.read_sql(text(
            f"SELECT month_year, plnt, "
            f"  ROUND(SUM(unplanned_value)/100000, 2) AS non_mrp, "
            f"  ROUND(SUM(GREATEST(stock_value - unplanned_value, 0))/100000, 2) AS mrp "
            f"FROM sap_unplanned_stock "
            f"WHERE plnt IN ({placeholders}) "
            f"GROUP BY month_year, plnt "
            f"ORDER BY STR_TO_DATE(month_year, '%m.%Y')"
        ), conn, params=params)

    months = _sort_months(df["month_year"].unique().tolist())
    trend = []
    for m in months:
        row = {"month": str(m)}
        subset = df[df["month_year"] == m]
        for _, r in subset.iterrows():
            plnt = r["plnt"]
            row[f"{plnt}_MRP"] = float(r["mrp"])
            row[f"{plnt}_NonMRP"] = float(r["non_mrp"])
        trend.append(row)
    return {"trend": trend, "names": name_map}


@app.get("/api/drilldown")
def get_drilldown(month: str, business: str, claims: dict = Depends(verify_microsoft_token)):
    """Plant-level drilldown for a specific business with NON-MRP and MRP values."""
    with engine.connect() as conn:
        df = pd.read_sql(text(
            "SELECT plnt, MIN(plant_name) AS name, "
            "  ROUND(SUM(unplanned_value)/100000, 2) AS value, "
            "  ROUND(SUM(GREATEST(stock_value - unplanned_value, 0))/100000, 2) AS mrp_value "
            "FROM sap_unplanned_stock "
            "WHERE month_year = :m AND business = :b "
            "GROUP BY plnt ORDER BY value DESC"
        ), conn, params={"m": month, "b": business})
    return df.to_dict(orient="records")


@app.get("/api/category-drilldown")
def get_category_drilldown(month: str, business: str, plnt: str, claims: dict = Depends(verify_microsoft_token)):
    """Category-level (mat_cat) drilldown with NON-MRP and MRP values."""
    with engine.connect() as conn:
        df = pd.read_sql(text(
            "SELECT mat_cat AS name, "
            "  ROUND(SUM(unplanned_value)/100000, 2) AS value, "
            "  ROUND(SUM(GREATEST(stock_value - unplanned_value, 0))/100000, 2) AS mrp_value "
            "FROM sap_unplanned_stock "
            "WHERE month_year = :m AND business = :b AND plnt = :p AND mat_cat != '' "
            "GROUP BY mat_cat "
            "ORDER BY FIELD(mat_cat, 'RM', 'PS', 'SFG', 'FG') = 0, "
            "         FIELD(mat_cat, 'RM', 'PS', 'SFG', 'FG'), mat_cat"
        ), conn, params={"m": month, "b": business, "p": plnt})
    return df.to_dict(orient="records")


@app.get("/api/material-drilldown")
def get_material_drilldown(month: str, business: str, plnt: str, mat_cat: str, claims: dict = Depends(verify_microsoft_token)):
    """Top 25 materials for a specific plant + business + category — excludes zero-value rows."""
    with engine.connect() as conn:
        df = pd.read_sql(text(
            "SELECT material, MIN(description) AS description, "
            "  ROUND(SUM(unplanned_value)/100000, 2) AS unplanned_value_lakhs, "
            "  ROUND(SUM(GREATEST(stock_value - unplanned_value, 0))/100000, 2) AS stock_value_lakhs, "
            "  ROUND(SUM(unplanned_stock), 2) AS unplanned_qty "
            "FROM sap_unplanned_stock "
            "WHERE month_year = :m AND business = :b AND plnt = :p AND mat_cat = :c "
            "GROUP BY material "
            "HAVING unplanned_value_lakhs > 0 "
            "ORDER BY unplanned_value_lakhs DESC LIMIT 25"
        ), conn, params={"m": month, "b": business, "p": plnt, "c": mat_cat})
    return df.to_dict(orient="records")


# -----------------------------------------------
# Chat & login log reports
# -----------------------------------------------
from chat_logger import LOG_FILE as CHAT_LOG_FILE, read_logs as _read_chat_logs  # noqa: E402
from login_logger import LOG_FILE as LOGIN_LOG_FILE, read_logs as _read_login_logs  # noqa: E402

@app.post("/api/login")
def record_login(claims: dict = Depends(verify_microsoft_token)):
    """Record a successful Microsoft SSO login. Frontend calls this once after login redirect."""
    log_login(claims)
    return {"ok": True}


@app.get("/api/chat-logs")
def get_chat_logs(claims: dict = Depends(verify_microsoft_token)):
    """Return the chat log as JSON rows (timestamp, user, question, status)."""
    return {"rows": _read_chat_logs()}


@app.get("/api/chat-logs.jsonl")
def download_chat_logs(claims: dict = Depends(verify_microsoft_token)):
    """Download the raw chat_log.jsonl file (one JSON record per line)."""
    if not CHAT_LOG_FILE.exists():
        raise HTTPException(404, "No chat logs yet")
    return FileResponse(
        CHAT_LOG_FILE,
        media_type="application/x-ndjson",
        filename="chat_log.jsonl",
    )


@app.get("/api/login-logs")
def get_login_logs(claims: dict = Depends(verify_microsoft_token)):
    """Return the login log as JSON rows (timestamp, user)."""
    return {"rows": _read_login_logs()}


@app.get("/api/login-logs.jsonl")
def download_login_logs(claims: dict = Depends(verify_microsoft_token)):
    """Download the raw login_log.jsonl file (one JSON record per line)."""
    if not LOGIN_LOG_FILE.exists():
        raise HTTPException(404, "No login logs yet")
    return FileResponse(
        LOGIN_LOG_FILE,
        media_type="application/x-ndjson",
        filename="login_log.jsonl",
    )


# -----------------------------------------------
# Serve Frontend (static files from dist/)
# -----------------------------------------------
DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if DIST_DIR.is_dir():
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    # Serve any static file in dist root (favicon, Wheels.png, etc.)
    @app.get("/{filename:path}")
    def serve_frontend(filename: str):
        file_path = DIST_DIR / filename
        if file_path.is_file():
            return FileResponse(file_path)
        # SPA fallback — serve index.html for all unknown routes
        return FileResponse(DIST_DIR / "index.html")

# -----------------------------------------------
# Run
# -----------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)

