"""
Merge LoRA Weights and Export to CTranslate2 (CT2 int8)
Converts fine-tuned PyTorch Whisper LoRA model into ultra-fast CTranslate2 format.

Requirements:
  pip install ctranslate2 peft transformers torch

Usage:
  python merge_and_export_ct2.py \
    --base_model "openai/whisper-small" \
    --lora_adapter "./khmer_whisper_lora" \
    --merged_output "./khmer_whisper_merged" \
    --ct2_output "./khmer_whisper_ct2_int8" \
    --quantization int8
"""

import os
import shutil
import subprocess
from pathlib import Path
import torch
from transformers import WhisperForConditionalGeneration, WhisperProcessor
from peft import PeftModel

def merge_and_export(
    base_model_id: str,
    lora_adapter_path: str,
    merged_output_dir: str,
    ct2_output_dir: str,
    quantization: str = "int8"
):
    print("=" * 60)
    print("Phase 1: Merging LoRA Adapter into Pretrained Whisper...")
    print(f"Base Model: {base_model_id}")
    print(f"LoRA Adapter: {lora_adapter_path}")
    print("=" * 60)

    # 1. Load Base Model in float32 for clean merging
    base_model = WhisperForConditionalGeneration.from_pretrained(
        base_model_id,
        torch_dtype=torch.float32,
        device_map="cpu"
    )

    # 2. Load LoRA Adapter
    model = PeftModel.from_pretrained(base_model, lora_adapter_path)
    
    # 3. Merge weights into base model layers
    print("Merging weights...")
    merged_model = model.merge_and_unload()

    # 4. Save merged Hugging Face model
    merged_path = Path(merged_output_dir)
    merged_path.mkdir(parents=True, exist_ok=True)
    merged_model.save_pretrained(merged_path)

    # Copy processor & tokenizer
    processor = WhisperProcessor.from_pretrained(lora_adapter_path)
    processor.save_pretrained(merged_path)
    print(f"Merged Hugging Face model saved at: {merged_path}")

    # 5. Convert to CTranslate2 using ct2-transformers-converter
    print("=" * 60)
    print(f"Phase 2: Converting to CTranslate2 ({quantization})...")
    print("=" * 60)

    ct2_path = Path(ct2_output_dir)
    if ct2_path.exists():
        shutil.rmtree(ct2_path)

    cmd = [
        "ct2-transformers-converter",
        "--model", str(merged_path),
        "--output_dir", str(ct2_path),
        "--quantization", quantization,
        "--copy_files", "tokenizer.json", "preprocessor_config.json"
    ]
    print("Running command:", " ".join(cmd))
    subprocess.run(cmd, check=True)

    print("=" * 60)
    print(f"Conversion SUCCESSFUL!")
    print(f"Production Model ready at: {ct2_path}")
    print("To use in faster-whisper:")
    print(f"  from faster_whisper import WhisperModel")
    print(f"  model = WhisperModel(r'{ct2_path.resolve()}', device='cpu', compute_type='int8')")
    print("=" * 60)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--base_model", default="openai/whisper-small")
    parser.add_argument("--lora_adapter", default="./khmer_whisper_lora")
    parser.add_argument("--merged_output", default="./khmer_whisper_merged")
    parser.add_argument("--ct2_output", default="./khmer_whisper_ct2_int8")
    parser.add_argument("--quantization", default="int8", choices=["int8", "float16", "int8_float16"])
    args = parser.parse_args()

    merge_and_export(
        base_model_id=args.base_model,
        lora_adapter_path=args.lora_adapter,
        merged_output_dir=args.merged_output,
        ct2_output_dir=args.ct2_output,
        quantization=args.quantization
    )

