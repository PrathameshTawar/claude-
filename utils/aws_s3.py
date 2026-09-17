import json
import os
from typing import Dict, Any, Optional
from utils.logger import log


class S3StorageManager:
    """
    Manages saving investigation reports to AWS S3 buckets.
    Gracefully handles missing AWS credentials or network connectivity issues.
    """

    def __init__(self):
        self.bucket_name = os.getenv("S3_BUCKET", "monarch-hackathon")
        self.aws_region = os.getenv("AWS_REGION", "us-east-1")

    def upload_investigation(self, investigation_id: str, data: Dict[str, Any]) -> Optional[str]:
        """
        Uploads investigation result payload to S3 bucket.
        Returns the s3:// URI path on success, or None on failure/skip.
        """
        try:
            import boto3

            s3_client = boto3.client("s3", region_name=self.aws_region)
            s3_key = f"investigations/{investigation_id}/result.json"

            s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=json.dumps(data, indent=2, default=str),
                ContentType="application/json"
            )

            s3_uri = f"s3://{self.bucket_name}/{s3_key}"
            log.info("Uploaded investigation %s to S3: %s", investigation_id, s3_uri)
            return s3_uri
        except Exception as exc:
            log.info("S3 upload skipped/unavailable (%s). Local investigation preserved.", exc)
            return None


s3_manager = S3StorageManager()
