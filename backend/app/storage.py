import os, boto3
from pathlib import Path
from .config import STORAGE_MODE, MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, BUCKET_NAME, LOCAL_STORAGE_PATH

# Initialize MinIO client only if needed
s3 = None
if STORAGE_MODE == "minio":
    s3 = boto3.client(
        "s3",
        endpoint_url=MINIO_ENDPOINT,
        aws_access_key_id=MINIO_ACCESS_KEY,
        aws_secret_access_key=MINIO_SECRET_KEY,
    )

def ensure_storage():
    """Ensure storage bucket or local directory exists."""
    if STORAGE_MODE == "minio":
        try:
            s3.head_bucket(Bucket=BUCKET_NAME)
        except:
            s3.create_bucket(Bucket=BUCKET_NAME)
    else:
        if not os.path.exists(LOCAL_STORAGE_PATH):
            os.makedirs(LOCAL_STORAGE_PATH)

def upload_file(object_name: str, data: bytes):
    """Uploads data to MinIO or Local Filesystem."""
    if STORAGE_MODE == "minio":
        s3.put_object(Bucket=BUCKET_NAME, Key=object_name, Body=data)
    else:
        file_path = LOCAL_STORAGE_PATH / object_name
        file_path.parent.mkdir(exist_ok=True, parents=True)
        with open(file_path, "wb") as f:
            f.write(data)

def get_file_content(object_name: str) -> bytes:
    """Retrieves data from MinIO or Local Filesystem."""
    if STORAGE_MODE == "minio":
        response = s3.get_object(Bucket=BUCKET_NAME, Key=object_name)
        return response["Body"].read()
    else:
        file_path = LOCAL_STORAGE_PATH / object_name
        with open(file_path, "rb") as f:
            return f.read()

def get_file_url(object_name: str, expires=3600):
    """Generates a URL for the object."""
    if STORAGE_MODE == "minio":
        return s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET_NAME, "Key": object_name},
            ExpiresIn=expires,
        )
    else:
        # For local, we'll serve it via a FastAPI static route
        return f"/api/storage/{object_name}"
