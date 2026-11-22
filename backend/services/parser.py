"""
Resume Document Parser Service (Milestone 2)
--------------------------------------------
Extracts readable text from PDF and DOCX files entirely in-memory.
Enforces size limits, binary content validation, and error detection
for empty or scanned/image-only documents.

Privacy & Security Guarantees:
- Operates entirely on in-memory bytes (io.BytesIO).
- Does not persist files or extracted text to disk.
- Does not log resume content.
"""

import io
import zipfile
from typing import Dict, Any
from pypdf import PdfReader
from pypdf.errors import PdfReadError
from docx import Document
from docx.opc.exceptions import PackageNotFoundError

# 5 MB application-level upload limit
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024


class DocumentParsingError(Exception):
    """Base exception for document parsing failures."""
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class FileSizeExceededError(DocumentParsingError):
    """Raised when file exceeds the application limit."""
    def __init__(self, message: str = "File exceeds the 5 MB application upload limit."):
        super().__init__(message, status_code=413)


class InvalidFileFormatError(DocumentParsingError):
    """Raised when content signature does not match supported PDF or DOCX format."""
    def __init__(self, message: str = "Uploaded file content is not a supported PDF or Word (.docx) document."):
        super().__init__(message, status_code=415)


class EmptyDocumentError(DocumentParsingError):
    """Raised when no readable digital text can be found (e.g. scanned image PDF)."""
    def __init__(self, message: str = "No readable text found. The document appears to be empty or a scanned image. OCR is not currently supported; please upload a document with selectable text."):
        super().__init__(message, status_code=422)


class CorruptDocumentError(DocumentParsingError):
    """Raised when document structure is malformed or damaged."""
    def __init__(self, message: str = "Document is malformed or corrupted and cannot be read."):
        super().__init__(message, status_code=422)


def is_pdf(header: bytes) -> bool:
    """Checks if binary header begins with standard PDF magic bytes."""
    return header.startswith(b"%PDF-")


def is_valid_docx(file_bytes: bytes) -> bool:
    """
    Checks if binary content is a valid DOCX archive.
    A valid DOCX is a ZIP archive containing word/document.xml.
    """
    if not file_bytes.startswith(b"PK\x03\x04"):
        return False
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
            namelist = zf.namelist()
            return "word/document.xml" in namelist
    except (zipfile.BadZipFile, Exception):
        return False


def extract_from_pdf(file_bytes: bytes) -> str:
    """
    Extracts text from each page of a PDF in-memory.
    Raises EmptyDocumentError if no text is extracted across all pages.
    """
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        if len(reader.pages) == 0:
            raise EmptyDocumentError("The uploaded PDF has no pages.")

        page_texts = []
        for page in reader.pages:
            text = page.extract_text() or ""
            if text.strip():
                page_texts.append(text.strip())

        full_text = "\n\n".join(page_texts).strip()

        if not full_text:
            raise EmptyDocumentError(
                "No readable text found. This PDF appears to be a scanned image or contains no selectable digital text. "
                "Optical Character Recognition (OCR) is not supported; please upload a PDF with selectable text."
            )

        return full_text
    except EmptyDocumentError:
        raise
    except PdfReadError as e:
        raise CorruptDocumentError(f"Unable to read PDF file: {str(e)}")
    except Exception as e:
        raise CorruptDocumentError(f"Malformed or unreadable PDF: {str(e)}")


def extract_from_docx(file_bytes: bytes) -> str:
    """
    Extracts text from paragraphs and table cells of a DOCX document in-memory.
    Raises EmptyDocumentError if no text is extracted.
    """
    try:
        doc = Document(io.BytesIO(file_bytes))

        text_parts = []

        # 1. Extract from standard paragraphs
        for para in doc.paragraphs:
            stripped = para.text.strip()
            if stripped:
                text_parts.append(stripped)

        # 2. Extract from tables (common in resumes for layout)
        for table in doc.tables:
            for row in table.rows:
                row_texts = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if row_texts:
                    # Deduplicate repeated cell text caused by merged cells
                    unique_texts = list(dict.fromkeys(row_texts))
                    text_parts.append(" | ".join(unique_texts))

        full_text = "\n\n".join(text_parts).strip()

        if not full_text:
            raise EmptyDocumentError("No readable text found in this Word document.")

        return full_text
    except (PackageNotFoundError, zipfile.BadZipFile) as e:
        raise CorruptDocumentError(f"Malformed Word document: {str(e)}")
    except EmptyDocumentError:
        raise
    except Exception as e:
        raise CorruptDocumentError(f"Unable to parse Word document: {str(e)}")


def parse_resume_bytes(file_bytes: bytes) -> Dict[str, Any]:
    """
    Validates and extracts readable text from raw document bytes in memory.
    
    Returns:
        Dict with keys:
          - file_type: 'PDF document' or 'Word document'
          - extracted_text: Clean combined string
          - stats: {'word_count': int, 'character_count': int}
    """
    # 1. Enforce size limit
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise FileSizeExceededError(
            f"File size ({len(file_bytes) / (1024 * 1024):.1f} MB) exceeds the 5 MB application upload limit."
        )

    if len(file_bytes) == 0:
        raise EmptyDocumentError("The uploaded file is empty (0 bytes).")

    # 2. Identify and validate file content
    header = file_bytes[:10]
    if is_pdf(header):
        file_type = "PDF document"
        extracted_text = extract_from_pdf(file_bytes)
    elif is_valid_docx(file_bytes):
        file_type = "Word document"
        extracted_text = extract_from_docx(file_bytes)
    else:
        raise InvalidFileFormatError(
            "Uploaded file does not match a valid PDF or Word (.docx) document structure."
        )

    # 3. Compute metrics
    word_count = len(extracted_text.split())
    character_count = len(extracted_text)

    return {
        "file_type": file_type,
        "extracted_text": extracted_text,
        "stats": {
            "word_count": word_count,
            "character_count": character_count,
        },
    }
