"""
Unit and Integration Tests for Milestone 2 Parser
-------------------------------------------------
Verifies all 5 required edge cases in-memory:
  1. Text-based PDF extraction
  2. Word (.docx) document extraction (paragraphs and tables)
  3. Empty or image-only PDF detection (raises EmptyDocumentError / 422)
  4. Invalid or renamed file detection (raises InvalidFileFormatError / 415)
  5. File size limit enforcement (raises FileSizeExceededError / 413)
"""

import io
import sys
import os
import unittest
from zipfile import ZipFile

# Add backend directory to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.parser import (
    parse_resume_bytes,
    FileSizeExceededError,
    InvalidFileFormatError,
    EmptyDocumentError,
    MAX_FILE_SIZE_BYTES,
)

from pypdf import PdfWriter
from docx import Document


class TestResumeParser(unittest.TestCase):

    def test_1_text_based_pdf(self):
        """Test extraction from a valid text-based PDF created in-memory."""
        writer = PdfWriter()
        writer.add_blank_page(width=72 * 8.5, height=72 * 11)
        # Note: writing actual text with pypdf directly requires annotation or page merge
        # Alternatively, we create a minimal valid PDF with a content stream containing text
        pdf_bytes = (
            b"%PDF-1.4\n"
            b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
            b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
            b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n"
            b"4 0 obj << /Length 55 >> stream\n"
            b"BT /F1 12 Tf 100 700 Td (Jane Doe Software Engineer Python FastAPI) Tj ET\n"
            b"endstream\nendobj\n"
            b"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
            b"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n0000000236 00000 n \n0000000341 00000 n \n"
            b"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n418\n%%EOF\n"
        )

        result = parse_resume_bytes(pdf_bytes)
        self.assertEqual(result["file_type"], "PDF document")
        self.assertIn("Jane Doe", result["extracted_text"])
        self.assertIn("FastAPI", result["extracted_text"])
        self.assertGreater(result["stats"]["word_count"], 0)
        self.assertGreater(result["stats"]["character_count"], 0)
        print("✓ Test 1 Passed: Text-based PDF extracted correctly.")

    def test_2_docx_document(self):
        """Test extraction from a valid DOCX with paragraphs and tables."""
        doc = Document()
        doc.add_heading("Alex Smith - Resume", level=1)
        doc.add_paragraph("Full-Stack Developer experienced in Python and React.")
        
        # Add a table
        table = doc.add_table(rows=2, cols=2)
        table.rows[0].cells[0].text = "Skill"
        table.rows[0].cells[1].text = "Experience"
        table.rows[1].cells[0].text = "Python"
        table.rows[1].cells[1].text = "4 years"

        buffer = io.BytesIO()
        doc.save(buffer)
        docx_bytes = buffer.getvalue()

        result = parse_resume_bytes(docx_bytes)
        self.assertEqual(result["file_type"], "Word document")
        self.assertIn("Alex Smith", result["extracted_text"])
        self.assertIn("Python and React", result["extracted_text"])
        self.assertIn("Skill | Experience", result["extracted_text"])
        self.assertGreater(result["stats"]["word_count"], 0)
        print("✓ Test 2 Passed: DOCX (paragraphs + tables) extracted correctly.")

    def test_3_empty_or_scanned_pdf(self):
        """Test that an empty or image-only PDF raises EmptyDocumentError (422)."""
        writer = PdfWriter()
        writer.add_blank_page(width=612, height=792)  # Completely blank page
        buffer = io.BytesIO()
        writer.write(buffer)
        blank_pdf_bytes = buffer.getvalue()

        with self.assertRaises(EmptyDocumentError) as ctx:
            parse_resume_bytes(blank_pdf_bytes)
        self.assertEqual(ctx.exception.status_code, 422)
        self.assertIn("No readable text found", ctx.exception.message)
        print("✓ Test 3 Passed: Empty / scanned PDF rejected with 422.")

    def test_4_invalid_or_renamed_file(self):
        """Test that a non-PDF/non-DOCX file (e.g. text/image renamed) raises InvalidFileFormatError (415)."""
        fake_pdf_bytes = b"Hello, this is just a plain text file pretending to be a PDF!"
        with self.assertRaises(InvalidFileFormatError) as ctx:
            parse_resume_bytes(fake_pdf_bytes)
        self.assertEqual(ctx.exception.status_code, 415)

        # Also test a corrupt zip archive
        fake_zip_bytes = b"PK\x03\x04corrupted_zip_archive_without_word_document_xml"
        with self.assertRaises(InvalidFileFormatError) as ctx:
            parse_resume_bytes(fake_zip_bytes)
        self.assertEqual(ctx.exception.status_code, 415)
        print("✓ Test 4 Passed: Invalid or renamed file rejected with 415.")

    def test_5_file_size_exceeded(self):
        """Test that files exceeding 5 MB raise FileSizeExceededError (413)."""
        oversized_bytes = b"%PDF-" + b"0" * (MAX_FILE_SIZE_BYTES + 10)
        with self.assertRaises(FileSizeExceededError) as ctx:
            parse_resume_bytes(oversized_bytes)
        self.assertEqual(ctx.exception.status_code, 413)
        self.assertIn("5 MB", ctx.exception.message)
        print("✓ Test 5 Passed: File > 5 MB rejected with 413.")


if __name__ == "__main__":
    unittest.main()
