"""
CareerPilot AI - Backend API (Milestone 3)
------------------------------------------
In Milestone 3, we implement:
  - GET /health: Verifies backend is running.
  - POST /api/extract-text: Extracts readable text from PDF and DOCX files in-memory.
  - POST /api/compare: Compares working resume text against job description using
    the curated dictionary of technical terms without AI or text alterations.
"""

import io
import os
from typing import Optional
from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.parser import (
    MAX_FILE_SIZE_BYTES,
    DocumentParsingError,
    FileSizeExceededError,
    InvalidFileFormatError,
    EmptyDocumentError,
    CorruptDocumentError,
    parse_resume_bytes,
)

from services.comparator import (
    compare_resume_to_job,
    ComparisonError,
    InputEmptyError,
    InputSizeExceededError,
)

from services.ai_coach import (
    load_env_file,
    get_coach_status,
    generate_resume_coaching,
    ProviderNotConfiguredError,
    InvalidInputError,
    CoachError,
)

from services.tailor import generate_tailored_resume

# Load environment variables securely from backend/.env on server start
load_env_file()

app = FastAPI(
    title="CareerPilot AI Backend",
    description="Backend API for CareerPilot AI resume tailoring assistant",
    version="0.3.0",
)

# CORS Configuration for local React frontend and Docker container
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://localhost:5176",
    "http://127.0.0.1:5176",
]

allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
if allowed_origins_env:
    for extra in allowed_origins_env.split(","):
        extra = extra.strip()
        if extra and extra not in origins:
            origins.append(extra)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CompareRequest(BaseModel):
    resume_text: str
    job_description: str


@app.get("/health", status_code=status.HTTP_200_OK)
def health_check():
    """Confirms the backend server is reachable and healthy."""
    return {
        "status": "healthy",
        "app_name": "CareerPilot AI Backend",
        "version": "0.3.0",
        "environment": "local-dev",
    }


@app.post("/api/extract-text", status_code=status.HTTP_200_OK)
async def extract_text(resume_file: UploadFile = File(...)):
    """
    Milestone 2: In-memory text extraction from PDF and DOCX files.
    """
    if not resume_file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A resume document file (.pdf or .docx) is required.",
        )

    chunk_size = 64 * 1024
    total_bytes = 0
    buffer = io.BytesIO()

    try:
        while True:
            chunk = await resume_file.read(chunk_size)
            if not chunk:
                break
            total_bytes += len(chunk)
            if total_bytes > MAX_FILE_SIZE_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="File exceeds the 5 MB application upload limit.",
                )
            buffer.write(chunk)
    finally:
        await resume_file.close()

    file_bytes = buffer.getvalue()

    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty (0 bytes).",
        )

    try:
        result = parse_resume_bytes(file_bytes)
        return {
            "status": "success",
            "file_type": result["file_type"],
            "extracted_text": result["extracted_text"],
            "stats": result["stats"],
        }
    except FileSizeExceededError as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=e.message)
    except InvalidFileFormatError as e:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=e.message)
    except (EmptyDocumentError, CorruptDocumentError) as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=e.message)
    except DocumentParsingError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while parsing the document.",
        )


@app.post("/api/compare", status_code=status.HTTP_200_OK)
def compare_texts(request: CompareRequest):
    """
    Milestone 3: Rule-based comparison against curated dictionary.
    Compares the user's working resume text to the job description.
    """
    try:
        return compare_resume_to_job(
            resume_text=request.resume_text,
            job_description=request.job_description,
        )
    except InputEmptyError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except InputSizeExceededError as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=e.message)
    except ComparisonError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during comparison.",
        )


class CoachRequest(BaseModel):
    resume_text: str
    job_description: Optional[str] = None
    preset: Optional[str] = "general"


class TailorResumeRequest(BaseModel):
    resume_text: str
    job_description: str
    preset: Optional[str] = "general"


@app.get("/api/coach/status", status_code=status.HTTP_200_OK)
def coach_status():
    """Returns AI Coach configuration status and available platform presets."""
    return get_coach_status()


@app.post("/api/coach/feedback", status_code=status.HTTP_200_OK)
def coach_feedback(request: CoachRequest):
    """
    On-demand AI resume coaching feedback with suggestions by section.
    Raises 503 if provider is not configured.
    """
    try:
        return generate_resume_coaching(
            resume_text=request.resume_text,
            job_description=request.job_description,
            preset=request.preset or "general",
        )
    except ProviderNotConfiguredError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=e.message,
        )
    except InvalidInputError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message,
        )
    except CoachError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail=e.message,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during coaching generation: {str(e)}",
        )


@app.post("/api/tailor", status_code=status.HTTP_200_OK)
def tailor_resume_endpoint(request: TailorResumeRequest):
    """
    On-demand AI resume tailoring to match a specific job description.
    Enforces evidence-only rules, flags unevidenced requirements, and returns
    full tailored resume text and changed sections.
    Raises 503 if provider is unconfigured, 400 if inputs are missing.
    """
    try:
        return generate_tailored_resume(
            resume_text=request.resume_text,
            job_description=request.job_description,
            preset=request.preset or "general",
        )
    except ProviderNotConfiguredError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=e.message,
        )
    except InvalidInputError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message,
        )
    except CoachError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail=e.message,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during resume tailoring: {str(e)}",
        )
