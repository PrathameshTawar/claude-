import re
from typing import Dict, List, Any


class TimelineBuilder:
    """
    Extracts timestamped events from logs and document text,
    normalizes times, and constructs a unified chronological incident timeline.
    """

    @staticmethod
    def extract_timestamps(text: str, filename: str = "") -> List[Dict[str, Any]]:
        if not text:
            return []

        # Matches [HH:MM:SS], [HH:MM], or ISO timestamp formats like 2024-09-16 14:02:10
        pattern = r'(?:\[)?(\d{2}:\d{2}(?::\d{2})?)(?:\])?'
        iso_pattern = r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)'

        events = []
        lines = text.splitlines()

        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue

            match = re.search(pattern, line_str)
            iso_match = re.search(iso_pattern, line_str)

            time_key = None
            if iso_match:
                time_key = iso_match.group(1)
            elif match:
                time_key = match.group(1)

            if time_key:
                # Clean up line string for display
                cleaned_event = line_str
                events.append({
                    "time": time_key,
                    "event": cleaned_event,
                    "source": filename or "evidence"
                })

        return events

    @classmethod
    def build_timeline(cls, evidence_text: str, filename: str = "Ingested Context") -> List[Dict[str, Any]]:
        events = cls.extract_timestamps(evidence_text, filename=filename)

        # Deduplicate while preserving chronological order
        seen = set()
        unique_events = []
        for ev in events:
            key = (ev["time"], ev["event"][:60])
            if key not in seen:
                seen.add(key)
                unique_events.append(ev)

        # Sort chronologically by time key
        unique_events.sort(key=lambda x: x["time"])
        return unique_events


timeline_builder = TimelineBuilder()
