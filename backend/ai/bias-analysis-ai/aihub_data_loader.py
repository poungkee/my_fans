"""
AI-Hub 데이터 로더
"""

import json
import logging
from pathlib import Path
from typing import List, Dict, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIHubDataLoader:
    """AI-Hub 문장 유형 데이터 로더"""

    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)

    def load_json_file(self, file_path: Path) -> Optional[Dict]:
        """JSON 파일 로드"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"파일 로드 실패 {file_path}: {e}")
            return None

    def extract_sentences(self, data: Dict) -> List[Dict]:
        """문장 데이터 추출"""
        sentences = []

        for doc in data.get('document', []):
            for sentence in doc.get('sentence', []):
                sentence_data = {
                    'text': sentence.get('form', ''),
                    'sentence_type': sentence.get('sentence_type', 'unknown'),
                    'id': sentence.get('id', '')
                }
                if sentence_data['text']:
                    sentences.append(sentence_data)

        return sentences

    def load_all_data(self, max_files: int = None) -> List[Dict]:
        """모든 데이터 로드"""
        all_sentences = []
        file_count = 0

        patterns = [
            "TL_뉴스_*.json",
            "VL_뉴스_*.json"
        ]

        for pattern in patterns:
            files = list(self.data_dir.glob(pattern))

            for file_path in files:
                if max_files and file_count >= max_files:
                    break

                data = self.load_json_file(file_path)
                if data:
                    sentences = self.extract_sentences(data)
                    all_sentences.extend(sentences)
                    file_count += 1

                    split_type = "training" if "TL_" in file_path.name else "validation"
                    logger.info(f"로드 완료: {file_path.stem} ({split_type}) - {len(sentences)}개 문장")

        return all_sentences