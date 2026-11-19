"""
Aarohi AI Recruiter Service - Structured Logging & Observability.

Provides contextual structured logging with correlation IDs, tenant isolation
tracking, and automated sensitive data scrubbing (API keys, tokens, PII).
"""

import json
import logging
import re
import sys
from contextvars import ContextVar
from typing import Any

# Context variables for distributed request tracing
correlation_id_ctx: ContextVar[str | None] = ContextVar("correlation_id", default=None)
tenant_id_ctx: ContextVar[str | None] = ContextVar("tenant_id", default=None)
interview_id_ctx: ContextVar[str | None] = ContextVar("interview_id", default=None)

# Regular expressions for scrubbing sensitive data from log records
SENSITIVE_KEY_PATTERNS = [
    re.compile(r"api[-_]?key", re.IGNORECASE),
    re.compile(r"secret", re.IGNORECASE),
    re.compile(r"token", re.IGNORECASE),
    re.compile(r"password", re.IGNORECASE),
    re.compile(r"authorization", re.IGNORECASE),
    re.compile(r"cookie", re.IGNORECASE),
]

SENSITIVE_VALUE_PATTERNS = [
    # JWT tokens: header.payload.signature
    (re.compile(r"ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"), "[REDACTED_JWT]"),
    # Bearer tokens
    (re.compile(r"Bearer\s+[A-Za-z0-9\._\-]+", re.IGNORECASE), "Bearer [REDACTED_TOKEN]"),
    # Generic API Keys (e.g. sk-..., dg-..., etc.)
    (re.compile(r"\b(sk-[a-zA-Z0-9]{20,}|AIza[a-zA-Z0-9_\-]{35})\b"), "[REDACTED_API_KEY]"),
    # Email addresses
    (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"), "[REDACTED_EMAIL]"),
    # Indian and international phone numbers (10+ digits)
    (
        re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"),
        "[REDACTED_PHONE]",
    ),
]


def scrub_text(text: str) -> str:
    """Scrub sensitive patterns from string values."""
    if not isinstance(text, str):
        return text
    scrubbed = text
    for pattern, replacement in SENSITIVE_VALUE_PATTERNS:
        scrubbed = pattern.sub(replacement, scrubbed)
    return scrubbed


def scrub_dict(data: Any) -> Any:
    """Recursively scrub sensitive keys and patterns from dictionary objects."""
    if isinstance(data, dict):
        scrubbed = {}
        for key, value in data.items():
            # Check if key is sensitive
            is_sensitive_key = any(pattern.search(str(key)) for pattern in SENSITIVE_KEY_PATTERNS)
            if is_sensitive_key:
                scrubbed[key] = "[REDACTED]"
            else:
                scrubbed[key] = scrub_dict(value)
        return scrubbed
    elif isinstance(data, list):
        return [scrub_dict(item) for item in data]
    elif isinstance(data, str):
        return scrub_text(data)
    return data


class StructuredJsonFormatter(logging.Formatter):
    """
    Standard library logging Formatter that outputs single-line JSON log events
    enriched with active context variables and sensitive data redaction.
    """

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": scrub_text(record.getMessage()),
            "correlation_id": correlation_id_ctx.get(),
            "tenant_id": tenant_id_ctx.get(),
            "interview_id": interview_id_ctx.get(),
            "source": f"{record.filename}:{record.lineno}",
        }

        # Include structured extra fields if present
        if hasattr(record, "extra") and isinstance(record.extra, dict):
            log_entry["data"] = scrub_dict(record.extra)

        # Include exception trace if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry)


class TextConsoleFormatter(logging.Formatter):
    """Clean human-readable console formatter for local interactive development."""

    def format(self, record: logging.LogRecord) -> str:
        cid = correlation_id_ctx.get() or "-"
        tid = tenant_id_ctx.get() or "-"
        msg = scrub_text(record.getMessage())
        base = f"[{self.formatTime(record, self.datefmt)}] [{record.levelname:<5}] [{record.name}] [cid:{cid}|tid:{tid}] {msg}"
        if record.exc_info:
            base += f"\n{self.formatException(record.exc_info)}"
        return base


def configure_logging(log_level: str = "INFO", log_format: str = "json") -> None:
    """Configure root logger with selected formatter and level."""
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level.upper())

    # Remove existing handlers to prevent duplicate outputs
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    console_handler = logging.StreamHandler(sys.stdout)
    if log_format.lower() == "json":
        console_handler.setFormatter(StructuredJsonFormatter())
    else:
        console_handler.setFormatter(TextConsoleFormatter())

    root_logger.addHandler(console_handler)

    # Silence overly verbose external libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Get a named logger instance."""
    return logging.getLogger(name)
