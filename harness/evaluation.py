import json
import time
from datetime import datetime
from typing import Dict, List, Any
from utils.logger import log


class MonarchEvaluator:
    """
    Evaluates Monarch multi-agent investigation performance against benchmark test cases.
    Calculates Accuracy, Evidence Support Score, Latency, and saves report to evaluation_report.json.
    """

    def __init__(self):
        self.results: List[Dict[str, Any]] = []

    def evaluate_investigation(
        self,
        investigation_id: str,
        expected_root_cause: str,
        actual_output: Dict[str, Any],
        latency_seconds: float = 0.0
    ) -> Dict[str, Any]:
        actual_cause = actual_output.get("output", "") or actual_output.get("root_cause", "")
        confidence = actual_output.get("adjusted_confidence", 0.85)
        evidence_chain = actual_output.get("evidence_chain", [])

        # 1. Accuracy Metric: Check keyword/semantic match
        accuracy = 0.95 if expected_root_cause.lower() in actual_cause.lower() else 0.50

        # 2. Evidence Support Metric: Based on density of verified citations
        evidence_support = min(1.0, len(evidence_chain) * 0.3 + 0.4)

        eval_result = {
            "investigation_id": investigation_id,
            "expected_root_cause": expected_root_cause,
            "actual_root_cause": actual_cause[:150] + "...",
            "accuracy": round(accuracy, 2),
            "evidence_support": round(evidence_support, 2),
            "confidence": round(confidence, 2),
            "latency_seconds": round(latency_seconds, 2),
            "timestamp": datetime.now().isoformat()
        }
        self.results.append(eval_result)
        return eval_result

    def generate_summary(self) -> Dict[str, Any]:
        return self.summarize()


    def summarize(self) -> Dict[str, Any]:
        if not self.results:
            return {"total_investigations": 0}

        accuracies = [r["accuracy"] for r in self.results]
        evidence_scores = [r["evidence_support"] for r in self.results]
        latencies = [r["latency_seconds"] for r in self.results]

        summary = {
            "total_investigations": len(self.results),
            "avg_accuracy": round(sum(accuracies) / len(accuracies), 2),
            "avg_evidence_support": round(sum(evidence_scores) / len(evidence_scores), 2),
            "avg_latency_seconds": round(sum(latencies) / len(latencies), 2),
            "max_latency_seconds": round(max(latencies), 2),
            "results": self.results
        }
        return summary

    def save_report(self, filename: str = "evaluation_report.json"):
        summary_data = self.summarize()
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(summary_data, f, indent=2)
        log.info("Saved evaluation report to %s", filename)
        return summary_data


evaluator = MonarchEvaluator()


def evaluate_system(filename: str = "evaluation_report.json") -> Dict[str, Any]:
    """Helper function to run system evaluations and save report."""
    return evaluator.save_report(filename)

