# MONARCH HACKATHON — 4-DAY EXECUTION TRACKER

Print this and check off items as you complete them.

---

## BEFORE SEPT 17 (Preparation week)

- [ ] Create demo incident files (5 files)
  - [ ] deployment.log
  - [ ] application.log
  - [ ] database.log
  - [ ] incident_report.pdf
  - [ ] monitoring_dashboard.png
- [ ] Get Groq API key
- [ ] Create GitHub repo
- [ ] Study LangGraph routing patterns (90 min)
- [ ] Study FastAPI (60 min)
- [ ] Study React components (60 min)
- [ ] Download this skeleton code
- [ ] Test Python/Node installations

**Time Investment:** 6-8 hours (spread across week)

---

## DAY 1: SEPT 17 — CORE INVESTIGATION ENGINE

### Morning (9 AM - 12 PM)

**Goal: Backend skeleton working**

**Setup (9:00-9:30)**
- [ ] Clone/create repo structure
- [ ] Copy all backend code from skeleton
- [ ] Create `.env` with GROQ_API_KEY
- [ ] `pip install -r requirements.txt`
- [ ] Test: `python main.py` runs without errors

**Backend development (9:30-12:00)**
- [ ] `main.py` compiles
- [ ] `agents.py` all agents work
- [ ] `/upload` endpoint accepts files
- [ ] File parsing (PDF, logs, images) works
- [ ] Router agent returns investigation type
- [ ] Log agent returns root cause
- [ ] RAG agent returns findings
- [ ] Vision agent returns observations
- [ ] Evidence fusion returns combined result
- [ ] Return JSON response

**Test:**
```bash
curl -X POST http://localhost:8000/health
# Should return: {"status":"ok"}
```

**Commit:**
```bash
git add .
git commit -m "Day 1 morning: Backend skeleton working"
```

---

### Afternoon (1 PM - 6 PM)

**Goal: Frontend + upload UI working**

**Frontend setup (1:00-2:00)**
- [ ] `npm install`
- [ ] Copy all React code
- [ ] `npm run dev` runs without errors

**Frontend development (2:00-6:00)**
- [ ] App.jsx compiles
- [ ] UploadArea component renders
- [ ] File upload drag-drop works
- [ ] File list displays after selection
- [ ] Question textarea captures input
- [ ] "Start Investigation" button works
- [ ] Axios POST to backend succeeds
- [ ] InvestigationStatus spinner displays
- [ ] ResultsDisplay shows root cause

**Test:**
```
1. Open http://localhost:5173
2. Drag demo files onto upload area
3. Type: "Why did checkout fail?"
4. Click "Start Investigation"
5. Wait 10-20 seconds
6. See root cause appear
```

**Commit:**
```bash
git add .
git commit -m "Day 1 afternoon: Frontend + upload working"
```

---

### Evening (6 PM - 10 PM)

**Goal: Full loop working end-to-end**

**Integration (6:00-10:00)**
- [ ] Upload real demo files
- [ ] Backend processes them
- [ ] Frontend shows results in 15 seconds
- [ ] Root cause text appears
- [ ] Confidence score shows
- [ ] No errors in console
- [ ] No errors in backend logs

**Test with demo incident:**
```
1. Copy 5 demo files to evidence/demo/
2. Upload all 5 files
3. Ask: "Why did checkout fail after deployment v2.4?"
4. Verify: Response mentions "database" or "connection" or "pool"
5. Check latency: Should be 10-25 seconds
```

**Commit:**
```bash
git add .
git commit -m "Day 1 evening: Full investigation loop working"
```

---

### Day 1 End Checklist

- [ ] Backend running on localhost:8000
- [ ] Frontend running on localhost:5173
- [ ] Can upload 5 files
- [ ] Investigation completes in <30 seconds
- [ ] Root cause is displayed
- [ ] Confidence score shows
- [ ] 3+ commits in git history
- [ ] No console errors

**Expected Time:** 9-11 hours active work

---

## DAY 2: SEPT 18 — AWS + EVIDENCE CHAIN

### Morning (9 AM - 12 PM)

**Goal: Evidence chain builder working**

- [ ] Create `backend/evidence_chain.py`
- [ ] Implement `EvidenceChainBuilder` class
- [ ] Test: Takes root cause, returns structured claims
- [ ] Test: Each claim has supporting evidence list
- [ ] Integrate into `/upload` endpoint
- [ ] Return evidence chain in JSON response
- [ ] Update frontend to receive evidence chain

---

### Afternoon (1 PM - 6 PM)

**Goal: AWS S3 integration**

- [ ] `aws configure` with credentials
- [ ] Create S3 bucket: `monarch-hackathon-{suffix}`
- [ ] Add to `.env`: S3_BUCKET, AWS_REGION
- [ ] `pip install boto3`
- [ ] Add S3 upload to `/upload` endpoint

---

### Evening (6 PM - 10 PM)

**Goal: Frontend displays evidence chain**

- [ ] Create `EvidenceChain.jsx` component
- [ ] Display claim + evidence pairs
- [ ] Style evidence cards nicely
- [ ] Update ResultsDisplay to use EvidenceChain

---

## DAY 3: SEPT 19 — TIMELINE + CONTRADICTIONS + POLISH

### Morning (9 AM - 12 PM)
- [ ] Create `backend/timeline.py`
- [ ] Implement timestamp extraction
- [ ] Create `Timeline.jsx` component

### Afternoon (1 PM - 6 PM)
- [ ] Create `backend/contradiction.py`
- [ ] Implement `ContradictionDetector` class
- [ ] Create `Contradictions.jsx` component

### Evening (6 PM - 10 PM)
- [ ] UI Polish, responsive CSS, and icons

---

## DAY 4: SEPT 20 — POLISH + EVALUATION + SUBMIT

### Morning (9 AM - 12 PM)
- [ ] Test full flow 3 times
- [ ] Run `backend/evaluation.py` and output `evaluation_report.json`

### Afternoon (1 PM - 6 PM)
- [ ] Complete README.md
- [ ] Record 3-minute demo video

### Evening (5 PM - Submission)
- [ ] Final git tag `hackathon-submission` and submission
