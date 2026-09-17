# MONARCH HACKATHON — DAY 1 SKELETON

## Repo structure (create this exactly)

```
monarch-hackathon/
├── backend/
│   ├── main.py
│   ├── agents.py
│   ├── models.py
│   ├── config.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── package.json
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── UploadArea.jsx
│   │   │   ├── InvestigationStatus.jsx
│   │   │   └── ResultsDisplay.jsx
│   │   ├── styles/
│   │   │   └── App.css
│   │   └── index.jsx
│   └── vite.config.js
├── evidence/
│   ├── demo/
│   │   ├── deployment.log
│   │   ├── application.log
│   │   ├── database.log
│   │   ├── incident_report.pdf
│   │   └── monitoring_dashboard.png
│   └── .gitkeep
├── README.md
└── .gitignore
```

## Step 0: Before Sept 17

### Install these once:

```bash
# Python 3.11+
python --version

# Node 18+
node --version
npm --version

# Create accounts (free tier):
1. Groq API key (https://console.groq.com)
2. Optional: Hugging Face (for embeddings)
```

### Get your demo incident files ready

You need these 5 files in `evidence/demo/`:

**deployment.log** (1000+ lines, sample):
```
[14:01:45] Starting deployment of v2.4
[14:01:50] Pulling Docker image from registry
[14:02:00] Image pulled successfully
[14:02:15] Starting container instances
[14:02:30] Applied database migrations
[14:02:45] Health check passed
[14:03:00] Load balancer updated
[14:03:15] Deployment complete - v2.4 active
```

**application.log** (5000+ lines, focus on errors after 14:08):
```
[14:02:00] Application started
[14:04:15] [INFO] DB connection pool initialized (size: 50)
[14:04:30] [INFO] Health check: OK
...
[14:07:45] [WARN] DB connections in use: 48/50
[14:07:50] [WARN] DB connections in use: 50/50
[14:08:00] [ERROR] Connection pool exhausted, request rejected
[14:08:01] [ERROR] Database.checkout - Unable to get connection
[14:08:02] [ERROR] HTTP 500: Internal Server Error
[14:08:03] [ERROR] HTTP 500: Internal Server Error
...
```

**database.log** (2000+ lines, key entries):
```
[14:02:30] Migration applied
[14:04:10] Connection pool created: 50 connections
...
[14:07:40] New connection request from pool (48/50 in use)
[14:07:45] New connection request from pool (49/50 in use)
[14:07:50] New connection request from pool (50/50 in use - EXHAUSTED)
[14:07:51] Connection timeout - max retries exceeded
[14:08:10] Connections slowly returning to pool
[14:08:45] Connection pool recovered
```

**incident_report.pdf** (6 pages, key content):
```
Page 1: Incident Summary
Date: Sept 16, 2024
Impact: Checkout service unavailable 14:08-14:25 (17 min)
Revenue loss: ~$12,000

Page 3: Timeline
14:02 - Deployment v2.4 started
14:08 - First checkout error observed
14:25 - Service recovered after manual restart

Page 5: Observations
- Error rate spiked after deployment
- Database connection logs show exhaustion
- Web server remained responsive
- Network metrics normal
```

**monitoring_dashboard.png** (any 1080x720 image)
Just get any screenshot of:
- Time series graph from 14:00-14:30
- Y-axis: "DB Connections (0-60)"
- Line that flatlines at 50 from 14:07-14:25
Save as PNG.

### Check your Groq key

```bash
export GROQ_API_KEY="your_key_here"
echo $GROQ_API_KEY  # should print your key
```

---

## Day 1: Code (Sept 17)

### 1. Backend setup (copy-paste)

**backend/requirements.txt**
```
fastapi==0.104.1
uvicorn==0.24.0
python-dotenv==1.0.0
langgraph==0.0.43
langchain==0.1.0
langchain-community==0.0.24
langchain-groq==0.0.1
pydantic==2.5.0
python-multipart==0.0.6
PyPDF2==3.0.1
Pillow==10.1.0
pydantic-settings==2.1.0
```

**backend/.env.example**
```
GROQ_API_KEY=your_key_here
GROQ_MODEL=mixtral-8x7b-32768
VECTOR_DB=chroma
```

**backend/config.py**
```python
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    GROQ_API_KEY: str
    GROQ_MODEL: str = "mixtral-8x7b-32768"
    VECTOR_DB: str = "chroma"
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
    
    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
```

