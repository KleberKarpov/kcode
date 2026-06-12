#!/usr/bin/env python3
"""
KCODE Skill: Security Analyzer
Analisa scripts Python em busca de vulnerabilidades de segurança,
dados sensíveis, códigos maliciosos e riscos gerais.
"""

import ast
import re
import json
import sys
import os
from typing import Any
from datetime import datetime

# CATEGORIAS DE RISCO
SEVERITY_CRITICAL = "CRITICAL"
SEVERITY_HIGH = "HIGH"
SEVERITY_MEDIUM = "MEDIUM"
SEVERITY_LOW = "LOW"
SEVERITY_INFO = "INFO"

class Finding:
    def __init__(self, severity: str, category: str, line: int,
                 description: str, code_snippet: str = "",
                 recommendation: str = ""):
        self.severity = severity
        self.category = category
        self.line = line
        self.description = description
        self.code_snippet = code_snippet
        self.recommendation = recommendation

    def to_dict(self) -> dict:
        return {
            "severity": self.severity,
            "category": self.category,
            "line": self.line,
            "description": self.description,
            "code_snippet": self.code_snippet.strip(),
            "recommendation": self.recommendation
        }

SENSITIVE_PATTERNS = [
    (r'(?i)(api[_-]?key|apikey)\s*[=:]\s*["\'][A-Za-z0-9]{16,}', "API Key descoberta", "Use variáveis de ambiente", SEVERITY_CRITICAL, "DADOS_SENSIVEIS"),
    (r'(?i)(secret[_-]?key)\s*[=:]\s*["\'][A-Za-z0-9]{8,}', "Chave secreta hardcodada", "Use variáveis de ambiente", SEVERITY_CRITICAL, "DADOS_SENSIVEIS"),
    (r'AKIA[0-9A-Z]{16}', "AWS Access Key ID", "Remova credenciais AWS", SEVERITY_CRITICAL, "DADOS_SENSIVEIS"),
    (r'ghp_[A-Za-z0-9]{36}', "GitHub Personal Access Token", "Use variáveis de ambiente", SEVERITY_CRITICAL, "DADOS_SENSIVEIS"),
]

def analyze(file_path):
    print(f"Lendo {file_path}...")
    findings = []
    with open(file_path, "r") as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        for pattern, desc, rec, sev, cat in SENSITIVE_PATTERNS:
            if re.search(pattern, line):
                findings.append(Finding(sev, cat, i+1, desc, line, rec))
    return findings

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: security_analyzer.py <arquivo>")
        sys.exit(1)
    results = analyze(sys.argv[1])
    for f in results:
        print(f"[{f.severity}] Linha {f.line}: {f.description}")
