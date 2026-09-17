# MONARCH HACKATHON — QUICK REFERENCE CARD

Print this and keep it by your desk.

---

## SETUP COMMANDS

```bash
# First time setup
cd monarch-hackathon
mkdir backend frontend evidence/demo

# Backend
cd backend
python -m venv venv
source venv/bin/activate          # Mac/Linux
# OR
venv\Scripts\activate             # Windows

pip install -r requirements.txt
cp .env.example .env
export GROQ_API_KEY="your_key"
python main.py

# Frontend (new terminal)
cd frontend
npm install
npm run dev

# Test
curl http://localhost:8000/health
# Visit http://localhost:5173
```

---

## DAILY GIT WORKFLOW

```bash
# Morning
git status
git log --oneline | head -10

# Work...

# Afternoon commit
git add .
git commit -m "Day 1 afternoon: Feature working"

# Evening commit
git add .
git commit -m "Day 1 evening: Feature polished"

# Before sleep
git push origin main
```

---

## COMMON PATTERNS

### Adding a new agent

**backend/agents.py:**
```python
def new_agent(self, input_data: str) -> Dict[str, Any]:
    prompt = ChatPromptTemplate.from_template(
        """You are an expert at X.
        
        INPUT: {input_data}
        
        Analyze and respond with JSON:
        {{
            "finding": "...",
            "confidence": 0.85
        }}
        """
    )
    chain = prompt | self.llm
    result = chain.invoke({"input_data": input_data})
    try:
        return json.loads(result.content)
    except:
        return {"finding": result.content, "confidence": 0.5}
```

### Adding a new component

**frontend/src/components/NewComponent.jsx:**
```javascript
import React from 'react'

function NewComponent({ data }) {
  if (!data) return null
  
  return (
    <div className="new-component">
      <h3>Title</h3>
      {/* Your JSX here */}
    </div>
  )
}

export default NewComponent
```

**frontend/src/styles/App.css:**
```css
.new-component {
  margin: 20px 0;
  padding: 15px;
  background: rgba(0, 212, 255, 0.05);
  border-left: 3px solid #00d4ff;
}
```

### Adding new backend endpoint

**backend/main.py:**
```python
@app.post("/new-endpoint")
async def new_endpoint(data: dict):
    try:
        # Your logic here
        result = {"status": "success", "data": data}
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### Frontend API call

**frontend/src/App.jsx:**
```javascript
const response = await axios.post(
  'http://localhost:8000/new-endpoint',
  { /* data */ }
)
const data = response.data
```

---

## COMMON ERRORS & FIXES

| Error | Solution |
|-------|----------|
| `ModuleNotFoundError: langchain` | `pip install -r requirements.txt` |
| `GROQ_API_KEY not found` | `export GROQ_API_KEY="your_key"` |
| `Connection refused at :8000` | Backend not running. `python main.py` |
| `Cannot find module react` | `npm install` in frontend folder |
| `Port 5173 already in use` | `npm run dev -- --port 5174` |
| `JSON parsing failed` | Agent returned non-JSON. Check agent prompt. |
| `pdf parsing failed` | PDF might be corrupted. Use different file. |
| `S3 connection failed` | `aws configure` with correct credentials |
| `Slow response (>30s)` | Groq API slow. Try shorter input. Normal for Day 1. |

---

## DEBUGGING CHECKLIST

```
Something broke?

1. Check error message in console
2. Search error in code (Ctrl+F)
3. Read the full traceback
4. Restart relevant service (backend/frontend)
5. Clear browser cache (Ctrl+Shift+Delete)
6. Check .env file for missing keys
7. Verify file paths are correct
8. Test with simpler input first
9. Check git diff to see what changed
10. If stuck >10 min: ask for help
```

---

## KEY FILES

**Backend**
- `main.py` — API endpoints
- `agents.py` — LLM agents
- `models.py` — Data models
- `config.py` — Configuration
- `evidence_chain.py` — Evidence citations (Day 2)
- `timeline.py` — Timeline builder (Day 3)
- `contradiction.py` — Contradiction detection (Day 3)
- `.env` — API keys

**Frontend**
- `App.jsx` — Main component
- `components/UploadArea.jsx` — File upload
- `components/InvestigationStatus.jsx` — Loading spinner
- `components/ResultsDisplay.jsx` — Results
- `components/EvidenceChain.jsx` — Evidence (Day 2)
- `components/Timeline.jsx` — Timeline (Day 3)
- `components/Contradictions.jsx` — Contradictions (Day 3)
- `styles/App.css` — All styling

---

## TESTS TO RUN

### Day 1

```
1. Backend health:
   curl http://localhost:8000/health