**backend/models.py**
```python
from pydantic import BaseModel
from typing import List, Optional

class EvidenceReference(BaseModel):
    source: str  # filename
    line: Optional[int] = None
    page: Optional[int] = None
    region: Optional[str] = None
    quote: str

class InvestigationResult(BaseModel):
    root_cause: str
    confidence: float  # 0-1
    evidence: List[EvidenceReference]
    timeline: List[str]  # chronological events
    reasoning: str

class UploadResponse(BaseModel):
    status: str
    investigation_id: str
    message: str
```

**backend/agents.py**
```python
from langchain_groq import ChatGroq
from langchain.prompts import ChatPromptTemplate
from typing import Dict, List, Any
import json

class InvestigationAgents:
    def __init__(self, groq_api_key: str, model: str):
        self.llm = ChatGroq(
            api_key=groq_api_key,
            model_name=model,
            temperature=0.3
        )
    
    def router_agent(self, question: str, evidence_summary: str) -> str:
        """Determine investigation type"""
        prompt = ChatPromptTemplate.from_template(
            """You are a router that determines the type of investigation needed.

Question: {question}
Evidence summary: {evidence_summary}

Respond with ONLY one of: LOG_ANALYSIS, DOCUMENT_SEARCH, VISUAL_ANALYSIS, COMBINED

Just respond with the type, nothing else."""
        )
        chain = prompt | self.llm
        result = chain.invoke({
            "question": question,
            "evidence_summary": evidence_summary
        })
        return result.content.strip()
    
    def log_agent(self, question: str, logs: str) -> Dict[str, Any]:
        """Analyze logs for root cause"""
        prompt = ChatPromptTemplate.from_template(
            """You are an expert system engineer analyzing logs.

QUESTION: {question}

LOGS:
{logs}

Analyze these logs and find the root cause. Respond in JSON format:
{{
    "root_cause": "what happened",
    "key_events": ["event1", "event2"],
    "confidence": 0.85,
    "evidence_lines": [123, 456]
}}

Respond ONLY with valid JSON."""
        )
        chain = prompt | self.llm
        result = chain.invoke({
            "question": question,
            "logs": logs[:3000]  # limit to 3000 chars
        })
        try:
            return json.loads(result.content)
        except:
            return {
                "root_cause": result.content,
                "confidence": 0.5,
                "evidence_lines": []
            }
    
    def rag_agent(self, question: str, documents: str) -> Dict[str, Any]:
        """Search documents for supporting evidence"""
        prompt = ChatPromptTemplate.from_template(
            """You are a document researcher finding evidence.

QUESTION: {question}

DOCUMENTS:
{documents}

Find relevant evidence. Respond in JSON:
{{
    "findings": "what you found",
    "supporting_pages": [1, 2, 5],
    "confidence": 0.8
}}

Respond ONLY with valid JSON."""
        )
        chain = prompt | self.llm
        result = chain.invoke({
            "question": question,
            "documents": documents[:2000]
        })
        try:
            return json.loads(result.content)
        except:
            return {"findings": result.content, "confidence": 0.5}
    
    def vision_agent(self, question: str, image_description: str) -> Dict[str, Any]:
        """Analyze visual evidence"""
        prompt = ChatPromptTemplate.from_template(
            """You are analyzing monitoring dashboards or screenshots.

QUESTION: {question}

IMAGE DESCRIPTION:
{image_description}

What does this visual evidence show? Respond in JSON:
{{
    "observations": "what the image shows",
    "anomalies": ["anomaly1"],
    "confidence": 0.75
}}

Respond ONLY with valid JSON."""
        )
        chain = prompt | self.llm
        result = chain.invoke({
            "question": question,
            "image_description": image_description
        })
        try:
            return json.loads(result.content)
        except:
            return {"observations": result.content, "confidence": 0.5}
    
    def evidence_fusion(self, log_result: Dict, doc_result: Dict, image_result: Dict) -> Dict[str, Any]:
        """Combine agent outputs"""
        prompt = ChatPromptTemplate.from_template(
            """You are synthesizing investigation results.

LOG ANALYSIS:
{log_result}

DOCUMENT SEARCH:
{doc_result}

VISUAL ANALYSIS:
{image_result}

Synthesize these into a single root cause. Respond in JSON:
{{
    "root_cause": "the actual root cause",
    "confidence": 0.85,
    "reasoning": "why this is the root cause",
    "contributing_factors": ["factor1", "factor2"]
}}

Respond ONLY with valid JSON."""
        )
        chain = prompt | self.llm
        result = chain.invoke({
            "log_result": json.dumps(log_result),
            "doc_result": json.dumps(doc_result),
            "image_result": json.dumps(image_result)
        })
        try:
            return json.loads(result.content)
        except:
            return {"root_cause": result.content, "confidence": 0.5}
```

