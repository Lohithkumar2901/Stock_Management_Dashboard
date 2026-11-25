# Stock Chatbot

Chat interface for querying SAP unplanned-stock data.

- **backend/** — FastAPI service (`api.py`) using LangChain + OpenAI over a MySQL table, with Microsoft Entra ID (Azure AD) token auth.
- **frontend/** — React + Vite + Tailwind app with MSAL login.

## Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# create the env file — see backend/.env.example (api.py loads /data/project_documents/stockbot/.env)
uvicorn api:app --reload
```

## Frontend

```bash
cd frontend
npm install
npm run dev      # development
npm run build    # production build → frontend/dist
```
