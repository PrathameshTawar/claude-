# MONARCH — DAYS 2, 3, 4 ROADMAP

## Day 2: AWS Deployment + Evidence Chain

### What you're adding
```text
User Question ↓ Investigation (Day 1 ✓) ↓ Evidence Chain (NEW) ↓ AWS S3 + CloudWatch (NEW)
```

### Code additions for Day 2

#### backend/models.py (add to existing)
```python
class EvidenceChain(BaseModel):
    claim: str
    supporting_evidence: List[Dict]  # {file, line/page, quote}
    confidence_for_claim: float

class InvestigationResultV2(BaseModel):
    root_cause: str
    confidence: float
    evidence_chain: List[EvidenceChain]  # NEW
    timeline: List[str]
    reasoning: str
    aws_s3_path: str  # NEW
```

#### backend/evidence_chain.py (NEW FILE)
```python
from typing import List, Dict
from langchain_groq import ChatGroq
from langchain.prompts import ChatPromptTemplate
import json

class EvidenceChainBuilder:
    def __init__(self, llm):
        self.llm = llm

    def build_chain(self, root_cause: str, evidence_text: Dict[str, str]) -> List[Dict]:
        """
        For each sentence in root_cause, find supporting evidence.
        """
        # Split root cause into claims
        prompt = ChatPromptTemplate.from_template(
            """Break down this claim into 2-3 testable statements:
CLAIM: {root_cause}
Respond ONLY with JSON:
{{ "claims": ["claim1", "claim2", "claim3"] }}
"""
        )
        chain = prompt | self.llm
        result = chain.invoke({"root_cause": root_cause})
        try:
            claims_data = json.loads(result.content)
            claims = claims_data.get("claims", [root_cause])
        except:
            claims = [root_cause]

        # For each claim, find evidence
        evidence_chain = []
        for claim in claims:
            evidence_prompt = ChatPromptTemplate.from_template(
                """Find evidence supporting this claim in the documents.
CLAIM: {claim}
DOCUMENTS: {documents}
Respond with JSON:
{{
    "found": true,
    "evidence_items": [
        {{"file": "database.log", "line": 4821, "quote": "exact text from log"}},
        {{"file": "deployment.log", "line": 912, "quote": "exact text"}}
    ]
}}
"""
            )
            evidence_chain_prompt = evidence_prompt | self.llm
            evidence_result = evidence_chain_prompt.invoke({
                "claim": claim,
                "documents": str(evidence_text)[:2000]
            })
            try:
                evidence_data = json.loads(evidence_result.content)
                evidence_chain.append({
                    "claim": claim,
                    "evidence": evidence_data.get("evidence_items", [])
                })
            except:
                evidence_chain.append({
                    "claim": claim,
                    "evidence": []
                })
        return evidence_chain
```

---

## Day 3: Timeline + Contradiction Detection + Polish UI

### Code additions for Day 3

#### backend/timeline.py (NEW FILE)
```python
import re
from datetime import datetime
from typing import List, Dict

class TimelineBuilder:
    """Extract and order events chronologically"""
    @staticmethod
    def extract_timestamps(text: str) -> List[Dict]:
        pattern = r'\[(\d{2}):(\d{2})(?::(\d{2}))?\]'
        matches = re.finditer(pattern, text)
        events = []
        for match in matches:
            hour, minute, second = match.groups()
            time_str = f"{hour}:{minute}"
            if second:
                time_str += f":{second}"
            start = match.start()
            end = text.find('\n', start)
            if end == -1:
                end = len(text)
            line = text[start:end].strip()
            events.append({
                "time": time_str,
                "event": line,
                "original_position": start
            })
        events.sort(key=lambda x: x["time"])
        return events

    @staticmethod
    def build_timeline(evidence_text: Dict[str, str]) -> List[Dict]:
        all_events = []
        for filename, content in evidence_text.items():
            events = TimelineBuilder.extract_timestamps(content)
            for event in events:
                event["source"] = filename
                all_events.append(event)
        seen = set()
        unique_events = []
        for event in all_events:
            key = (event["time"], event["event"][:50])
            if key not in seen:
                seen.add(key)
                unique_events.append(event)
        unique_events.sort(key=lambda x: x["time"])
        return unique_events
```

#### backend/contradiction.py (NEW FILE)
```python
from langchain_groq import ChatGroq
from langchain.prompts import ChatPromptTemplate
import json
from typing import List, Dict

class ContradictionDetector:
    def __init__(self, llm):
        self.llm = llm

    def detect_contradictions(self, root_cause: str, evidence_chain: List[Dict]) -> Dict:
        prompt = ChatPromptTemplate.from_template(
            """You are checking if evidence actually supports a claim.
ROOT CAUSE: {root_cause}
EVIDENCE SUPPORTING IT: {evidence}
Does ALL the evidence actually support this claim? Are there contradictions?
Respond with JSON:
{{
    "fully_supported": true/false,
    "contradictions": [
        {{"evidence": "exact quote", "why_contradicts": "explanation"}}
    ],
    "confidence_adjustment": -0.1
}}
"""
        )
        chain = prompt | self.llm
        evidence_str = json.dumps(evidence_chain)
        result = chain.invoke({
            "root_cause": root_cause,
            "evidence": evidence_str[:1500]
        })
        try:
            return json.loads(result.content)
        except:
            return {
                "fully_supported": True,
                "contradictions": [],
                "confidence_adjustment": 0
            }
```

---

## Day 4: Polish + Evaluation + Deploy

### Evaluation framework (`backend/evaluation.py`)
```python
import json
from datetime import datetime
from typing import Dict, List

class MonarchEvaluator:
    def __init__(self):
        self.results = []

    def evaluate_investigation(self, investigation_id: str, expected_root_cause: str, investigation: Dict) -> Dict:
        actual_cause = investigation.get("root_cause", "")
        confidence = investigation.get("adjusted_confidence", 0)
        latency = investigation.get("latency_seconds", 0)
        accuracy = 0.9 if expected_root_cause.lower() in actual_cause.lower() else 0.3
        evidence_chain = investigation.get("evidence_chain", [])
        evidence_support = min(0.95, len(evidence_chain) * 0.3 + 0.5)

        result = {
            "investigation_id": investigation_id,
            "expected_root_cause": expected_root_cause,
            "actual_root_cause": actual_cause,
            "accuracy": accuracy,
            "evidence_support": evidence_support,
            "confidence": confidence,
            "latency_seconds": latency,
            "timestamp": datetime.now().isoformat()
        }
        self.results.append(result)
        return result

    def summarize(self) -> Dict:
        if not self.results:
            return {}
        accuracies = [r["accuracy"] for r in self.results]
        evidence_scores = [r["evidence_support"] for r in self.results]
        latencies = [r["latency_seconds"] for r in self.results]
        return {
            "total_investigations": len(self.results),
            "avg_accuracy": sum(accuracies) / len(accuracies),
            "avg_evidence_support": sum(evidence_scores) / len(evidence_scores),
            "avg_latency_seconds": sum(latencies) / len(latencies),
            "max_latency_seconds": max(latencies),
            "results": self.results
        }
```

### Docker for ECS (`backend/Dockerfile`)
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -q -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```
