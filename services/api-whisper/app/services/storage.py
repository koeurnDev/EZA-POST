"""
Cloudflare R2 Storage Service (S3-compatible)
Generates pre-signed PUT URLs for direct browser-to-R2 uploads.
"""

import os
from typing import Optional

class StorageService:
    def __init__(self):
        self.account_id = os.getenv("R2_ACCOUNT_ID")
        self.access_key_id = os.getenv("R2_ACCESS_KEY_ID")
        self.secret_access_key = os.getenv("R2_SECRET_ACCESS_KEY")
        self.bucket_name = os.getenv("R2_BUCKET_NAME", "khmer-subtitles")
        self.public_domain = os.getenv("R2_PUBLIC_DOMAIN")

    @property
    def is_configured(self) -> bool:
        return bool(self.account_id and self.access_key_id and self.secret_access_key)

    def generate_presigned_upload_url(self, key: str, content_type: str, expires_in: int = 3600) -> Optional[dict]:
        """
        Generates a pre-signed PUT URL so the browser can upload directly to R2.
        """
        if not self.is_configured:
            return None

        try:
            import boto3
            from botocore.config import Config

            endpoint_url = f"https://{self.account_id}.r2.cloudflarestorage.com"
            s3_client = boto3.client(
                "s3",
                endpoint_url=endpoint_url,
                aws_access_key_id=self.access_key_id,
                aws_secret_access_key=self.secret_access_key,
                config=Config(signature_version="s3v4")
            )

            url = s3_client.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": self.bucket_name,
                    "Key": key,
                    "ContentType": content_type
                },
                ExpiresIn=expires_in
            )

            public_url = f"{self.public_domain}/{key}" if self.public_domain else f"{endpoint_url}/{self.bucket_name}/{key}"

            return {
                "upload_url": url,
                "storage_key": key,
                "public_url": public_url
            }
        except Exception as e:
            print(f"Failed to generate R2 presigned URL: {e}")
            return None

storage_service = StorageService()