2. File upload:
   Upload demo files via UI

3. Full investigation:
   Ask "Why did checkout fail?"
   Get root cause string back
```

### Day 2

```
1. Evidence chain:
   Response has evidence_chain array
   Each item has claim + evidence list

2. S3 upload:
   Check S3 console for result.json
```

### Day 3

```
1. Timeline:
   Events in chronological order
   Each event linked to source

2. Contradictions:
   If contradictions exist, they're shown
   Confidence adjusted
```

### Day 4

```
1. Evaluation:
   evaluation_report.json created
   Shows metrics

2. Demo flow:
   Upload → Investigate → Results display
   All in <25 seconds
```

---

## PERFORMANCE TIPS

**Slow backend response?**
- Reduce file size: max 1MB per file
- Shorten logs: use first 1000 lines
- Check GROQ rate limits: wait between requests

**Slow frontend?**
- Clear browser cache
- Restart dev server: `npm run dev`
- Check Network tab for slow requests

**High memory usage?**
- Restart backend: `python main.py`
- Restart frontend: `npm run dev`
- Clear browser console

---

## HELPFUL COMMANDS

```bash
# See what changed
git diff
git log --oneline

# Undo last commit (keep files)
git reset --soft HEAD~1

# Undo all uncommitted changes
git checkout .

# See file size
du -sh filename
wc -l filename  # lines

# Kill process on port 8000
lsof -i :8000
kill -9 <PID>

# Python REPL (test code)
python -c "from agents import InvestigationAgents; print('OK')"

# Node REPL
node
> console.log(require('axios'))

# Environment variable check
echo $GROQ_API_KEY
```

---

## RESPONSE STRUCTURES

### Backend returns:

```json
{
  "status": "success",
  "investigation_id": "a1b2c3d4",
  "root_cause": "Database connection pool exhaustion",
  "confidence": 0.85,
  "evidence_chain": [
    {
      "claim": "DB pool exhausted",
      "evidence": [
        {"file": "database.log", "line": 4821}
      ]
    }
  ],
  "timeline": [
    {"time": "14:08", "event": "[ERROR] Pool exhausted", "source": "app.log"}
  ],
  "contradictions": [
    {"evidence": "...", "why_contradicts": "..."}
  ],
  "s3_path": "s3://bucket/investigations/a1b2c3d4/result.json"
}
```

### Frontend state:

```javascript
const [investigationId, setInvestigationId] = useState(null)
const [loading, setLoading] = useState(false)
const [results, setResults] = useState(null)
const [error, setError] = useState(null)
```

---

## STYLING COLORS

```css
Primary Blue: #00d4ff
Secondary Blue: #0099ff
Dark Blue: #0f0c29
Light Blue: #302b63
Warning: #ff8080
Success: #64c8ff
```

---

## COMMIT MESSAGE TEMPLATE

```
[Day N] [Morning/Afternoon/Evening]: [One-line what you added]

Optional details (if complex change):
- What you did
- Why you did it
- Any gotchas
```

Example:
```
Day 2 afternoon: Evidence chain builder

Added EvidenceChainBuilder class that:
- Breaks root cause into claims
- Finds supporting evidence for each claim
- Returns structured evidence_chain array

Need to test with complex root causes next.
```

---

## WHEN YOU'RE STUCK

1. **Backend agent returns empty string?**
   - Check prompt template
   - Add `print()` to debug
   - Test LLM call directly in Python REPL

2. **Frontend not updating?**
   - Check React DevTools
   - Verify state is changing
   - Check network response

3. **Can't parse evidence?**
   - Reduce file size
   - Use simpler file format
   - Add try/catch around parsing

4. **S3 upload failing?**
   - Check AWS credentials: `aws sts get-caller-identity`
   - Check bucket exists: `aws s3 ls`
   - Check bucket permissions

5. **Git conflict?**
   - `git status` to see conflicts
   - Open conflicted file, remove `<<<<` markers
   - `git add .` and `git commit`

---

## ONE-MINUTE CHECKLIST

Before end of each day:

```bash
✓ Does it still run? (no errors)
✓ Did you test the new feature? (it works)
✓ Did you commit? (git log shows today)
✓ Is it on GitHub? (git push worked)
✓ Can you explain what you did? (you can)
```

If all 5: You're good for tomorrow.

---

## PRE-SUBMISSION (Day 4)

```bash
# 30 minutes before submission

git status              # Everything committed?
git log --oneline       # 15+ commits total?
ls -la evidence/demo/   # Demo files exist?
cat README.md           # Is it good?
curl http://localhost:8000/health  # Backend runs?
npm run build           # Frontend builds?

# Record demo video
# Upload GitHub
# Submit
```