**backend/main.py**
```python
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import uuid
from datetime import datetime
from config import get_settings
from models import InvestigationResult, EvidenceReference
from agents import InvestigationAgents
import PyPDF2
from PIL import Image
import io

app = FastAPI(title="Monarch Hackathon")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings = get_settings()
agents = InvestigationAgents(settings.GROQ_API_KEY, settings.GROQ_MODEL)

# In-memory storage (Day 1 only)
investigations = {}

@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@app.post("/upload")
async def upload_evidence(files: list[UploadFile] = File(...), question: str = ""):
    """Upload evidence files and start investigation"""
    
    investigation_id = str(uuid.uuid4())[:8]
    
    try:
        # Parse files
        evidence_text = {}
        image_desc = "No visual evidence"
        
        for file in files:
            content = await file.read()
            
            if file.filename.endswith('.pdf'):
                # Extract text from PDF
                try:
                    pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
                    text = "\n".join([page.extract_text() for page in pdf_reader.pages])
                    evidence_text[file.filename] = text[:2000]
                except:
                    evidence_text[file.filename] = "[PDF parsing failed]"
            
            elif file.filename.endswith(('.png', '.jpg', '.jpeg')):
                # Simple image description (Day 1: just note presence)
                image_desc = f"Image found: {file.filename}"
            
            else:
                # Text files (logs)
                try:
                    text = content.decode('utf-8', errors='ignore')
                    evidence_text[file.filename] = text[:3000]
                except:
                    evidence_text[file.filename] = "[File parsing failed]"
        
        # Combine evidence into summary
        evidence_summary = "\n---\n".join(
            f"FILE: {name}\n{text}" 
            for name, text in evidence_text.items()
        )
        
        # Run investigation
        investigation_type = agents.router_agent(question, evidence_summary[:500])
        
        log_result = agents.log_agent(question, evidence_summary)
        doc_result = agents.rag_agent(question, evidence_summary)
        image_result = agents.vision_agent(question, image_desc)
        
        # Fuse results
        final_result = agents.evidence_fusion(log_result, doc_result, image_result)
        
        # Build investigation object
        investigation = {
            "id": investigation_id,
            "question": question,
            "status": "complete",
            "root_cause": final_result.get("root_cause", "Unknown"),
            "confidence": final_result.get("confidence", 0.5),
            "reasoning": final_result.get("reasoning", ""),
            "timestamp": datetime.now().isoformat(),
            "evidence_files": list(evidence_text.keys()),
            "raw_results": {
                "log": log_result,
                "doc": doc_result,
                "image": image_result
            }
        }
        
        # Store
        investigations[investigation_id] = investigation
        
        return {
            "status": "success",
            "investigation_id": investigation_id,
            "root_cause": final_result.get("root_cause"),
            "confidence": final_result.get("confidence"),
            "message": "Investigation complete"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/investigation/{investigation_id}")
async def get_investigation(investigation_id: str):
    """Retrieve investigation results"""
    
    if investigation_id not in investigations:
        raise HTTPException(status_code=404, detail="Investigation not found")
    
    inv = investigations[investigation_id]
    return {
        "id": inv["id"],
        "question": inv["question"],
        "root_cause": inv["root_cause"],
        "confidence": inv["confidence"],
        "reasoning": inv["reasoning"],
        "status": inv["status"],
        "timestamp": inv["timestamp"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## Day 1 Setup Instructions

### 1. Create repo (5 min)

```bash
mkdir monarch-hackathon
cd monarch-hackathon
git init
```

### 2. Backend setup (10 min)

```bash
mkdir backend frontend evidence/demo

cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env, add your GROQ_API_KEY
```

### 3. Frontend setup (10 min)

```bash
cd ../frontend

npm install
npm run dev  # Starts on http://localhost:5173
```

### 4. Start backend (5 min)

```bash
cd ../backend
source venv/bin/activate
python main.py
# Runs on http://localhost:8000
```

### 5. Test it works

```
http://localhost:5173
Upload a demo file
Ask a question
Get result
```
