# MONARCH DAY 1 — DEBUGGING GUIDE

## Common errors and solutions

### Python Errors

**"ModuleNotFoundError: No module named 'langchain'"**
```bash
cd backend
pip install -q -r requirements.txt
# Make sure you're in the venv
source venv/bin/activate  # Mac/Linux
# or
venv\Scripts\activate  # Windows
```

**"GROQ_API_KEY not found"**
```bash
cd backend
export GROQ_API_KEY="your_actual_key"
python -c "from config import get_settings; print(get_settings().GROQ_API_KEY)"
# Should print your key
```

**"Connection refused at localhost:8000"**
```bash
# Backend isn't running
cd backend
source venv/bin/activate
python main.py
# Should print: Uvicorn running on http://0.0.0.0:8000
```

**"FileNotFoundError: [Errno 2] No such file or directory: '.env'"**
```bash
cd backend
cp .env.example .env
# Now edit .env and add GROQ_API_KEY
```

---

### Node/Frontend Errors

**"npm not found"**
- Install Node.js from nodejs.org (v18+)
- Verify: `node --version` and `npm --version`

**"Cannot find module 'react'"**
```bash
cd frontend
npm install
```

**"Error: EADDRINUSE: address already in use :::5173"**
Port 5173 is already taken. Either:
```bash
# Kill process on 5173
lsof -i :5173  # Mac/Linux
netstat -ano | findstr :5173  # Windows

# Or use different port
npm run dev -- --port 5174
```

**"Proxy error: Could not proxy request"**
- Backend isn't running on `http://localhost:8000`
- Start backend first: `cd backend && python main.py`

---

### API Errors

**"HTTP 500 in /upload"**
- Check backend console for error message
- Likely: file parsing failed
- Solution: Make sure files are valid PDF/text/images

**"[JSON parsing failed]"**
- Agent returned non-JSON
- This is OK for Day 1, still shows root cause
- Day 3: Add better JSON validation

**"Connection pool exhausted"**
- You're hitting Groq rate limit
- Day 1 is fine with slower requests
- Just wait between investigations

---

### File Issues

**"PDF parsing failed"**
- Your PDF might be corrupted
- Use a different PDF
- Or: just use text files for now

**"Image file not found"**
- Image upload works even if parsing fails
- Day 2: Implement actual image processing
- For now just upload any image

---

## Testing checklist

Run these one by one:

```bash
# 1. Backend health
curl http://localhost:8000/health
# Should return: {"status":"ok","timestamp":"..."}

# 2. Test config
cd backend && python -c "from config import get_settings; s = get_settings(); print(f'Model: {s.GROQ_MODEL}')"
# Should print your model name

# 3. Test agents
python -c "from agents import InvestigationAgents; print('Agents loaded')"
# Should print: Agents loaded

# 4. Frontend loads
# Visit http://localhost:5173
# Should see upload area (not blank page)

# 5. Full flow
# 1. Upload demo/deployment.log
# 2. Ask "Why did checkout fail?"
# 3. Should get root cause within 10 seconds
```

---

## How to debug further

### Backend debug mode

```bash
cd backend
# Add to main.py, after app = FastAPI()
import logging
logging.basicConfig(level=logging.DEBUG)

# Run with verbose output
python -u main.py  # unbuffered
```

### Check what agents are sending

Add this to `backend/agents.py`:

```python
def log_agent(self, question: str, logs: str) -> Dict[str, Any]:
    prompt = ChatPromptTemplate.from_template(...)
    chain = prompt | self.llm
    result = chain.invoke({...})
    print(f"[LOG_AGENT] {result.content[:500]}")  # ADD THIS
    try:
        return json.loads(result.content)
```

### Frontend debug mode

```bash
cd frontend
npm run dev  # Vite already has good error output
```

Open DevTools (F12) → Console to see:
- API response data
- File sizes being uploaded
- Error messages from backend

---

## Performance notes

**Investigation takes >20 seconds?**
- Groq is slow on free tier
- This is OK for Day 1
- Day 2: Add streaming responses

**Files too large?**
- Max file size is 50MB
- But API will timeout on files >5MB text
- For Day 1: keep files <1MB total

**Memory usage high?**
- Each investigation stores all evidence in memory
- Day 2: Move to S3 + database
- For now: restart backend if it gets slow

---

## If nothing works

Do this in order:

1. **Restart everything**
   ```bash
   # Kill all processes
   # Close all terminals
   # Start fresh
   ```

2. **Verify Python path**
   ```bash
   which python  # Should be .../venv/bin/python
   python --version  # Should be 3.11+
   ```

3. **Verify Node path**
   ```bash
   which npm
   npm --version  # Should be 9+
   ```

4. **Check GROQ key**
   ```bash
   echo $GROQ_API_KEY  # Should print your key
   ```

5. **Test Groq directly**
   ```python
   from langchain_groq import ChatGroq
   llm = ChatGroq(api_key="your_key", model_name="mixtral-8x7b-32768")
   print(llm.invoke("Hello"))
   ```

6. **Nuclear option: Start from scratch**
   ```bash
   rm -rf backend/venv frontend/node_modules
   rm backend/.env
   # Follow setup instructions again
   ```

---

## Success indicators

✅ Backend running: `Uvicorn running on http://0.0.0.0:8000`
✅ Frontend running: `Local:   http://localhost:5173`
✅ Can upload files: Upload area shows file list
✅ Can submit question: "Start Investigation" button works
✅ Get response: Root cause appears in 5-20 seconds

If all 5 are true, you're ready for Day 1 coding.
